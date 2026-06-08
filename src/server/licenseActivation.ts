import { randomUUID } from "crypto";
import { prisma } from "../../prismaClient";
import { licenseDocId, type AppLicense, type LicenseStatus, type LicenseType } from "@/lib/licenses";
import {
  buildActivationNotification,
  buildWelcomeMessage,
  deliveryContextFromApp,
  SYSTEM_SENDER_ID,
  SYSTEM_SENDER_NAME,
  type DeliveryGuideContext,
} from "@/lib/appDeliveryGuide";
import { loadAppCatalog } from "./appCatalogStore";
import { defaultSaasTenantId, initialSaasStateForSubscription } from "@/lib/saasAccess";
import {
  notifySaasSubscriptionEvent,
  notifySaasTenantProvision,
} from "./saasAppBridge";

export const LICENSES_COLLECTION_PATH = "licenses";
const USERS_COLLECTION_PATH = "users";

function readDataRowAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function upsertAppLicense(input: {
  userId: string;
  appId: string;
  moduleKey: string;
  appName: string;
  type: LicenseType;
  status?: LicenseStatus;
  orderId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  expiresAt?: string | null;
  saasInstanceUrl?: string | null;
  saasTenantId?: string | null;
  saasProvisioningStatus?: AppLicense["saasProvisioningStatus"];
}): Promise<void> {
  const docId = licenseDocId(input.userId, input.appId);
  const now = new Date().toISOString();
  const existing = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
  });
  const current = readDataRowAsRecord(existing?.data);

  const data: AppLicense = {
    id: docId,
    userId: input.userId,
    appId: input.appId,
    moduleKey: input.moduleKey,
    appName: input.appName,
    type: input.type,
    status: input.status ?? "active",
    orderId: input.orderId ?? (current.orderId as string | null) ?? null,
    stripeSubscriptionId:
      input.stripeSubscriptionId ?? (current.stripeSubscriptionId as string | null) ?? null,
    stripeCheckoutSessionId:
      input.stripeCheckoutSessionId ?? (current.stripeCheckoutSessionId as string | null) ?? null,
    expiresAt: input.expiresAt ?? (current.expiresAt as string | null) ?? null,
    saasInstanceUrl:
      input.saasInstanceUrl !== undefined
        ? input.saasInstanceUrl
        : (current.saasInstanceUrl as string | null) ?? null,
    saasTenantId:
      input.saasTenantId !== undefined
        ? input.saasTenantId
        : (current.saasTenantId as string | null) ?? null,
    saasProvisioningStatus:
      input.saasProvisioningStatus !== undefined
        ? input.saasProvisioningStatus
        : (current.saasProvisioningStatus as AppLicense["saasProvisioningStatus"]) ?? null,
    activatedAt: now,
    createdAt: (current.createdAt as string) || now,
    updatedAt: now,
  };

  await prisma.dataDocument.upsert({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
    create: {
      collectionPath: LICENSES_COLLECTION_PATH,
      docId,
      data: data as never,
    },
    update: {
      data: data as never,
    },
  });
}

export async function patchLicenseBySubscriptionId(
  subscriptionId: string,
  patch: Partial<
    Pick<AppLicense, "status" | "expiresAt" | "stripeSubscriptionId" | "saasProvisioningStatus">
  >
): Promise<void> {
  const rows = await prisma.dataDocument.findMany({
    where: { collectionPath: LICENSES_COLLECTION_PATH },
    take: 5000,
  });
  const catalog = await loadAppCatalog();
  const now = new Date().toISOString();
  const updated: AppLicense[] = [];

  for (const row of rows) {
    const data = readDataRowAsRecord(row.data);
    if (String(data.stripeSubscriptionId || "") !== subscriptionId) continue;
    const next = {
      ...data,
      ...patch,
      updatedAt: now,
    } as AppLicense;
    await prisma.dataDocument.update({
      where: {
        collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId: row.docId },
      },
      data: { data: next as never },
    });
    updated.push(next);
  }

  for (const license of updated) {
    if (license.type !== "subscription") continue;
    const catalogApp = catalog.find(
      (a) => a.id === license.appId || a.moduleKey === license.moduleKey
    );
    if (patch.status === "suspended" || patch.saasProvisioningStatus === "suspended") {
      await notifySaasSubscriptionEvent({
        app: catalogApp,
        license,
        event: "subscription.suspended",
      });
    } else if (patch.saasProvisioningStatus === "ready" && license.status === "active") {
      await notifySaasSubscriptionEvent({
        app: catalogApp,
        license,
        event: "subscription.resumed",
      });
    }
  }
}

