import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  logAuditAuth,
  logAuditDataChange,
  redactAuditValue,
  summarizeDataFields,
} from "../../src/server/auditLog";

describe("auditLog", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AUDIT_LOG_PERSIST;
  });

  it("journalise un événement auth en JSON structuré", () => {
    logAuditAuth({
      action: "auth.login.failure",
      success: false,
      targetEmail: "user@example.com",
      reason: "invalid_password",
    });
    const line = String((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe("audit_event");
    expect(parsed.audit).toBe(true);
    expect(parsed.action).toBe("auth.login.failure");
    expect(parsed.success).toBe(false);
  });

  it("masque les champs sensibles", () => {
    expect(redactAuditValue("password", "secret123")).toBe("[redacted]");
    expect(redactAuditValue("email", "a@b.com")).toBe("a@b.com");
  });

  it("résume les champs modifiés sans secrets", () => {
    const fields = summarizeDataFields({
      title: "x",
      passwordHash: "hidden",
      role: "client",
    });
    expect(fields).toContain("title");
    expect(fields).not.toContain("passwordHash");
  });

  it("ignore les écritures sur la collection audit (évite récursion)", () => {
    logAuditDataChange({
      action: "data.doc.create",
      auth: { uid: "u1", email: "a@b.com", role: "admin" },
      collectionPath: "security_audit_logs",
      docId: "audit_1",
    });
    expect(console.log).not.toHaveBeenCalled();
  });
});
