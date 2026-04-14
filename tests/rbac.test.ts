import assert from "node:assert/strict";
import { __rbacTestUtils, type AuthPayload, type QueryFilter } from "../mongoApi";

const { assertDataQueryAuthorized, assertDataDocAuthorized } = __rbacTestUtils;

function auth(role: AuthPayload["role"], uid = "u_client"): AuthPayload {
  return { uid, email: `${uid}@example.com`, role };
}

function ok(result: { ok: true } | { ok: false; error: string }) {
  if (result.ok === false) {
    assert.fail(result.error);
  }
  assert.equal(result.ok, true);
}

function ko(result: { ok: true } | { ok: false; error: string }) {
  assert.equal(result.ok, false, "Expected forbidden result");
}

function where(field: string, value: unknown): QueryFilter {
  return { field, operator: "==", value };
}

// Admin: accès total.
ok(assertDataQueryAuthorized(auth("admin"), "super_secret", []));
ok(assertDataDocAuthorized(auth("admin"), "write", "super_secret", "doc1"));

// Commando: accès limité aux collections autorisées.
ok(assertDataQueryAuthorized(auth("commando", "u_cmd"), "missions", []));
ko(assertDataQueryAuthorized(auth("commando", "u_cmd"), "unknown_private", []));

// Client: query notifications doit être scopée sur son UID.
ok(assertDataQueryAuthorized(auth("client"), "notifications", [where("userId", "u_client")]));
ko(assertDataQueryAuthorized(auth("client"), "notifications", [where("userId", "u_other")]));
ko(assertDataQueryAuthorized(auth("client"), "users", []));

// Client: accès document users uniquement sur son propre profil.
ok(
  assertDataDocAuthorized(auth("client"), "read", "users", "u_client")
);
ko(
  assertDataDocAuthorized(auth("client"), "read", "users", "u_other")
);

// Client: écriture profil interdite si élévation de rôle.
ok(
  assertDataDocAuthorized(auth("client"), "write", "users", "u_client", {
    uid: "u_client",
    role: "client",
  })
);
ko(
  assertDataDocAuthorized(auth("client"), "write", "users", "u_client", {
    uid: "u_client",
    role: "admin",
  })
);

// Client: accès chat limité à son namespace.
ok(assertDataDocAuthorized(auth("client"), "read", "chats/u_client/messages", "m1"));
ko(assertDataDocAuthorized(auth("client"), "read", "chats/u_other/messages", "m1"));

console.log("RBAC tests passed");
