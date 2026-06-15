import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import { createReadStream, promises as fs } from "fs";
import { agentSessionLog } from "@/debug/agentSessionLog";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Stripe from "stripe";
import { appEnv, resetAppBaseUrl } from "@/config/env";
import {
  assertProductionCorsPolicy,
  buildStrictCorsOrigins,
  formatCorsPolicyErrors,
} from "@/config/corsPolicy";
import {
  formatProductionSecretsErrors,
  validateProductionSecrets,
} from "@/config/secretPolicy";
import {
  bodyWithoutWebhookSecrets,
  secureSecretEquals,
  verifyInboundWebhookAuth,
} from "@/server/webhookHmac";
import { prisma } from "./prismaClient";
import { buildFileUrl, sanitizeFolder } from "./_r2";
import {
  blobFolderIsPublic,
  deleteBlobObject,
  hasBlobConfig,
  putBlobObject,
  streamBlobObject,
} from "./_blob";
import { resolveLocalUploadFile, normalizePublicIdQuery, mimeFromStorageKey } from "./storageUtils";
import { parseAuthFromRequest, registerMongoApi, resolveAuthPayload, type AuthPayload } from "./mongoApi";
import { sendStaffNotifyEmail } from "./src/server/staffNotifyEmail";
import { sendLeadEmail } from "./src/server/sendLeadEmail";
import { LicenseCheckoutSchema, OrderSchema, PaddeAuditPayloadSchema } from "./src/lib/schemas";
import {
  INFINITE_APP_CATALOG,
  mergeCatalogWithDefaults,
  parseAppCatalogEntries,
} from "./src/data/appCatalog";
import { loadAppCatalog, saveAppCatalog } from "./src/server/appCatalogStore";
import { parseAppointmentBody } from "./src/lib/appAppointment";
import {
  activateLicenseFromCheckoutSession,
  confirmSaasTenantReady,
  LICENSES_COLLECTION_PATH,
  patchLicenseBySubscriptionId,
  provisionSaasLicense,
  upsertExternalSubscriptionLicense,
} from "./src/server/licenseActivation";
import { verifySaasBridgeAuth } from "./src/server/saasAppBridge";
import { licenseDocId, isLicenseActive, type AppLicense } from "./src/lib/licenses";
import { isExternalSaasBilling } from "./src/lib/saasBilling";
import { resolveSaasTenantId } from "./src/lib/saasAccess";
import { signSaasAccessToken, verifySaasAccessToken } from "./src/server/saasAccessToken";
import { isAllowedUpload, uploadSingleWithHandling } from "./src/server/multerUpload";
import { applySensitiveRateLimits, isRateLimitEnabled } from "./src/server/rateLimit";
import { registerErrorHandlers } from "./src/server/errorHandler";
import { applySecurityHeaders } from "./src/server/securityHeaders";
import { applyCsrfProtection } from "./src/server/csrfProtection";
import { logHttpRequest, logger } from "./src/server/logger";
import {
  resolveCatalogLicenseCheckout,
  resolveCatalogSubscriptionCheckout,
} from "./src/server/catalogCheckoutPricing";
import {
  assertFileAccess,
  getFileRegistryEntry,
  registerUploadedFile,
  removeFileRegistryEntry,
} from "./src/server/fileRegistry";

const DB_FILE_COLLECTION_PATH = "__file_blobs";
const DB_FILE_PUBLIC_ID_PREFIX = "dbf/";
const MAX_DB_FALLBACK_BYTES = 8 * 1024 * 1024; // 8 MB (reste sous la limite Mongo ~16 MB après base64)
const ORDERS_COLLECTION_PATH = "orders";
const USERS_COLLECTION_PATH = "users";
const NOTIFICATIONS_COLLECTION_PATH = "notifications";

type SubscriptionOrderStatus = "En attente" | "Paiement en cours" | "Actif" | "Impayé" | "Annulé";

function normalizeBillingCycle(raw: unknown): "month" | "year" | null {
  const v = String(raw || "").trim().toLowerCase();
  if (["mensuel", "monthly", "month", "mois"].includes(v)) return "month";
  if (["annuel", "yearly", "annual", "year", "an"].includes(v)) return "year";
  return null;
}

function subscriptionStatusFromStripe(raw: string | null | undefined): SubscriptionOrderStatus {
  const status = String(raw || "").trim().toLowerCase();
  if (["active", "trialing", "past_due", "incomplete", "incomplete_expired", "unpaid"].includes(status)) {
    if (status === "unpaid") return "Impayé";
    return "Actif";
  }
  if (["canceled", "ended", "paused"].includes(status)) return "Annulé";
  return "Paiement en cours";
}

function readDataRowAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isDbStoredPublicId(publicId: string) {
  return publicId.startsWith(DB_FILE_PUBLIC_ID_PREFIX);
}

function dbDocIdFromPublicId(publicId: string) {
  return publicId.slice(DB_FILE_PUBLIC_ID_PREFIX.length);
}

