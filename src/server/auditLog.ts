import type { Request } from "express";
import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

export type AuditAuthAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.login.verification_required"
  | "auth.login.verify.success"
  | "auth.logout"
  | "auth.register.started"
  | "auth.register.success"
  | "auth.google.success"
  | "auth.google.failure"
  | "auth.password_reset.request"
  | "auth.password_reset.confirm"
  | "auth.admin_role.change"
  | "auth.admin_create"
  | "auth.profile.update";

export type AuditDataAction =
  | "data.doc.create"
  | "data.doc.update"
  | "data.doc.patch"
  | "data.doc.delete";

const SENSITIVE_KEY = /password|secret|token|hash|smtp|stripe|authorization|cookie/i;

const AUDIT_COLLECTION = "security_audit_logs";

let persistClient: PrismaClient | null = null;

export function bindAuditLogPersistence(prisma: PrismaClient) {
  persistClient = prisma;
}

function normalizeIp(raw: string): string {
  return raw.trim().replace(/^::ffff:/, "") || "unknown";
}

export function auditRequestMeta(req?: Request): { requestId: string; ip: string } {
  if (!req) return { requestId: "", ip: "unknown" };
  const xff = req.headers["x-forwarded-for"];
  let ip = normalizeIp(req.socket.remoteAddress || "");
  if (typeof xff === "string" && xff.trim()) {
    ip = normalizeIp(xff.split(",")[0] || "");
  } else if (Array.isArray(xff) && xff[0]) {
    ip = normalizeIp(String(xff[0]));
  }
  return {
    requestId: String(req.headers["x-request-id"] || ""),
    ip,
  };
}

export function redactAuditValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string" && value.length > 256) return `${value.slice(0, 256)}…`;
  return value;
}

export function summarizeDataFields(data: Record<string, unknown>, max = 12): string[] {
  return Object.keys(data)
    .filter((k) => !SENSITIVE_KEY.test(k))
    .slice(0, max);
}

type AuditBase = {
  action: AuditAuthAction | AuditDataAction;
  success: boolean;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  targetEmail?: string;
  collectionPath?: string;
  docId?: string;
  merge?: boolean;
  fieldsChanged?: string[];
  reason?: string;
  requestId?: string;
  ip?: string;
};

function writeAudit(entry: AuditBase) {
  logger.info("audit_event", {
    audit: true,
    ...entry,
  });

  if (process.env.AUDIT_LOG_PERSIST !== "1" || !persistClient) return;

  const docId = `audit_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  void persistClient.dataDocument
    .create({
      data: {
        collectionPath: AUDIT_COLLECTION,
        docId,
        data: {
          ...entry,
          createdAt: new Date().toISOString(),
        } as never,
      },
    })
    .catch((error) => {
      logger.warn("audit_persist_failed", {
        action: entry.action,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
}

export function logAuditAuth(input: {
  action: AuditAuthAction;
  success: boolean;
  req?: Request;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  targetEmail?: string;
  reason?: string;
}) {
  const meta = auditRequestMeta(input.req);
  writeAudit({
    action: input.action,
    success: input.success,
    actorUid: input.actorUid,
    actorEmail: input.targetEmail ? undefined : input.actorEmail,
    actorRole: input.actorRole,
    targetEmail: input.targetEmail || input.actorEmail,
    reason: input.reason,
    requestId: meta.requestId,
    ip: meta.ip,
  });
}

export function logAuditDataChange(input: {
  action: AuditDataAction;
  req?: Request;
  auth: { uid: string; email: string; role: string };
  collectionPath: string;
  docId: string;
  merge?: boolean;
  payload?: Record<string, unknown>;
}) {
  if (input.collectionPath === AUDIT_COLLECTION) return;

  const meta = auditRequestMeta(input.req);
  writeAudit({
    action: input.action,
    success: true,
    actorUid: input.auth.uid,
    actorEmail: input.auth.email,
    actorRole: input.auth.role,
    collectionPath: input.collectionPath,
    docId: input.docId,
    merge: input.merge,
    fieldsChanged: input.payload ? summarizeDataFields(input.payload) : undefined,
    requestId: meta.requestId,
    ip: meta.ip,
  });
}