async function resolveClientChatProfile(userId: string): Promise<{ clientName: string; clientEmail: string }> {
  const row = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: USERS_COLLECTION_PATH, docId: userId },
    },
  });
  const data = readDataRowAsRecord(row?.data);
  const first = String(data.firstName || "").trim();
  const last = String(data.lastName || "").trim();
  const email = String(data.email || "").trim();
  const clientName = `${first} ${last}`.trim() || email || "Client";
  return { clientName, clientEmail: email };
}

async function postWelcomeDeliveryMessage(input: {
  userId: string;
  licenseType: LicenseType;
  guide: DeliveryGuideContext;
}): Promise<void> {
  const { clientName, clientEmail } = await resolveClientChatProfile(input.userId);
  const now = new Date().toISOString();
  const msgId = randomUUID();
  const text = buildWelcomeMessage(input.licenseType, input.guide);
  const preview = text.split("\n")[0]?.slice(0, 120) || "Votre application est prête";

  const existingChat = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: "chats", docId: input.userId },
    },
  });
  const chatData = {
    ...readDataRowAsRecord(existingChat?.data),
    clientId: input.userId,
    clientName,
    clientEmail: clientEmail || readDataRowAsRecord(existingChat?.data).clientEmail,
    lastMessage: preview,
    lastMessageAt: now,
    unreadCommando: true,
    unreadClient: false,
  };
  await prisma.dataDocument.upsert({
    where: {
      collectionPath_docId: { collectionPath: "chats", docId: input.userId },
    },
    create: {
      collectionPath: "chats",
      docId: input.userId,
      data: chatData as never,
    },
    update: {
      data: chatData as never,
    },
  });

  await prisma.dataDocument.create({
    data: {
      collectionPath: `chats/${input.userId}/messages`,
      docId: msgId,
      data: {
        id: msgId,
        senderId: SYSTEM_SENDER_ID,
        senderName: SYSTEM_SENDER_NAME,
        senderRole: "commando",
        text,
        type: "text",
        readByCommando: true,
        createdAt: now,
      } as never,
    },
  });
}

export async function activateLicenseFromCheckoutSession(meta: {
  userId: string;
  appId: string;
  moduleKey: string;
  appName: string;
  orderId: string;
  checkoutSessionId: string;
  licenseType: LicenseType;
  subscriptionId?: string | null;
  licenseDurationDays?: number;
  currentPeriodEnd?: string | null;
}): Promise<void> {
  let expiresAt: string | null = null;
  if (meta.licenseType === "license") {
    const days = meta.licenseDurationDays ?? 0;
    if (days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
  } else if (meta.currentPeriodEnd) {
    expiresAt = meta.currentPeriodEnd;
  }

  const catalog = await loadAppCatalog();
  const catalogApp = catalog.find((a) => a.id === meta.appId || a.moduleKey === meta.moduleKey);
  const saasState =
    meta.licenseType === "subscription"
      ? initialSaasStateForSubscription(catalogApp, meta.userId, meta.appId)
      : null;

  await upsertAppLicense({
    userId: meta.userId,
    appId: meta.appId,
    moduleKey: meta.moduleKey,
    appName: meta.appName,
    type: meta.licenseType,
    status: "active",
    orderId: meta.orderId,
    stripeCheckoutSessionId: meta.checkoutSessionId,
    stripeSubscriptionId: meta.subscriptionId ?? null,
    expiresAt,
    saasInstanceUrl: saasState?.saasInstanceUrl ?? null,
    saasTenantId: saasState?.saasTenantId ?? null,
    saasProvisioningStatus: saasState?.saasProvisioningStatus ?? null,
  });
  const guide: DeliveryGuideContext = catalogApp
    ? deliveryContextFromApp(catalogApp)
    : {
        appName: meta.appName,
        moduleKey: meta.moduleKey,
        deliveryLabel: "selon accompagnement",
        licensePackageUrl: null,
        installGuideUrl: null,
      };

  const activationNotice = buildActivationNotification(meta.licenseType, meta.appName);
  const notifId = randomUUID();
  await prisma.dataDocument.create({
    data: {
      collectionPath: "notifications",
      docId: notifId,
      data: {
        id: notifId,
        userId: meta.userId,
        title: activationNotice.title,
        message: activationNotice.message,
        type: "license",
        read: false,
        createdAt: new Date().toISOString(),
        metadata: {
          appId: meta.appId,
          moduleKey: meta.moduleKey,
          orderId: meta.orderId,
          licenseType: meta.licenseType,
        },
      } as never,
    },
  });

  try {
    await postWelcomeDeliveryMessage({
      userId: meta.userId,
      licenseType: meta.licenseType,
      guide,
    });
  } catch (error) {
    console.error("[licenseActivation] welcome message failed:", error);
  }

  if (meta.licenseType === "subscription" && saasState?.saasTenantId && catalogApp) {
    const { clientEmail } = await resolveClientChatProfile(meta.userId);
    try {
      await notifySaasTenantProvision({
        app: catalogApp,
        userId: meta.userId,
        appId: meta.appId,
        moduleKey: meta.moduleKey,
        tenantId: saasState.saasTenantId,
        email: clientEmail,
        appName: meta.appName,
      });
    } catch (error) {
      console.error("[licenseActivation] saas tenant provision webhook failed:", error);
    }
  }
}

export async function upsertExternalSubscriptionLicense(input: {
  userId: string;
  appId: string;
  moduleKey?: string;
  appName?: string;
  tenantId?: string;
  expiresAt?: string | null;
}): Promise<AppLicense> {
  const catalog = await loadAppCatalog();
  const catalogApp = catalog.find((a) => a.id === input.appId);
  const moduleKey = input.moduleKey || catalogApp?.moduleKey || input.appId;
  const appName = input.appName || catalogApp?.title || input.appId;
  const tenantId = input.tenantId?.trim() || defaultSaasTenantId(input.userId, input.appId);
  const saasState = initialSaasStateForSubscription(catalogApp, input.userId, input.appId);

  await upsertAppLicense({
    userId: input.userId,
    appId: input.appId,
    moduleKey,
    appName,
    type: "subscription",
    status: "active",
    expiresAt: input.expiresAt ?? null,
    saasTenantId: tenantId,
    saasProvisioningStatus: saasState.saasProvisioningStatus,
  });

  const docId = licenseDocId(input.userId, input.appId);
  const row = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
  });
  const license = readDataRowAsRecord(row?.data) as unknown as AppLicense;

  if (catalogApp) {
    const { clientEmail } = await resolveClientChatProfile(input.userId);
    try {
      await notifySaasTenantProvision({
        app: catalogApp,
        userId: input.userId,
        appId: input.appId,
        moduleKey,
        tenantId,
        email: clientEmail,
        appName,
      });
    } catch (error) {
      console.error("[licenseActivation] external subscription provision webhook failed:", error);
    }
  }

  return license;
}