function contentDispositionForDownload(storageKey: string, originalName: string, mimetype: string): string {
  const safeName = originalName.replace(/"/g, "");
  const key = storageKey.toLowerCase();
  const type = mimetype.toLowerCase();
  const asAttachment = key.endsWith(".zip") || type.includes("zip");
  return `${asAttachment ? "attachment" : "inline"}; filename="${safeName}"`;
}

function assertSecureStartup(): void {
  const corsReport = assertProductionCorsPolicy(
    buildStrictCorsOrigins(appEnv.http.corsOriginRaw),
    appEnv.node.isProduction
  );
  if (!corsReport.ok) {
    throw new Error(`Configuration CORS invalide:\n${formatCorsPolicyErrors(corsReport)}`);
  }

  const secretsReport = validateProductionSecrets({
    isProduction: appEnv.node.isProduction,
    databaseUrl: appEnv.database.url,
    jwtSecret: appEnv.auth.getJwtSecret(),
    paddeWebhookSecret: appEnv.webhooks.paddeWebhookSecret,
    noyaWebhookSecret: appEnv.webhooks.noyaRecrutementWebhookSecret,
    saasBridgeApiKey: String(process.env.SAAS_BRIDGE_API_KEY || ""),
    stripeSecretKey: appEnv.stripe.secretKey,
    stripeWebhookSecret: appEnv.stripe.webhookSecret,
  });
  if (!secretsReport.ok) {
    throw new Error(`Configuration secrets invalide:\n${formatProductionSecretsErrors(secretsReport)}`);
  }
}

function rejectUnauthorizedWebhook(
  req: Request,
  res: Response,
  secretExpected: string,
  allowPlainSecret: boolean
): boolean {
  if (!secretExpected.trim()) return false;
  const auth = verifyInboundWebhookAuth({
    secretExpected,
    req,
    rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
    isProduction: appEnv.node.isProduction,
    allowPlainSecret,
  });
  if (auth.ok) return false;
  res.status(401).json({ success: false, error: auth.reason || "Webhook non autorisé." });
  return true;
}

async function readAuthenticatedUser(req: Request) {
  const auth = parseAuthFromRequest(req);
  if (!auth) return null;
  return resolveAuthPayload(auth);
}

async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await readAuthenticatedUser(req);
    if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
    (req as Request & { authUser: AuthPayload }).authUser = auth;
    return next();
  } catch (error) {
    console.error("[auth] middleware user:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}

function requestAuthUser(req: Request): AuthPayload | null {
  return (req as Request & { authUser?: AuthPayload }).authUser ?? null;
}

/** Liste audits PADDE-CI : même accès que la page /admin et /superadmin (admin + commando). */
async function requirePaddeAuditViewer(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await readAuthenticatedUser(req);
    if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
    if (auth.role !== "admin" && auth.role !== "commando") {
      return res.status(403).json({ success: false, error: "Acces refuse." });
    }
    return next();
  } catch (error) {
    console.error("[auth] middleware padde audits:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}

function paddeClientNameFromPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return "";
  const lower: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    lower[key.trim().toLowerCase().replace(/[\s-]+/g, "_")] = value;
  }
  const first = (...keys: string[]): string => {
    for (const k of keys) {
      const v = lower[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  return first(
    "clientname",
    "client_name",
    "nom",
    "name",
    "entreprise",
    "company",
    "company_name",
    "societe",
    "organization"
  );
}

/** Application Express (routes `/api/*`, `/health`) sans `listen` — utilisée par `startServer` et par le dev unifié Next+API. */
export async function createExpressApplication(): Promise<{ app: Express; port: number }> {
  assertSecureStartup();

  const app = express();
  const port = appEnv.http.port;
  const corsReport = buildStrictCorsOrigins(appEnv.http.corsOriginRaw);
  const corsOrigins = corsReport.origins;
  const paddeAllowedOrigins = new Set(["https://padde-ci.com", "https://www.padde-ci.com"]);
  const noyaAllowedOrigins = new Set(["https://noyaindustries.com", "https://www.noyaindustries.com"]);
  const paddeWebhookSecret = appEnv.webhooks.paddeWebhookSecret;
  const noyaWebhookSecret = appEnv.webhooks.noyaRecrutementWebhookSecret;
  const allowPlainWebhookSecret =
    appEnv.node.isDevelopment || process.env.WEBHOOK_ALLOW_PLAIN_SECRET === "1";
  const stripeSecretKey = appEnv.stripe.secretKey;
  const stripeWebhookSecret = appEnv.stripe.webhookSecret;
  const r2AccountId = appEnv.r2.accountId;
  const r2AccessKeyId = appEnv.r2.accessKeyId;
  const r2SecretAccessKey = appEnv.r2.secretAccessKey;
  const r2Bucket = appEnv.r2.bucket;
  const r2PublicBaseUrl = appEnv.r2.publicBaseUrl;
  const r2Endpoint =
    appEnv.r2.endpointRaw || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : "");
  const canUseR2 = Boolean(r2Endpoint && r2AccessKeyId && r2SecretAccessKey && r2Bucket);
  const canUseBlob = hasBlobConfig();
  const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const canUseLocalDiskFallback = !isServerlessRuntime;

  if (canUseBlob) {
    console.log("[upload] Vercel Blob actif (prioritaire sur R2).");
  } else if (!canUseR2) {
    console.warn(
      "[upload] Variables R2 absentes — mode développement : fichiers dans .local-uploads/ (non utilisé en prod sans R2 ni Blob)."
    );
  }
  const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    })
    : null;
  const appBaseUrl = resetAppBaseUrl();

  const resolveStripeCustomerId = async (auth: { uid: string; email: string }) => {
    if (!stripe) return null;
    const userRow = await prisma.dataDocument.findUnique({
      where: {
        collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: auth.uid },
      },
    });
    const userData = readDataRowAsRecord(userRow?.data);
    const existingCustomerId = String(userData.stripeCustomerId || "").trim();
    if (existingCustomerId) return existingCustomerId;

    const listed = await stripe.customers.list({
      email: auth.email,
      limit: 1,
    });
    let customerId = listed.data[0]?.id || "";
    if (!customerId) {
      const created = await stripe.customers.create({
        email: auth.email,
        metadata: { userId: auth.uid },
      });
      customerId = created.id;
    }

    await prisma.dataDocument.upsert({
      where: {
        collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: auth.uid },
      },
      create: {
        collectionPath: USERS_COLLECTION_PATH,
        docId: auth.uid,
        data: {
          uid: auth.uid,
          email: auth.email,
          role: "client",
          stripeCustomerId: customerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as never,
      },
      update: {
        data: {
          ...userData,
          stripeCustomerId: customerId,
          updatedAt: new Date().toISOString(),
        } as never,
      },
    });
    return customerId;
  };

  applySecurityHeaders(app);
  app.use(
    cors({
      origin(origin, callback) {
        // Autorise les appels serveur-serveur et les fronts explicitement listés.
        if (!origin || corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        agentSessionLog({
          hypothesisId: "H6",
          location: "server.ts:cors",
          message: "cors_origin_rejected",
          data: { origin, allowedOriginsCount: corsOrigins.length },
        });
        /** `false` sans Error : évite des 500 / preflight bizarres côté navigateur. */
        return callback(null, false);
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT", "HEAD"],
      // Inclure X-Webhook-Secret : sans lui, les POST cross-origin depuis padde-ci.com
      // vers /api/webhooks/padde-ci/direct échouent au préflight (navigateur).
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Webhook-Secret",
        "X-Webhook-Signature",
        "X-CSRF-Token",
      ],
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: "1mb",
      strict: true,
      verify: (req, _res, buf) => {
        const path = req.url || "";
        if (path.startsWith("/api/stripe/webhook") || path.startsWith("/api/webhooks/")) {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        }
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
    })
  );

  app.use((req, res, next) => {
    const requestId = randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const routePath = (req.path || req.url?.split("?")[0] || "").slice(0, 160);
    const requestId = String(req.headers["x-request-id"] || "unknown");
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      logHttpRequest({
        method: req.method || "GET",
        path: routePath,
        statusCode: res.statusCode,
        durationMs,
        requestId,
      });
      // #region agent log
      agentSessionLog({
        hypothesisId: "H5",
        location: "server.ts:request_timing",
        message: "express_request_finish",
        data: {
          method: req.method,
          path: routePath,
          status: res.statusCode,
          durationMs,
          requestId,
        },
      });
      // #endregion
    });
    next();
  });

  applySensitiveRateLimits(app);
  applyCsrfProtection(app, corsOrigins);

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      nodeEnv: appEnv.node.env,
      localHttpDev: !resetAppBaseUrl().startsWith("https://"),
      e2eSkipLoginVerification: process.env.E2E_SKIP_LOGIN_VERIFICATION === "1",
      config: {
        databaseUrl: Boolean(appEnv.database.url),
        jwtSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim() || process.env.JWT_SECRET?.trim()),
        paddeWebhookSecret: Boolean(appEnv.webhooks.paddeWebhookSecret),
        saasBridgeApiKey: Boolean(process.env.SAAS_BRIDGE_API_KEY?.trim()),
        corsOrigin: Boolean(appEnv.http.corsOriginRaw),
        googleClientId: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()),
        rateLimitEnabled: isRateLimitEnabled(),
      },
    });
  });

  app.get("/api/apps/catalog", async (_req, res) => {
    try {
      const stored = await loadAppCatalog();
      const apps = mergeCatalogWithDefaults(stored);
      return res.status(200).json({ success: true, apps });
    } catch (error) {
      console.error("[apps/catalog GET]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.put("/api/apps/catalog", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      if (auth.role !== "admin") {
        return res.status(403).json({ success: false, error: "Acces reserve a l'administrateur." });
      }
      const rawApps = (req.body as { apps?: unknown })?.apps;
      const parsed = parseAppCatalogEntries(rawApps);
      if (!parsed.length) {
        return res.status(400).json({ success: false, error: "Catalogue invalide." });
      }
      const apps = await saveAppCatalog(parsed);
      return res.status(200).json({ success: true, apps });
    } catch (error) {
      console.error("[apps/catalog PUT]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/apps/appointment", async (req, res) => {
    try {
      const parsed = parseAppointmentBody((req.body ?? {}) as Record<string, unknown>);
      if (!parsed.ok) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      const {
        appId,
        appTitle,
        firstName,
        lastName,
        phone,
        email,
        companyName,
        preferredDate,
        message,
      } = parsed.data;

      const createdAt = new Date().toISOString();
      const leadId = randomUUID().replace(/-/g, "");
      const noteParts = [
        `Demande RDV — ${appTitle || appId}`,
        preferredDate ? `Date souhaitée : ${preferredDate}` : "",
        message || "",
      ].filter(Boolean);

      await prisma.dataDocument.create({
        data: {
          collectionPath: "leads",
          docId: leadId,
          data: {
            id: leadId,
            source: "app-appointment",
            appId,
            appTitle: appTitle || appId,
            firstName,
            lastName,
            email: email || undefined,
            whatsapp: phone,
            phone,
            companyName: companyName || "Non renseigné",
            status: "soumis",
            urgency: "moyenne",
            note: noteParts.join("\n"),
            preferredDate: preferredDate || undefined,
            createdAt,
          } as never,
        },
      });

      const teamRows = await prisma.dataDocument.findMany({
        where: { collectionPath: USERS_COLLECTION_PATH },
      });
      const teamIds = teamRows
        .map((row) => {
          const data = readDataRowAsRecord(row.data);
          const role = String(data.role || "").toLowerCase();
          if (role !== "commando" && role !== "admin") return null;
          const uid = String(data.uid || row.docId || "").trim();
          return uid || null;
        })
        .filter((v): v is string => Boolean(v));

      const title = "Nouveau rendez-vous application";
      const notifMessage = `${firstName} ${lastName} — ${appTitle || appId}${companyName ? ` (${companyName})` : ""} — ${phone}${preferredDate ? ` — ${preferredDate}` : ""}`;

      await Promise.all(
        teamIds.map((uid) =>
          prisma.dataDocument.create({
            data: {
              collectionPath: NOTIFICATIONS_COLLECTION_PATH,
              docId: randomUUID().replace(/-/g, ""),
              data: {
                userId: uid,
                title,
                message: notifMessage,
                type: "order",
                read: false,
                createdAt,
                metadata: { leadId, appId, source: "app-appointment" },
              } as never,
            },
          })
        )
      );

      void sendStaffNotifyEmail({
        subject: `[Infinite Core] ${title}`,
        text: [notifMessage, "", `Lead : ${leadId}`, noteParts.join("\n")].join("\n"),
      }).catch((err) => console.warn("[apps/appointment] staff email:", err));

      return res.status(200).json({ success: true, leadId });
    } catch (error) {
      console.error("[apps/appointment]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  registerMongoApi(app);

  app.post("/api/stripe/checkout/subscription", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      if (!stripe) {
        return res.status(503).json({
          success: false,
          error: "Stripe non configuré. Ajoutez STRIPE_SECRET_KEY.",
        });
      }

      const validated = OrderSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ success: false, error: "Paramètres abonnement invalides.", details: validated.error.format() });
      }
      const { serviceId, note = "", billingCycle } = validated.data;
      const billing = normalizeBillingCycle(billingCycle);
      if (!billing) {
        return res.status(400).json({ success: false, error: "Cycle de facturation invalide." });
      }
      const catalog = await loadAppCatalog();
      const priced = resolveCatalogSubscriptionCheckout(catalog, serviceId, billing);
      if (!priced.ok) {
        return res.status(400).json({ success: false, error: priced.error });
      }
      const { unitAmount, serviceName, moduleKey } = priced;
      const orderId = `CMD-${randomUUID().split("-")[0].toUpperCase()}`;
      const customerId = await resolveStripeCustomerId({ uid: auth.uid, email: auth.email });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: `${appBaseUrl}/dashboard/boutique?checkout=success&orderId=${encodeURIComponent(orderId)}&type=subscription`,
        cancel_url: `${appBaseUrl}/dashboard/boutique?checkout=cancel&orderId=${encodeURIComponent(orderId)}`,
        customer: customerId || undefined,
        customer_email: customerId ? undefined : auth.email,
        metadata: {
          orderId,
          userId: auth.uid,
          serviceId,
          appId: serviceId,
          appName: serviceName,
          moduleKey,
          billingCycle: billing,
          licenseType: "subscription",
        },
        subscription_data: {
          metadata: {
            orderId,
            userId: auth.uid,
            serviceId,
            appId: serviceId,
            moduleKey,
            licenseType: "subscription",
          },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "xof",
              unit_amount: unitAmount,
              recurring: { interval: billing },
              product_data: {
                name: `${serviceName} — Abonnement SaaS`,
                description: "Abonnement mensuel — application en ligne hébergée par Infinite Core (SaaS multi-tenant).",
                metadata: { serviceId },
              },
            },
          },
        ],
      });

      await prisma.dataDocument.upsert({
        where: {
          collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: orderId },
        },
        create: {
          collectionPath: ORDERS_COLLECTION_PATH,
          docId: orderId,
          data: {
            id: orderId,
            userId: auth.uid,
            clientEmail: auth.email,
            serviceName,
            serviceId,
            moduleKey,
            orderType: "abonnement",
            isSubscription: true,
            billingCycle: billing,
            amount: unitAmount,
            currency: "XOF",
            note: note || null,
            status: "Paiement en cours",
            subscriptionStatus: "checkout_pending",
            stripeCheckoutSessionId: session.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as never,
        },
        update: {
          data: {
            id: orderId,
            userId: auth.uid,
            clientEmail: auth.email,
            serviceName,
            serviceId,
            moduleKey,
            orderType: "abonnement",
            isSubscription: true,
            billingCycle: billing,
            amount: unitAmount,
            currency: "XOF",
            note: note || null,
            status: "Paiement en cours",
            subscriptionStatus: "checkout_pending",
            stripeCheckoutSessionId: session.id,
            updatedAt: new Date().toISOString(),
          } as never,
        },
      });

      return res.status(200).json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        orderId,
      });
    } catch (error) {
      console.error("[stripe/checkout/subscription]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/stripe/checkout/license", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      if (!stripe) {
        return res.status(503).json({
          success: false,
          error: "Stripe non configuré. Ajoutez STRIPE_SECRET_KEY.",
        });
      }

      const validated = LicenseCheckoutSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({
          success: false,
          error: "Paramètres licence invalides.",
          details: validated.error.format(),
        });
      }

      const { appId, licenseDurationDays, note = "" } = validated.data;
      const catalog = await loadAppCatalog();
      const priced = resolveCatalogLicenseCheckout(catalog, appId, licenseDurationDays);
      if (!priced.ok) {
        return res.status(400).json({ success: false, error: priced.error });
      }
      const { unitAmount, appName, moduleKey, licenseDurationDays: durationDays } = priced;
      const orderId = `CMD-${randomUUID().split("-")[0].toUpperCase()}`;
      const customerId = await resolveStripeCustomerId({ uid: auth.uid, email: auth.email });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appBaseUrl}/dashboard/boutique?checkout=success&orderId=${encodeURIComponent(orderId)}&type=license`,
        cancel_url: `${appBaseUrl}/dashboard/boutique?checkout=cancel&orderId=${encodeURIComponent(orderId)}`,
        customer: customerId || undefined,
        customer_email: customerId ? undefined : auth.email,
        metadata: {
          orderId,
          userId: auth.uid,
          serviceId: appId,
          appId,
          appName,
          moduleKey,
          licenseType: "license",
          licenseDurationDays: String(durationDays),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "xof",
              unit_amount: unitAmount,
              product_data: {
                name:
                  durationDays === 0
                    ? `${appName} — Licence à vie (auto-hébergée)`
                    : `${appName} — Licence`,
                description:
                  durationDays === 0
                    ? "Licence à vie — le client héberge l'application."
                    : undefined,
                metadata: { appId, moduleKey },
              },
            },
          },
        ],
      });

      await prisma.dataDocument.upsert({
        where: {
          collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: orderId },
        },
        create: {
          collectionPath: ORDERS_COLLECTION_PATH,
          docId: orderId,
          data: {
            id: orderId,
            userId: auth.uid,
            clientEmail: auth.email,
            serviceName: appName,
            serviceId: appId,
            moduleKey,
            orderType: "licence",
            isSubscription: false,
            licenseDurationDays: durationDays,
            amount: unitAmount,
            currency: "XOF",
            note: note || null,
            status: "Paiement en cours",
            paymentStatus: "pending",
            stripeCheckoutSessionId: session.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as never,
        },
        update: {
          data: {
            id: orderId,
            userId: auth.uid,
            clientEmail: auth.email,
            serviceName: appName,
            serviceId: appId,
            moduleKey,
            orderType: "licence",
            isSubscription: false,
            licenseDurationDays: durationDays,
            amount: unitAmount,
            currency: "XOF",
            note: note || null,
            status: "Paiement en cours",
            paymentStatus: "pending",
            stripeCheckoutSessionId: session.id,
            updatedAt: new Date().toISOString(),
          } as never,
        },
      });

      return res.status(200).json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        orderId,
      });
    } catch (error) {
      console.error("[stripe/checkout/license]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/orders/notify-team", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const orderId = String(body.orderId || "").trim();
      const serviceName = String(body.serviceName || "").trim();
      const note = String(body.note || "").trim();
      const isSubscription = body.isSubscription === true;
      const billingCycle = body.billingCycle ? String(body.billingCycle) : null;
      const stripeUnavailable = body.stripeUnavailable === true;

      if (!orderId || !serviceName) {
        return res.status(400).json({ success: false, error: "Paramètres manquants." });
      }

      // Vérifie que la commande appartient bien à l'utilisateur authentifié (ou qu'il est admin/commando).
      const orderRow = await prisma.dataDocument.findUnique({
        where: {
          collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: orderId },
        },
      });
      if (!orderRow) {
        return res.status(404).json({ success: false, error: "Commande introuvable." });
      }
      const orderData = readDataRowAsRecord(orderRow.data);
      const orderOwnerId = String(orderData.userId || "");
      if (orderOwnerId !== auth.uid && auth.role !== "admin" && auth.role !== "commando") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      const clientName =
        String(orderData.clientName || "").trim() ||
        String(orderData.clientEmail || "").trim() ||
        auth.email ||
        "Client";

      const teamRows = await prisma.dataDocument.findMany({
        where: { collectionPath: USERS_COLLECTION_PATH },
      });
      const teamIds = teamRows
        .map((row) => {
          const data = readDataRowAsRecord(row.data);
          const role = String(data.role || "").toLowerCase();
          if (role !== "commando" && role !== "admin") return null;
          const uid = String(data.uid || row.docId || "").trim();
          return uid || null;
        })
        .filter((v): v is string => Boolean(v));

      const subLine = isSubscription
        ? ` — Abonnement ${billingCycle || "mensuel"}${stripeUnavailable ? " (paiement manuel, Stripe indisponible)" : ""}`
        : "";
      const title = "Nouvelle commande boutique";
      const message = `${clientName} : ${serviceName}${subLine}${note ? ` — Note : ${note.slice(0, 140)}` : ""}`;

      const now = new Date().toISOString();
      let created = 0;
      await Promise.all(
        teamIds.map(async (uid) => {
          const notifId = randomUUID();
          await prisma.dataDocument.create({
            data: {
              collectionPath: NOTIFICATIONS_COLLECTION_PATH,
              docId: notifId,
              data: {
                id: notifId,
                userId: uid,
                title,
                message,
                type: "order",
                read: false,
                createdAt: now,
                metadata: {
                  orderId,
                  clientId: orderOwnerId,
                  serviceName,
                  isSubscription,
                  billingCycle,
                  stripeUnavailable,
                },
              } as never,
            },
          });
          created += 1;
        })
      );

      const clientEmailLine = String(orderData.clientEmail || auth.email || "").trim();
      void sendStaffNotifyEmail({
        subject: `[Infinite Core] ${title}`,
        text: [
          message,
          "",
          `Commande : ${orderId}`,
          `Client : ${clientName}`,
          clientEmailLine ? `E-mail : ${clientEmailLine}` : "",
          `Abonnement : ${isSubscription ? "oui" : "non"}${isSubscription ? ` (${billingCycle || "mensuel"})` : ""}`,
          stripeUnavailable ? "Paiement manuel (Stripe indisponible)." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      }).catch((err) => console.warn("[orders/notify-team] staff email:", err));

      return res.status(200).json({ success: true, notified: created });
    } catch (error) {
      console.error("[orders/notify-team]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/saas/webhooks/subscription-active", async (req, res) => {
    try {
      if (!verifySaasBridgeAuth(String(req.headers["x-infinitecore-saas-key"] || ""))) {
        return res.status(401).json({ success: false, error: "Clé API invalide." });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const userId = String(body.userId || "").trim();
      const appId = String(body.appId || "").trim();
      if (!userId || !appId) {
        return res.status(400).json({ success: false, error: "userId et appId requis." });
      }
      const license = await upsertExternalSubscriptionLicense({
        userId,
        appId,
        moduleKey: String(body.moduleKey || "").trim() || undefined,
        appName: String(body.appName || "").trim() || undefined,
        tenantId: String(body.tenantId || "").trim() || undefined,
        expiresAt: body.expiresAt ? String(body.expiresAt) : null,
      });
      return res.status(200).json({ success: true, license });
    } catch (error) {
      console.error("[saas/webhooks/subscription-active]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/saas/webhooks/tenant-ready", async (req, res) => {
    try {
      if (!verifySaasBridgeAuth(String(req.headers["x-infinitecore-saas-key"] || ""))) {
        return res.status(401).json({ success: false, error: "Clé API invalide." });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const userId = String(body.userId || "").trim();
      const appId = String(body.appId || "").trim();
      if (!userId || !appId) {
        return res.status(400).json({ success: false, error: "userId et appId requis." });
      }
      const license = await confirmSaasTenantReady({
        userId,
        appId,
        tenantId: String(body.tenantId || "").trim() || undefined,
      });
      if (!license) {
        return res.status(404).json({ success: false, error: "Abonnement introuvable." });
      }
      return res.status(200).json({ success: true, license });
    } catch (error) {
      console.error("[saas/webhooks/tenant-ready]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/saas/access-token", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      const appId = String(req.query.appId || "").trim();
      if (!appId) {
        return res.status(400).json({ success: false, error: "appId requis." });
      }
      const catalog = await loadAppCatalog();
      const catalogApp = catalog.find((a) => a.id === appId);
      if (!catalogApp) {
        return res.status(404).json({ success: false, error: "Application introuvable." });
      }
      if (isExternalSaasBilling(catalogApp)) {
        return res.status(400).json({
          success: false,
          error: "Cette application utilise le paiement externe — pas de jeton Infinite Core.",
        });
      }
      const docId = licenseDocId(auth.uid, appId);
      const row = await prisma.dataDocument.findUnique({
        where: {
          collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
        },
      });
      if (!row) {
        return res.status(403).json({ success: false, error: "Abonnement actif requis." });
      }
      const license = readDataRowAsRecord(row.data) as unknown as AppLicense;
      if (license.type !== "subscription" || !isLicenseActive(license)) {
        return res.status(403).json({ success: false, error: "Abonnement actif requis." });
      }
      const tenantId = resolveSaasTenantId(license);
      const token = signSaasAccessToken({
        uid: auth.uid,
        appId,
        moduleKey: license.moduleKey || catalogApp.moduleKey,
        tenantId,
        email: auth.email,
        stripeSubscriptionId: license.stripeSubscriptionId ?? null,
      });
      return res.status(200).json({ success: true, token, tenantId, expiresIn: 7200 });
    } catch (error) {
      console.error("[saas/access-token]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/saas/verify-token", async (req, res) => {
    try {
      const bridgeKey = String(process.env.SAAS_BRIDGE_API_KEY || "").trim();
      if (bridgeKey) {
        const provided = String(req.headers["x-infinitecore-saas-key"] || "").trim();
        if (!provided || !secureSecretEquals(bridgeKey, provided)) {
          return res.status(401).json({ success: false, error: "Clé API invalide." });
        }
      }
      const token = String(req.query.token || "").trim();
      if (!token) {
        return res.status(400).json({ success: false, error: "token requis." });
      }
      const payload = verifySaasAccessToken(token);
      if (!payload) {
        return res.status(401).json({ success: false, valid: false, error: "Jeton invalide ou expiré." });
      }
      const docId = licenseDocId(payload.uid, payload.appId);
      const row = await prisma.dataDocument.findUnique({
        where: {
          collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
        },
      });
      if (!row) {
        return res.status(200).json({ success: true, valid: false, error: "Abonnement introuvable." });
      }
      const license = readDataRowAsRecord(row.data) as unknown as AppLicense;
      const active = license.type === "subscription" && isLicenseActive(license);
      return res.status(200).json({
        success: true,
        valid: active,
        userId: payload.uid,
        appId: payload.appId,
        moduleKey: payload.moduleKey,
        tenantId: payload.tenantId,
        email: payload.email ?? null,
        stripeSubscriptionId: payload.stripeSubscriptionId ?? null,
      });
    } catch (error) {
      console.error("[saas/verify-token]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/admin/saas/provision", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      if (auth.role !== "admin" && auth.role !== "commando") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const userId = String(body.userId || "").trim();
      const appId = String(body.appId || "").trim();
      const saasInstanceUrl = String(body.saasInstanceUrl || "").trim();
      const saasTenantId = String(body.saasTenantId || "").trim();
      if (!userId || !appId || (!saasInstanceUrl && !saasTenantId)) {
        return res.status(400).json({
          success: false,
          error: "userId, appId et (saasInstanceUrl ou saasTenantId) requis.",
        });
      }
      if (saasInstanceUrl) {
        try {
          new URL(saasInstanceUrl);
        } catch {
          return res.status(400).json({ success: false, error: "URL SaaS invalide." });
        }
      }
      const license = await provisionSaasLicense({
        userId,
        appId,
        saasInstanceUrl: saasInstanceUrl || undefined,
        saasTenantId: saasTenantId || undefined,
      });
      if (!license) {
        return res.status(404).json({ success: false, error: "Abonnement introuvable pour cet utilisateur." });
      }
      return res.status(200).json({ success: true, license });
    } catch (error) {
      console.error("[admin/saas/provision]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/stripe/billing-portal-session", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
      if (!stripe) {
        return res.status(503).json({
          success: false,
          error: "Stripe non configuré. Ajoutez STRIPE_SECRET_KEY.",
        });
      }
      const customerId = await resolveStripeCustomerId({ uid: auth.uid, email: auth.email });
      if (!customerId) {
        return res.status(400).json({ success: false, error: "Client Stripe introuvable." });
      }
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appBaseUrl}/dashboard/boutique`,
      });
      return res.status(200).json({
        success: true,
        url: portalSession.url,
      });
    } catch (error) {
      console.error("[stripe/billing-portal-session]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ success: false, error: "Stripe non configuré." });
      }

      let event: Stripe.Event;
      const signature = req.headers["stripe-signature"];
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (stripeWebhookSecret) {
        if (typeof signature !== "string" || !rawBody) {
          return res.status(400).json({ success: false, error: "Webhook Stripe invalide." });
        }
        event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
      } else {
        event = req.body as Stripe.Event;
      }

      const upsertOrderPatch = async (orderId: string, patch: Record<string, unknown>) => {
        const existing = await prisma.dataDocument.findUnique({
          where: {
            collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: orderId },
          },
        });
        if (!existing) return;
        const current = readDataRowAsRecord(existing.data);
        await prisma.dataDocument.update({
          where: {
            collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: orderId },
          },
          data: {
            data: {
              ...current,
              ...patch,
              updatedAt: new Date().toISOString(),
            } as never,
          },
        });
      };

      const updateBySubscriptionId = async (subscriptionId: string, patch: Record<string, unknown>) => {
        const rows = await prisma.dataDocument.findMany({
          where: { collectionPath: ORDERS_COLLECTION_PATH },
          take: 5000,
        });
        for (const row of rows) {
          const data = readDataRowAsRecord(row.data);
          if (String(data.subscriptionId || "") !== subscriptionId) continue;
          await upsertOrderPatch(row.docId, patch);
        }
      };

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = String(session.metadata?.orderId || "").trim();
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : String(session.subscription?.id || "");
          const userId = String(session.metadata?.userId || "").trim();
          const appId = String(session.metadata?.appId || session.metadata?.serviceId || "").trim();
          const moduleKey = String(session.metadata?.moduleKey || appId).trim();
          const appName = String(session.metadata?.appName || session.metadata?.serviceId || appId).trim();
          const licenseTypeRaw = String(session.metadata?.licenseType || "").trim();
          const licenseType =
            licenseTypeRaw === "license" || session.mode === "payment" ? "license" : "subscription";
          const licenseDurationDays = Number.parseInt(
            String(session.metadata?.licenseDurationDays ?? "0"),
            10
          );

          if (orderId) {
            await upsertOrderPatch(orderId, {
              status: "Actif",
              paymentStatus: "paid",
              stripeCheckoutSessionId: session.id,
              subscriptionId: subscriptionId || null,
              stripeCustomerId: session.customer ? String(session.customer) : null,
              subscriptionStatus: licenseType === "subscription" ? "active" : null,
              activatedAt: new Date().toISOString(),
            });
          }

          if (userId && appId && moduleKey) {
            await activateLicenseFromCheckoutSession({
              userId,
              appId,
              moduleKey,
              appName,
              orderId,
              checkoutSessionId: session.id,
              licenseType,
              subscriptionId: subscriptionId || null,
              licenseDurationDays: Number.isFinite(licenseDurationDays) ? licenseDurationDays : 0,
            });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const subscriptionId = String(sub.id || "").trim();
          const rawSub = sub as unknown as { current_period_end?: number; canceled_at?: number | null };
          const periodEnd =
            typeof rawSub.current_period_end === "number"
              ? new Date(rawSub.current_period_end * 1000).toISOString()
              : null;
          const isCanceled = event.type === "customer.subscription.deleted" || sub.status === "canceled";
          if (subscriptionId) {
            await updateBySubscriptionId(subscriptionId, {
              status: subscriptionStatusFromStripe(sub.status),
              subscriptionStatus: sub.status,
              currentPeriodEnd: periodEnd,
              canceledAt:
                typeof rawSub.canceled_at === "number"
                  ? new Date(rawSub.canceled_at * 1000).toISOString()
                  : null,
            });
            await patchLicenseBySubscriptionId(subscriptionId, {
              status: isCanceled ? "expired" : sub.status === "active" || sub.status === "trialing" ? "active" : "suspended",
              expiresAt: periodEnd,
              saasProvisioningStatus: isCanceled
                ? "suspended"
                : sub.status === "active" || sub.status === "trialing"
                  ? "ready"
                  : "suspended",
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const rawInvoice = invoice as unknown as {
            subscription?: string | { id?: string | null } | null;
          };
          const subscriptionId =
            typeof rawInvoice.subscription === "string"
              ? rawInvoice.subscription
              : String(rawInvoice.subscription?.id || "");
          if (subscriptionId) {
            await updateBySubscriptionId(subscriptionId, {
              status: "Impayé",
              paymentStatus: "failed",
              subscriptionStatus: "past_due",
            });
            await patchLicenseBySubscriptionId(subscriptionId, {
              status: "suspended",
              saasProvisioningStatus: "suspended",
            });
          }
          break;
        }
        default:
          break;
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("[stripe/webhook]", error);
      return res.status(400).json({ success: false, error: "Webhook Stripe invalide." });
    }
  });

  const s3 = canUseR2
    ? new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    })
    : null;

  app.post("/api/files/upload", requireAuthenticatedUser, uploadSingleWithHandling, async (req, res) => {
    try {
      const auth = requestAuthUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });

      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier reçu." });
      }
      if (!isAllowedUpload(req.file)) {
        return res.status(415).json({
          success: false,
          error: "Type de fichier non autorisé. Formats acceptés: PDF, Office, JPG/PNG/WEBP, TXT/CSV, ZIP.",
        });
      }

      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${safeOriginal}`;

      if (canUseBlob) {
        const publicAccess = blobFolderIsPublic(folder);
        const { url: blobUrl, pathname } = await putBlobObject({
          pathname: objectKey,
          body: req.file.buffer,
          contentType: req.file.mimetype || "application/octet-stream",
          publicAccess,
        });
        await registerUploadedFile(pathname, auth.uid, folder, {
          storageBackend: "blob",
          storageUrl: blobUrl,
          publicAccess,
        });
        const fileUrl = publicAccess ? blobUrl : buildFileUrl(pathname);
        return res.status(200).json({
          success: true,
          url: fileUrl,
          publicId: pathname,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      }

      if (canUseR2 && s3) {
        await s3.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: objectKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || "application/octet-stream",
            ContentDisposition: `inline; filename="${safeOriginal}"`,
          })
        );

        const fileUrl = r2PublicBaseUrl
          ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
          : buildFileUrl(objectKey);

        await registerUploadedFile(objectKey, auth.uid, folder, { storageBackend: "r2" });

        return res.status(200).json({
          success: true,
          url: fileUrl,
          publicId: objectKey,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      }

      if (!canUseLocalDiskFallback) {
        if (req.file.size > MAX_DB_FALLBACK_BYTES) {
          return res.status(413).json({
            success: false,
            error:
              "Fichier trop volumineux pour le fallback sans R2 (max 8 MB). " +
              "Réduisez la taille ou configurez R2 pour les gros fichiers.",
          });
        }
        const dbPublicId = `${DB_FILE_PUBLIC_ID_PREFIX}${objectKey}`;
        await prisma.dataDocument.upsert({
          where: {
            collectionPath_docId: { collectionPath: DB_FILE_COLLECTION_PATH, docId: objectKey },
          },
          create: {
            collectionPath: DB_FILE_COLLECTION_PATH,
            docId: objectKey,
            data: {
              contentBase64: req.file.buffer.toString("base64"),
              originalName: req.file.originalname,
              mimetype: req.file.mimetype || "application/octet-stream",
              size: req.file.size,
              ownerUid: auth.uid,
            } as never,
          },
          update: {
            data: {
              contentBase64: req.file.buffer.toString("base64"),
              originalName: req.file.originalname,
              mimetype: req.file.mimetype || "application/octet-stream",
              size: req.file.size,
              ownerUid: auth.uid,
            } as never,
          },
        });
        await registerUploadedFile(dbPublicId, auth.uid, folder, { storageBackend: "db" });
        return res.status(200).json({
          success: true,
          url: buildFileUrl(dbPublicId),
          publicId: dbPublicId,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      }

      // Sans R2 : stockage local (développement / secours)
      const absPath = resolveLocalUploadFile(objectKey);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin de fichier invalide." });
      }
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, req.file.buffer);
      await registerUploadedFile(objectKey, auth.uid, folder, { storageBackend: "local" });

      const fileUrl = buildFileUrl(objectKey);
      return res.status(200).json({
        success: true,
        url: fileUrl,
        publicId: objectKey,
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      console.error("Erreur upload API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.delete("/api/files", requireAuthenticatedUser, async (req, res) => {
    try {
      const auth = requestAuthUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });

      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }

      const catalog = await loadAppCatalog();
      const access = await assertFileAccess(auth, safePath, { catalog });
      if (!access.ok) {
        return res.status(access.status).json({ success: false, error: access.error });
      }

      if (isDbStoredPublicId(safePath)) {
        const docId = dbDocIdFromPublicId(safePath);
        if (!docId) {
          return res.status(400).json({ success: false, error: "publicId invalide." });
        }
        await prisma.dataDocument.deleteMany({
          where: { collectionPath: DB_FILE_COLLECTION_PATH, docId },
        });
        await removeFileRegistryEntry(safePath);
        return res.status(200).json({ success: true });
      }

      const registryEntry = await getFileRegistryEntry(safePath);
      if (registryEntry?.storageBackend === "blob" && registryEntry.storageUrl) {
        await deleteBlobObject(registryEntry.storageUrl);
        await removeFileRegistryEntry(safePath);
        return res.status(200).json({ success: true });
      }

      if (canUseR2 && s3) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: r2Bucket,
            Key: safePath,
          })
        );
        await removeFileRegistryEntry(safePath);
        return res.status(200).json({ success: true });
      }
      if (!canUseLocalDiskFallback) {
        return res.status(404).json({ success: false, error: "Fichier introuvable." });
      }

      const absPath = resolveLocalUploadFile(safePath);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin invalide." });
      }
      try {
        await fs.unlink(absPath);
      } catch (e: unknown) {
        const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
        if (code !== "ENOENT") throw e;
      }
      await removeFileRegistryEntry(safePath);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erreur suppression API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/files/download", requireAuthenticatedUser, async (req, res) => {
    try {
      const auth = requestAuthUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });

      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }

      const catalog = await loadAppCatalog();
      const access = await assertFileAccess(auth, safePath, { catalog });
      if (!access.ok) {
        return res.status(access.status).json({ success: false, error: access.error });
      }

      if (isDbStoredPublicId(safePath)) {
        const docId = dbDocIdFromPublicId(safePath);
        if (!docId) {
          return res.status(400).json({ success: false, error: "publicId invalide." });
        }
        const row = await prisma.dataDocument.findUnique({
          where: { collectionPath_docId: { collectionPath: DB_FILE_COLLECTION_PATH, docId } },
        });
        if (!row) {
          return res.status(404).json({ success: false, error: "Fichier introuvable." });
        }
        const data = (row.data as Record<string, unknown>) || {};
        const encoded = typeof data.contentBase64 === "string" ? data.contentBase64 : "";
        if (!encoded) {
          return res.status(404).json({ success: false, error: "Fichier introuvable." });
        }
        const mimetype = typeof data.mimetype === "string" ? data.mimetype : mimeFromStorageKey(docId);
        const originalName =
          typeof data.originalName === "string" && data.originalName.trim().length > 0
            ? data.originalName
            : path.basename(docId);
        const buffer = Buffer.from(encoded, "base64");
        res.setHeader("Content-Type", mimetype);
        res.setHeader(
          "Content-Disposition",
          contentDispositionForDownload(docId, originalName, mimetype)
        );
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.status(200).send(buffer);
      }

      const registryEntry = await getFileRegistryEntry(safePath);
      if (registryEntry?.storageBackend === "blob" && registryEntry.storageUrl) {
        if (registryEntry.publicAccess) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.redirect(302, registryEntry.storageUrl);
        }
        const { stream, contentType } = await streamBlobObject(registryEntry.storageUrl);
        const filename = path.basename(safePath).replace(/"/g, "");
        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          contentDispositionForDownload(safePath, filename, contentType)
        );
        res.setHeader("Cache-Control", "private, max-age=3600");
        stream.on("error", (err) => {
          console.error("[api/files/download] lecture Blob:", registryEntry.storageUrl, err?.message);
          if (!res.headersSent) {
            res.status(404).json({ success: false, error: "Fichier introuvable." });
          } else {
            res.destroy(err);
          }
        });
        stream.pipe(res);
        return;
      }

      if (!canUseR2 || !s3) {
        if (!canUseLocalDiskFallback) {
          return res.status(404).json({ success: false, error: "Fichier introuvable." });
        }
        const absPath = resolveLocalUploadFile(safePath);
        if (!absPath) {
          return res.status(400).json({ success: false, error: "Chemin invalide." });
        }
        try {
          const stat = await fs.stat(absPath);
          if (!stat.isFile()) {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
        } catch (e: unknown) {
          const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
          if (code === "ENOENT") {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
          throw e;
        }
        const filename = path.basename(safePath).replace(/"/g, "");
        const mimetype = mimeFromStorageKey(safePath);
        res.setHeader("Content-Type", mimetype);
        res.setHeader("Content-Disposition", contentDispositionForDownload(safePath, filename, mimetype));
        res.setHeader("Cache-Control", "private, max-age=3600");
        // createReadStream évite les NotFoundError du module « send » avec certains chemins Windows / encodages.
        const stream = createReadStream(absPath);
        stream.on("error", (err) => {
          console.error("[api/files/download] lecture disque:", absPath, err?.message);
          if (!res.headersSent) {
            res.status(404).json({ success: false, error: "Fichier introuvable." });
          } else {
            res.destroy(err);
          }
        });
        stream.pipe(res);
        return;
      }

      const command = new GetObjectCommand({
        Bucket: r2Bucket,
        Key: safePath,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });
      return res.redirect(signedUrl);
    } catch (error) {
      console.error("Erreur download API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  type PersistPaddeOptions = {
    /** Réutilise un auditId existant au lieu d'en générer un nouveau (mode backfill). */
    existingAuditId?: string;
    /** Saute la création du row `paddeCiAudit` (déjà présent en mode backfill). */
    skipAuditRowCreation?: boolean;
    /** Saute l'envoi de notifications (évite le spam pendant un backfill). */
    skipNotifications?: boolean;
  };

  const persistPaddeAuditToStores = async (data: unknown, options: PersistPaddeOptions = {}) => {
    const validated = PaddeAuditPayloadSchema.safeParse(data);
    if (!validated.success) {
      console.warn("[padde-ci] payload invalide (Zod):", validated.error.format());
    }
    const payload = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
    // Anciennement PADDE-{1000..9999} : collisions fréquentes → `paddeCiAudit.create` échoue (id unique)
    // et le webhook renvoie 500 sans créer la commande `orders` (admin vide).
    const auditId = options.existingAuditId?.trim() || `PADDE-${randomUUID().replace(/-/g, "")}`;
    const auditType = String(payload.type_audit || payload.type || payload.auditType || "Audit PADDE-CI").trim();

    // Recherche insensible à la casse et aux variantes (`Email`, `EMAIL_CLIENT`, `Contact Email`, etc.).
    // Les formulaires externes PADDE-CI utilisent des noms de champs variables — on normalise une seule fois.
    const lowerKeyPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      lowerKeyPayload[key.trim().toLowerCase().replace(/[\s-]+/g, "_")] = value;
    }
    const firstFilled = (...keys: string[]): unknown => {
      for (const k of keys) {
        const v = lowerKeyPayload[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return undefined;
    };

    const clientName = String(
      firstFilled("clientname", "client_name", "nom", "name", "entreprise", "company", "company_name") ??
        "Client PADDE-CI"
    ).trim();
    const normalizedWhatsapp = String(
      firstFilled("whatsapp", "whats_app", "telephone", "tel", "phone", "phone_number", "mobile", "contact") ?? ""
    ).trim();
    const createdAt = new Date().toISOString();
    const normalizeEmail = (value: unknown): string | null => {
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
      return raw;
    };
    const normalizeText = (value: unknown) => String(value || "").trim();
    const sanitizeIdSegment = (value: string) => value.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
    const email = normalizeEmail(
      firstFilled(
        "email",
        "email_client",
        "clientemail",
        "client_email",
        "contactemail",
        "contact_email",
        "user_email",
        "mail",
        "e_mail",
        "adresse_email",
        "adresseemail"
      )
    );
    const firstName = normalizeText(
      firstFilled("firstname", "first_name", "prenom", "prenoms", "given_name")
    );
    const lastName = normalizeText(firstFilled("lastname", "last_name", "nom_famille", "family_name"));
    const companyName = normalizeText(
      firstFilled("companyname", "company_name", "entreprise", "company", "societe", "organization")
    );

    // Journal dev/debug : utile pour identifier les champs réellement envoyés par les formulaires PADDE-CI.
    if (!appEnv.node.isProduction) {
      console.info("[padde-ci] payload reçu", {
        keys: Object.keys(payload),
        hasEmail: Boolean(email),
        hasPhone: Boolean(normalizedWhatsapp),
        auditId,
        auditType,
      });
    }

    // Création du docId stable :
    // 1) compte Infinite Core existant (même email)  → on relie l'audit au compte
    // 2) email fourni sans compte                    → docId `padde_<email>` (stable entre re-soumissions)
    // 3) email absent                                → docId `padde_<auditId>` (unique par audit, évite la perte du client)
    let linkedClientId: string;
    if (email) {
      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true },
      });
      linkedClientId = account?.uid || `padde_${sanitizeIdSegment(email)}`;
    } else {
      linkedClientId = `padde_${sanitizeIdSegment(auditId.toLowerCase())}`;
    }

    const existingUserDoc = await prisma.dataDocument.findUnique({
      where: {
        collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: linkedClientId },
      },
      select: { data: true },
    });
    const existingUserData = readDataRowAsRecord(existingUserDoc?.data);

    const [fallbackFirst = "", ...fallbackLastParts] = clientName.split(/\s+/).filter(Boolean);
    const fallbackLast = fallbackLastParts.join(" ");

    await prisma.dataDocument.upsert({
      where: {
        collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: linkedClientId },
      },
      create: {
        collectionPath: USERS_COLLECTION_PATH,
        docId: linkedClientId,
        data: {
          uid: linkedClientId,
          email: email || null,
          role: "client",
          firstName: firstName || fallbackFirst || existingUserData.firstName || "",
          lastName: lastName || fallbackLast || existingUserData.lastName || "",
          phone: normalizedWhatsapp || existingUserData.phone || "",
          companyName: companyName || existingUserData.companyName || "",
          source: "padde-ci",
          createdAt,
          updatedAt: createdAt,
        } as never,
      },
      update: {
        data: {
          ...existingUserData,
          uid: linkedClientId,
          email: email || existingUserData.email || null,
          role: "client",
          firstName: firstName || String(existingUserData.firstName || "") || fallbackFirst,
          lastName: lastName || String(existingUserData.lastName || "") || fallbackLast,
          phone: normalizedWhatsapp || String(existingUserData.phone || ""),
          companyName: companyName || String(existingUserData.companyName || ""),
          source: "padde-ci",
          updatedAt: createdAt,
        } as never,
      },
    });

    if (!options.skipAuditRowCreation) {
      await prisma.paddeCiAudit.create({
        data: {
          id: auditId,
          payload: (payload ?? {}) as never,
          processed: false,
        },
      });
    }

    await prisma.dataDocument.upsert({
      where: {
        collectionPath_docId: { collectionPath: ORDERS_COLLECTION_PATH, docId: auditId },
      },
      create: {
        collectionPath: ORDERS_COLLECTION_PATH,
        docId: auditId,
        data: {
          id: auditId,
          source: "padde-ci",
          status: "En attente",
          createdAt,
          clientId: linkedClientId,
          userId: linkedClientId,
          ...(email ? { clientEmail: email } : {}),
          clientName,
          serviceName: `Audit PADDE-CI: ${auditType}`,
          details: {
            ...payload,
            email: email || null,
            whatsapp: normalizedWhatsapp || null,
          },
        } as never,
      },
      update: {
        data: {
          id: auditId,
          source: "padde-ci",
          status: "En attente",
          createdAt,
          clientId: linkedClientId,
          userId: linkedClientId,
          ...(email ? { clientEmail: email } : {}),
          clientName,
          serviceName: `Audit PADDE-CI: ${auditType}`,
          details: {
            ...payload,
            email: email || null,
            whatsapp: normalizedWhatsapp || null,
          },
        } as never,
      },
    });

    // Notifie les équipes commando/admin du nouvel audit — non bloquant.
    // Désactivé explicitement pendant un backfill pour éviter de spammer les anciens audits.
    if (options.skipNotifications) {
      return { auditId };
    }
    try {
      const recipients = await prisma.userAccount.findMany({
        where: { role: { in: ["commando", "admin"] } },
        select: { uid: true },
      });
      const recipientIds = recipients.map((r) => r.uid).filter(Boolean);
      const finalRecipients = recipientIds.length > 0 ? recipientIds : ["admin_general"];
      const notifMessage = `${clientName} a soumis un audit ${auditType}${
        normalizedWhatsapp ? ` — ${normalizedWhatsapp}` : ""
      }${email ? ` — ${email}` : ""}`;
      await Promise.all(
        finalRecipients.map((recipientId) =>
          prisma.dataDocument.create({
            data: {
              collectionPath: "notifications",
              docId: randomUUID().replace(/-/g, ""),
              data: {
                userId: recipientId,
                title: "Nouveau flux PADDE-CI",
                message: notifMessage,
                type: "order",
                read: false,
                createdAt,
                metadata: {
                  source: "padde-ci",
                  auditId,
                  auditType,
                  clientId: linkedClientId,
                  clientEmail: email,
                  whatsapp: normalizedWhatsapp,
                  link: "/admin/audits-padde",
                },
              } as never,
            },
          })
        )
      );

      void sendStaffNotifyEmail({
        subject: "[Infinite Core] Nouveau flux PADDE-CI",
        text: [
          notifMessage,
          "",
          `Audit : ${auditId}`,
          `Type : ${auditType}`,
          email ? `E-mail : ${email}` : "",
          normalizedWhatsapp ? `WhatsApp : ${normalizedWhatsapp}` : "",
          `Lien admin : ${resetAppBaseUrl()}/admin/audits-padde`,
        ]
          .filter(Boolean)
          .join("\n"),
      }).catch((mailErr) => console.warn("[padde-ci] staff email:", mailErr));
    } catch (notifyErr) {
      console.warn("[padde-ci] notification commando:", notifyErr);
    }

    return { auditId };
  };

  /** Secret fourni par l’appelant (legacy) — préférer X-Webhook-Signature HMAC. */
  const paddeSecretExpected = paddeWebhookSecret.trim();
  const noyaSecretExpected = noyaWebhookSecret.trim();

  const webhookAuthHint = (secretConfigured: boolean) => {
    if (!secretConfigured) {
      return "Aucun secret webhook : les POST JSON sont acceptés sans authentification (évitez en prod).";
    }
    if (appEnv.node.isProduction && !allowPlainWebhookSecret) {
      return "En production : header X-Webhook-Signature: sha256=<HMAC-SHA256 du corps JSON brut> avec le secret configuré.";
    }
    return "Auth acceptée : X-Webhook-Signature (HMAC-SHA256) ou X-Webhook-Secret legacy (dev / WEBHOOK_ALLOW_PLAIN_SECRET=1).";
  };

  const normalizeLower = (value: unknown) => String(value || "").trim().toLowerCase();
  const normalizeText = (value: unknown) => String(value || "").trim();
  const normalizeEmail = (value: unknown): string | null => {
    const raw = normalizeLower(value);
    if (!raw) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
    return raw;
  };
  const extractFirstFilled = (payload: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const key of keys) {
      const v = payload[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  app.get("/api/webhooks/noya-recrutement/config-check", (_req, res) => {
    const configuredPartnerId = appEnv.webhooks.noyaRecrutementPartnerId.trim();
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res.status(200).json({
      ok: true,
      databaseConfigured: Boolean(appEnv.database.url),
      webhookSecretConfigured: noyaSecretExpected.length > 0,
      webhookHmacRequired: noyaSecretExpected.length > 0 && appEnv.node.isProduction && !allowPlainWebhookSecret,
      partnerMappingConfigured: configuredPartnerId.length > 0,
      noyaPartnerId: configuredPartnerId || null,
      nodeEnv: appEnv.node.env,
      vercel: Boolean(process.env.VERCEL),
      vercelEnv: process.env.VERCEL_ENV || null,
      hint: webhookAuthHint(noyaSecretExpected.length > 0),
    });
  });

  app.post("/api/webhooks/noya-recrutement", async (req, res) => {
    try {
      const origin = String(req.headers.origin || "").trim();
      if (origin && !noyaAllowedOrigins.has(origin)) {
        return res.status(403).json({ success: false, error: "Origin non autorisée." });
      }

      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée : définissez DATABASE_URL (MongoDB) pour Prisma.",
        });
      }

      const incoming =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? ({ ...(req.body as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const payload: Record<string, unknown> = {};
      for (const [rawKey, value] of Object.entries(incoming)) {
        const normalizedKey = rawKey.trim().toLowerCase().replace(/[\s-]+/g, "_");
        payload[normalizedKey] = value;
      }

      const providedSecret = verifyInboundWebhookAuth({
        secretExpected: noyaSecretExpected,
        req,
        rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
        isProduction: appEnv.node.isProduction,
        allowPlainSecret: allowPlainWebhookSecret,
      });
      delete payload.webhooksecret;
      delete payload.secret;
      delete payload.webhook_secret;

      if (noyaSecretExpected && !providedSecret.ok) {
        return res.status(401).json({ success: false, error: providedSecret.reason || "Webhook non autorisé." });
      }

      const firstName = normalizeText(
        extractFirstFilled(payload, "prenom", "first_name", "firstname", "first")
      );
      const lastName = normalizeText(
        extractFirstFilled(payload, "nom", "last_name", "lastname", "last")
      );
      const email = normalizeEmail(
        extractFirstFilled(payload, "email_professionnel", "email", "email_pro", "business_email")
      );
      const phone = normalizeText(
        extractFirstFilled(payload, "telephone", "phone", "tel", "whatsapp")
      );
      const parcoursRaw = normalizeLower(
        extractFirstFilled(payload, "parcours", "type", "profil", "category")
      );
      const parcours = parcoursRaw === "investisseur" ? "investisseur" : "partenaire";
      const companyName = normalizeText(
        extractFirstFilled(payload, "entreprise", "societe", "company", "organization")
      );
      const note = normalizeText(
        extractFirstFilled(payload, "proposition", "message", "notes", "description")
      );

      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          error: "Champs requis manquants (prenom, nom, email_professionnel).",
        });
      }

      const createdAt = new Date().toISOString();
      const leadId = randomUUID().replace(/-/g, "");
      const configuredPartnerId = appEnv.webhooks.noyaRecrutementPartnerId.trim();
      const configuredPartnerLabel = appEnv.webhooks.noyaRecrutementPartnerLabel.trim() || "Noya Partenaire";
      const partnerId = configuredPartnerId || "noya-recrutement";
      const partnerLabel =
        parcours === "investisseur"
          ? `${configuredPartnerLabel} · Investisseur`
          : `${configuredPartnerLabel} · Partenaire`;

      await prisma.dataDocument.create({
        data: {
          collectionPath: "leads",
          docId: leadId,
          data: {
            id: leadId,
            source: "noya-recrutement",
            sourcePlatform: "noyaindustries.com/recrutement",
            partnerId,
            partnerName: partnerLabel,
            firstName,
            lastName,
            email,
            whatsapp: phone || "Non renseigné",
            phone: phone || "Non renseigné",
            companyName: companyName || "Candidat Noya",
            status: "soumis",
            urgency: "moyenne",
            parcours,
            note:
              note ||
              `Soumission via formulaire Noya (${parcours}).`,
            createdAt,
          } as never,
        },
      });

      const recipients = await prisma.userAccount.findMany({
        where: { role: { in: ["commando", "admin"] } },
        select: { uid: true },
      });
      const recipientIds = recipients.map((r) => r.uid).filter(Boolean);
      const finalRecipients = recipientIds.length > 0 ? recipientIds : ["admin_general"];
      const title = "Nouveau formulaire Noya partenaire";
      const message = `${firstName} ${lastName} (${parcours}) via noyaindustries.com/recrutement${companyName ? ` — ${companyName}` : ""}${phone ? ` — ${phone}` : ""}`;

      await Promise.all(
        finalRecipients.map((recipientId) =>
          prisma.dataDocument.create({
            data: {
              collectionPath: "notifications",
              docId: randomUUID().replace(/-/g, ""),
              data: {
                userId: recipientId,
                title,
                message,
                type: "order",
                read: false,
                createdAt,
                metadata: {
                  source: "noya-recrutement",
                  leadId,
                  parcours,
                  email,
                  phone: phone || null,
                },
              } as never,
            },
          })
        )
      );

      void sendStaffNotifyEmail({
        subject: "[Infinite Core] Nouveau formulaire Noya partenaire",
        text: [
          message,
          "",
          `Lead: ${leadId}`,
          `Email: ${email}`,
          phone ? `Téléphone: ${phone}` : "",
          `Source: https://www.noyaindustries.com/recrutement`,
        ]
          .filter(Boolean)
          .join("\n"),
      }).catch((mailErr) => console.warn("[noya-recrutement] staff email:", mailErr));

      return res.status(200).json({
        success: true,
        leadId,
        notified: finalRecipients.length,
      });
    } catch (error) {
      console.error("[noya-recrutement] webhook:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // Envoi e-mail depuis l’admin/commando (rattache les lead pages à des échanges mail).
  app.post("/api/noya/recrutement/send-email", requireAuthenticatedUser, async (req: Request, res: Response) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifié." });
      if (auth.role !== "admin" && auth.role !== "commando") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
      const leadId = String(body.leadId || "").trim();
      const subject = String(body.subject || "").trim();
      const message = String(body.message || body.text || "").trim();
      const toFromBody = String(body.to || "").trim();

      if (!leadId) return res.status(400).json({ success: false, error: "leadId requis." });
      if (!message) return res.status(400).json({ success: false, error: "message requis." });

      const leadRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "leads", docId: leadId } },
      });

      if (!leadRow) return res.status(404).json({ success: false, error: "Lead introuvable." });
      const leadData = readDataRowAsRecord(leadRow.data) as Record<string, unknown>;
      const source = String(leadData.source || "");
      if (source !== "noya-recrutement") {
        return res.status(400).json({ success: false, error: "Lead hors scope Noya recrutement." });
      }

      const emailFromLead = String(leadData.email || "").trim().toLowerCase();
      const emailTo = toFromBody || emailFromLead;

      if (!emailTo) return res.status(400).json({ success: false, error: "Le lead ne contient pas d’email (ou champ `to` manquant)." });

      const out = await sendLeadEmail({
        to: emailTo,
        subject: subject || "Noya Industries — suivi de votre demande",
        text: message,
      });

      if (!out.sent) {
        return res.status(503).json({ success: false, error: out.reason || "Impossible d’envoyer l’e-mail." });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[noya-recrutement] send-email:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  /**
   * Diagnostic public (sans auth) : état de config côté API — utile quand le formulaire / Netlify « ne passe pas ».
   * Ne divulgue pas le secret, seulement s’il est attendu ou non.
   */
  app.get("/api/webhooks/padde-ci/config-check", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res.status(200).json({
      ok: true,
      databaseConfigured: Boolean(appEnv.database.url),
      webhookSecretConfigured: paddeSecretExpected.length > 0,
      webhookHmacRequired: paddeSecretExpected.length > 0 && appEnv.node.isProduction && !allowPlainWebhookSecret,
      nodeEnv: appEnv.node.env,
      vercel: Boolean(process.env.VERCEL),
      /** Sur Vercel : production | preview | development — les variables peuvent différer par environnement. */
      vercelEnv: process.env.VERCEL_ENV || null,
      hint: webhookAuthHint(paddeSecretExpected.length > 0),
    });
  });

  // Webhook PADDE-CI standard — appel serveur-à-serveur (header secret recommandé).
  app.post("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (rejectUnauthorizedWebhook(req, res, paddeSecretExpected, allowPlainWebhookSecret)) return;
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée : définissez DATABASE_URL (MongoDB) pour Prisma.",
        });
      }
      await persistPaddeAuditToStores(bodyWithoutWebhookSecrets(req.body));
      res.status(200).json({ success: true, message: "Demande d'audit reçue et traitée avec succès." });
    } catch (error) {
      console.error("Erreur Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // Endpoint de secours : accepte les formulaires PADDE-CI (JSON ou x-www-form-urlencoded).
  app.post("/api/webhooks/padde-ci/direct", async (req, res) => {
    try {
      const origin = String(req.headers.origin || "").trim();
      if (origin && !paddeAllowedOrigins.has(origin)) {
        return res.status(403).json({ success: false, error: "Origin non autorisée." });
      }

      const bodyPayload =
        req.body && typeof req.body === "object" ? ({ ...(req.body as Record<string, unknown>) } as Record<string, unknown>) : {};
      delete bodyPayload.webhookSecret;
      delete bodyPayload.secret;

      if (rejectUnauthorizedWebhook(req, res, paddeSecretExpected, allowPlainWebhookSecret)) return;
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée : définissez DATABASE_URL (MongoDB) pour Prisma.",
        });
      }

      const { auditId } = await persistPaddeAuditToStores(bodyPayload);
      return res.status(200).json({ success: true, message: "Audit PADDE-CI enregistré.", auditId });
    } catch (error) {
      console.error("Erreur Webhook PADDE-CI direct:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // GET audits PADDE-CI — source `padde_ci_audits` (fiable en prod même si /api/data/query ne parcourt pas tout `orders`).
  app.get("/api/webhooks/padde-ci", requirePaddeAuditViewer, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      if (!appEnv.database.url) {
        return res.status(503).json({ success: false, error: "Base de données non configurée (DATABASE_URL)." });
      }

      const rows = await prisma.paddeCiAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const ids = rows.map((r) => r.id);
      const orderRows =
        ids.length > 0
          ? await prisma.dataDocument.findMany({
              where: { collectionPath: ORDERS_COLLECTION_PATH, docId: { in: ids } },
            })
          : [];
      const orderById = new Map(orderRows.map((r) => [r.docId, readDataRowAsRecord(r.data)]));

      const audits = rows.map((row) => {
        const payload = row.payload as Record<string, unknown> | null | undefined;
        const typeFromPayload =
          typeof payload?.type === "string"
            ? payload.type
            : typeof payload?.type_audit === "string"
              ? (payload.type_audit as string)
              : "audit-inconnu";

        const order = orderById.get(row.id);
        const clientName = String(order?.clientName || paddeClientNameFromPayload(payload) || "Client PADDE-CI").trim();
        const serviceName = String(order?.serviceName || `Audit PADDE-CI: ${typeFromPayload}`).trim();
        const status = String(order?.status || "En attente").trim() || "En attente";
        const createdAtRaw = order?.createdAt;
        const createdAt =
          typeof createdAtRaw === "string" && createdAtRaw.trim()
            ? createdAtRaw
            : row.createdAt.toISOString();
        const details =
          order && typeof order.details === "object" && order.details !== null
            ? (order.details as Record<string, unknown>)
            : (payload ?? {});

        return {
          id: row.id,
          type_audit: typeFromPayload,
          date: row.createdAt.toISOString(),
          donnees_completes: payload ?? {},
          clientName,
          serviceName,
          status,
          createdAt,
          details,
        };
      });

      // Tableau brut : compatibles avec les bundles encore en cache qui font `rows.map` sans lire `.audits`.
      res.status(200).json(audits);
    } catch (error) {
      console.error("Erreur GET Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  /**
   * Backfill admin — rejoue `persistPaddeAuditToStores` pour les audits PADDE-CI déjà
   * en base afin de créer rétroactivement les documents `users` correspondants.
   *
   * Paginé via `offset` + `limit` pour éviter les timeouts HTTP (MongoDB Atlas +
   * fonctions serverless = latence sérielle importante). Le client doit appeler en
   * boucle jusqu'à recevoir `hasMore: false`.
   *
   * Idempotent : mode `skipAuditRowCreation` + `skipNotifications` activé, donc :
   *  - pas de duplication dans `padde_ci_audits`,
   *  - pas de re-notification bruyante des admins/commando.
   */
  app.post("/api/webhooks/padde-ci/backfill", async (req, res) => {
    try {
      const auth = await readAuthenticatedUser(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifié." });
      if (auth.role !== "admin" && auth.role !== "commando") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      if (!appEnv.database.url) {
        return res.status(503).json({ success: false, error: "Base de données non configurée (DATABASE_URL)." });
      }

      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const offsetRaw = Number(body.offset);
      const limitRaw = Number(body.limit);
      const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 15;

      const total = await prisma.paddeCiAudit.count();
      const audits = await prisma.paddeCiAudit.findMany({
        orderBy: { createdAt: "asc" },
        skip: offset,
        take: limit,
      });

      let processed = 0;
      let skipped = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const audit of audits) {
        const raw = audit.payload as Record<string, unknown> | null | undefined;
        if (!raw || typeof raw !== "object") {
          skipped += 1;
          continue;
        }
        try {
          await persistPaddeAuditToStores(raw, {
            existingAuditId: audit.id,
            skipAuditRowCreation: true,
            skipNotifications: true,
          });
          processed += 1;
        } catch (err) {
          errors.push({
            id: audit.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const nextOffset = offset + audits.length;
      return res.status(200).json({
        success: true,
        totalAudits: total,
        offset,
        limit,
        batchSize: audits.length,
        processed,
        skipped,
        failed: errors.length,
        nextOffset,
        hasMore: nextOffset < total,
        ...(errors.length > 0 ? { errors: errors.slice(0, 20) } : {}),
      });
    } catch (error) {
      console.error("[padde-ci][backfill]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // L’UI est servie par Next.js (`next dev` / `next start`) sauf en dev unifié (`scripts/devUnified.ts`).

  registerErrorHandlers(app);

  return { app, port };
}

async function startServer() {
  const { app, port } = await createExpressApplication();
  app.listen(port, "0.0.0.0", () => {
    logger.info("api_listening", { port, host: "0.0.0.0" });
  });
}

// Écoute uniquement pour `npm run start:api` (`START_LISTEN=1`). Jamais lors d’un import depuis Next (`pages/api`, dev unifié, etc.).
if (process.env.START_LISTEN === "1") {
  void startServer();
}
