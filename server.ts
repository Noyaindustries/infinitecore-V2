import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import { createReadStream, promises as fs } from "fs";
import { agentSessionLog } from "@/debug/agentSessionLog";
import multer from "multer";
import { randomUUID, timingSafeEqual } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Stripe from "stripe";
import { appEnv, parseCorsOrigins, resetAppBaseUrl } from "@/config/env";
import { prisma } from "./prismaClient";
import { buildFileUrl, sanitizeFolder } from "./_r2";
import { resolveLocalUploadFile, normalizePublicIdQuery, mimeFromStorageKey } from "./storageUtils";
import { parseAuthFromRequest, registerMongoApi, resolveAuthPayload } from "./mongoApi";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/octet-stream",
]);

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".csv",
]);
const DB_FILE_COLLECTION_PATH = "__file_blobs";
const DB_FILE_PUBLIC_ID_PREFIX = "dbf/";
const MAX_DB_FALLBACK_BYTES = 8 * 1024 * 1024; // 8 MB (reste sous la limite Mongo ~16 MB après base64)
const ORDERS_COLLECTION_PATH = "orders";
const USERS_COLLECTION_PATH = "users";

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

function isAllowedUpload(file: Express.Multer.File) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype || "")) return false;
  return true;
}

function secureSecretEquals(expected: string, provided: string) {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
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
    return next();
  } catch (error) {
    console.error("[auth] middleware user:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}

async function requireAdminUser(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await readAuthenticatedUser(req);
    if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
    if (auth.role !== "admin") return res.status(403).json({ success: false, error: "Acces refuse." });
    return next();
  } catch (error) {
    console.error("[auth] middleware admin:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}

/** Application Express (routes `/api/*`, `/health`) sans `listen` — utilisée par `startServer` et par le dev unifié Next+API. */
export async function createExpressApplication(): Promise<{ app: Express; port: number }> {
  const app = express();
  const port = appEnv.http.port;
  const corsOrigins = parseCorsOrigins(appEnv.http.corsOriginRaw);
  const paddeAllowedOrigins = new Set(["https://padde-ci.com", "https://www.padde-ci.com"]);
  const paddeWebhookSecret = appEnv.webhooks.paddeWebhookSecret;
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
  const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const canUseLocalDiskFallback = !isServerlessRuntime;

  if (!canUseR2) {
    console.warn(
      "[upload] Variables R2 absentes — mode développement : fichiers dans .local-uploads/ (non utilisé en prod sans R2)."
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
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
    })
  );
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(
    express.json({
      limit: "1mb",
      strict: true,
      verify: (req, _res, buf) => {
        if ((req.url || "").startsWith("/api/stripe/webhook")) {
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
      // #region agent log
      agentSessionLog({
        hypothesisId: "H5",
        location: "server.ts:request_timing",
        message: "express_request_finish",
        data: {
          method: req.method,
          path: routePath,
          status: res.statusCode,
          durationMs: Date.now() - start,
          requestId,
        },
      });
      // #endregion
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
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

      const body = (req.body ?? {}) as Record<string, unknown>;
      const serviceId = String(body.serviceId || "").trim();
      const serviceName = String(body.serviceName || "").trim();
      const note = String(body.note || "").trim();
      const amount = Number(body.amount);
      const billingCycle = normalizeBillingCycle(body.billingCycle);

      if (!serviceId || !serviceName || !Number.isFinite(amount) || amount <= 0 || !billingCycle) {
        return res.status(400).json({ success: false, error: "Paramètres abonnement invalides." });
      }

      const unitAmount = Math.round(amount);
      const orderId = `CMD-${randomUUID().split("-")[0].toUpperCase()}`;
      const customerId = await resolveStripeCustomerId({ uid: auth.uid, email: auth.email });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: `${appBaseUrl}/dashboard/boutique?checkout=success&orderId=${encodeURIComponent(orderId)}`,
        cancel_url: `${appBaseUrl}/dashboard/boutique?checkout=cancel&orderId=${encodeURIComponent(orderId)}`,
        customer: customerId || undefined,
        customer_email: customerId ? undefined : auth.email,
        metadata: {
          orderId,
          userId: auth.uid,
          serviceId,
          billingCycle,
        },
        subscription_data: {
          metadata: {
            orderId,
            userId: auth.uid,
            serviceId,
          },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "xof",
              unit_amount: unitAmount,
              recurring: { interval: billingCycle },
              product_data: {
                name: serviceName,
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
            orderType: "abonnement",
            isSubscription: true,
            billingCycle,
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
            orderType: "abonnement",
            isSubscription: true,
            billingCycle,
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
          if (orderId) {
            await upsertOrderPatch(orderId, {
              status: "Actif",
              paymentStatus: "paid",
              stripeCheckoutSessionId: session.id,
              subscriptionId: subscriptionId || null,
            stripeCustomerId: session.customer ? String(session.customer) : null,
              subscriptionStatus: "active",
              activatedAt: new Date().toISOString(),
            });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const subscriptionId = String(sub.id || "").trim();
          const rawSub = sub as unknown as { current_period_end?: number; canceled_at?: number | null };
          if (subscriptionId) {
            await updateBySubscriptionId(subscriptionId, {
              status: subscriptionStatusFromStripe(sub.status),
              subscriptionStatus: sub.status,
              currentPeriodEnd:
                typeof rawSub.current_period_end === "number"
                  ? new Date(rawSub.current_period_end * 1000).toISOString()
                  : null,
              canceledAt:
                typeof rawSub.canceled_at === "number"
                  ? new Date(rawSub.canceled_at * 1000).toISOString()
                  : null,
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

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });
  const uploadSingleWithHandling: express.RequestHandler = (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: "Fichier trop volumineux (max 50MB).",
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload invalide: ${error.message}`,
        });
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[upload] middleware:", msg);
      return res.status(400).json({ success: false, error: "Requête d'upload invalide." });
    });
  };

  app.post("/api/files/upload", requireAuthenticatedUser, uploadSingleWithHandling, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier reçu." });
      }
      if (!isAllowedUpload(req.file)) {
        return res.status(415).json({
          success: false,
          error: "Type de fichier non autorisé. Formats acceptés: PDF, Office, JPG/PNG/WEBP, TXT/CSV.",
        });
      }

      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${safeOriginal}`;

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
            } as never,
          },
          update: {
            data: {
              contentBase64: req.file.buffer.toString("base64"),
              originalName: req.file.originalname,
              mimetype: req.file.mimetype || "application/octet-stream",
              size: req.file.size,
            } as never,
          },
        });
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
      const msg =
        error instanceof Error && !appEnv.node.isProduction
          ? `Erreur interne du serveur. ${error.message}`
          : "Erreur interne du serveur.";
      return res.status(500).json({ success: false, error: msg });
    }
  });

  app.delete("/api/files", requireAuthenticatedUser, async (req, res) => {
    try {
      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }
      if (isDbStoredPublicId(safePath)) {
        const docId = dbDocIdFromPublicId(safePath);
        if (!docId) {
          return res.status(400).json({ success: false, error: "publicId invalide." });
        }
        await prisma.dataDocument.deleteMany({
          where: { collectionPath: DB_FILE_COLLECTION_PATH, docId },
        });
        return res.status(200).json({ success: true });
      }

      if (canUseR2 && s3) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: r2Bucket,
            Key: safePath,
          })
        );
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
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erreur suppression API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/files/download", requireAuthenticatedUser, async (req, res) => {
    try {
      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
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
        res.setHeader("Content-Disposition", `inline; filename="${originalName.replace(/"/g, "")}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.status(200).send(buffer);
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
        res.setHeader("Content-Type", mimeFromStorageKey(safePath));
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
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

  const persistPaddeAuditToStores = async (data: unknown) => {
    const payload = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
    const auditId = `PADDE-${Math.floor(1000 + Math.random() * 9000)}`;
    const auditType = String(payload.type_audit || payload.type || payload.auditType || "Audit PADDE-CI").trim();
    const clientName = String(
      payload.clientName || payload.nom || payload.name || payload.entreprise || payload.company || "Client PADDE-CI"
    ).trim();
    const normalizedWhatsapp = String(payload.whatsapp || payload.telephone || payload.phone || "").trim();
    const createdAt = new Date().toISOString();
    const normalizeEmail = (value: unknown): string | null => {
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
      return raw;
    };
    const normalizeText = (value: unknown) => String(value || "").trim();
    const sanitizeIdSegment = (value: string) => value.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
    const email =
      normalizeEmail(payload.email) ||
      normalizeEmail(payload.email_client) ||
      normalizeEmail(payload.clientEmail) ||
      normalizeEmail(payload.mail) ||
      normalizeEmail(payload["e-mail"]);
    const firstName = normalizeText(payload.firstName || payload.prenom || payload.prenoms || payload.firstname);
    const lastName = normalizeText(payload.lastName || payload.nom || payload.lastname);
    const companyName = normalizeText(payload.companyName || payload.entreprise || payload.company);

    let linkedClientId: string | null = null;
    if (email) {
      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true },
      });
      linkedClientId = account?.uid || `padde_${sanitizeIdSegment(email)}`;

      const existingUserDoc = await prisma.dataDocument.findUnique({
        where: {
          collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: linkedClientId },
        },
        select: { data: true },
      });
      const existingUserData = readDataRowAsRecord(existingUserDoc?.data);

      await prisma.dataDocument.upsert({
        where: {
          collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: linkedClientId },
        },
        create: {
          collectionPath: USERS_COLLECTION_PATH,
          docId: linkedClientId,
          data: {
            uid: linkedClientId,
            email,
            role: "client",
            firstName: firstName || existingUserData.firstName || "",
            lastName: lastName || existingUserData.lastName || "",
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
            email,
            role: "client",
            firstName: firstName || String(existingUserData.firstName || ""),
            lastName: lastName || String(existingUserData.lastName || ""),
            phone: normalizedWhatsapp || String(existingUserData.phone || ""),
            companyName: companyName || String(existingUserData.companyName || ""),
            source: "padde-ci",
            updatedAt: createdAt,
          } as never,
        },
      });
    }

    await prisma.paddeCiAudit.create({
      data: {
        id: auditId,
        payload: (payload ?? {}) as never,
        processed: false,
      },
    });

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
          ...(linkedClientId ? { clientId: linkedClientId, userId: linkedClientId } : {}),
          ...(email ? { clientEmail: email } : {}),
          clientName,
          serviceName: `Audit PADDE-CI: ${auditType}`,
          details: {
            ...payload,
            email: email || null,
            whatsapp: payload.whatsapp || payload.telephone || payload.phone || normalizedWhatsapp || null,
          },
        } as never,
      },
      update: {
        data: {
          id: auditId,
          source: "padde-ci",
          status: "En attente",
          createdAt,
          ...(linkedClientId ? { clientId: linkedClientId, userId: linkedClientId } : {}),
          ...(email ? { clientEmail: email } : {}),
          clientName,
          serviceName: `Audit PADDE-CI: ${auditType}`,
          details: {
            ...payload,
            email: email || null,
            whatsapp: payload.whatsapp || payload.telephone || payload.phone || normalizedWhatsapp || null,
          },
        } as never,
      },
    });

    return { auditId };
  };

  // Webhook PADDE-CI standard — appel serveur-à-serveur (header secret recommandé).
  app.post("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (paddeWebhookSecret) {
        const provided = String(req.headers["x-webhook-secret"] || "");
        if (!provided || !secureSecretEquals(paddeWebhookSecret, provided)) {
          return res.status(401).json({ success: false, error: "Webhook non autorisé." });
        }
      }
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée : définissez DATABASE_URL (MongoDB) pour Prisma.",
        });
      }
      await persistPaddeAuditToStores(req.body);
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
      const bodySecret = String(bodyPayload.webhookSecret || bodyPayload.secret || "");
      const querySecret = String(req.query.secret || "");
      const headerSecret = String(req.headers["x-webhook-secret"] || "");
      const providedSecret = headerSecret || bodySecret || querySecret;
      delete bodyPayload.webhookSecret;
      delete bodyPayload.secret;

      if (paddeWebhookSecret) {
        if (!providedSecret || !secureSecretEquals(paddeWebhookSecret, providedSecret)) {
          return res.status(401).json({ success: false, error: "Webhook non autorisé." });
        }
      }
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

  // GET audits PADDE-CI (ex. admin.html) — lecture MongoDB
  app.get("/api/webhooks/padde-ci", requireAdminUser, async (req, res) => {
    try {
      if (!appEnv.database.url) {
        return res.status(503).json({ success: false, error: "Base de données non configurée (DATABASE_URL)." });
      }

      const rows = await prisma.paddeCiAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const audits = rows.map((row) => {
        const payload = row.payload as Record<string, unknown> | null | undefined;
        const typeFromPayload =
          typeof payload?.type === "string"
            ? payload.type
            : typeof payload?.type_audit === "string"
              ? (payload.type_audit as string)
              : "audit-inconnu";

        return {
          id: row.id,
          type_audit: typeFromPayload,
          date: row.createdAt.toISOString(),
          donnees_completes: payload ?? {},
        };
      });

      res.status(200).json(audits);
    } catch (error) {
      console.error("Erreur GET Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // L’UI est servie par Next.js (`next dev` / `next start`) sauf en dev unifié (`scripts/devUnified.ts`).

  return { app, port };
}

async function startServer() {
  const { app, port } = await createExpressApplication();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[infinitecore-api] http://0.0.0.0:${port}`);
  });
}

// Écoute uniquement pour `npm run start:api` (`START_LISTEN=1`). Jamais lors d’un import depuis Next (`pages/api`, dev unifié, etc.).
if (process.env.START_LISTEN === "1") {
  void startServer();
}