export async function confirmSaasTenantReady(input: {
  userId: string;
  appId: string;
  tenantId?: string;
}): Promise<AppLicense | null> {
  const docId = licenseDocId(input.userId, input.appId);
  const existing = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
  });
  if (!existing) return null;
  const current = readDataRowAsRecord(existing.data);
  if (String(current.type || "") !== "subscription") return null;
  const now = new Date().toISOString();
  const tenantId = input.tenantId?.trim() || (current.saasTenantId as string) || null;
  const data: AppLicense = {
    ...(current as unknown as AppLicense),
    saasTenantId: tenantId,
    saasProvisioningStatus: "ready",
    updatedAt: now,
  };
  await prisma.dataDocument.update({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
    data: { data: data as never },
  });
  return data;
}

export async function provisionSaasLicense(input: {
  userId: string;
  appId: string;
  saasInstanceUrl?: string;
  saasTenantId?: string;
}): Promise<AppLicense | null> {
  const docId = licenseDocId(input.userId, input.appId);
  const existing = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
  });
  if (!existing) return null;
  const current = readDataRowAsRecord(existing.data);
  if (String(current.type || "") !== "subscription") return null;

  const url = input.saasInstanceUrl?.trim() || null;
  const tenantId = input.saasTenantId?.trim() || (current.saasTenantId as string | null) || null;
  if (!url && !tenantId) return null;
  const now = new Date().toISOString();
  const data: AppLicense = {
    ...(current as unknown as AppLicense),
    saasInstanceUrl: url,
    saasTenantId: tenantId,
    saasProvisioningStatus: url || tenantId ? "ready" : "pending",
    updatedAt: now,
  };

  await prisma.dataDocument.update({
    where: {
      collectionPath_docId: { collectionPath: LICENSES_COLLECTION_PATH, docId },
    },
    data: { data: data as never },
  });

  const notifId = randomUUID();
  await prisma.dataDocument.create({
    data: {
      collectionPath: "notifications",
      docId: notifId,
      data: {
        id: notifId,
        userId: input.userId,
        title: "Application SaaS prête",
        message: tenantId
          ? `Votre espace tenant (${tenantId}) est prêt${url ? ` : ${url}` : ""}.`
          : `Votre instance est en ligne : ${url}`,
        type: "license",
        read: false,
        createdAt: now,
        metadata: { appId: input.appId, saasInstanceUrl: url },
      } as never,
    },
  });

  return data;
}
