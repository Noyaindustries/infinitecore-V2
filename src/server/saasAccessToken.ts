import jwt from "jsonwebtoken";
import { appEnv, getJwtSecret } from "@/config/env";

export const SAAS_TOKEN_AUDIENCE = "infinitecore-saas-access";
const SAAS_TOKEN_TTL = "2h";

export interface SaasAccessTokenPayload {
  uid: string;
  appId: string;
  moduleKey: string;
  /** Tenant multi-tenant — isole les données du client dans l'app partagée. */
  tenantId: string;
  email?: string;
  stripeSubscriptionId?: string | null;
}

export function signSaasAccessToken(payload: SaasAccessTokenPayload): string {
  return jwt.sign(
    { ...payload, purpose: "saas-access" },
    getJwtSecret(),
    {
      expiresIn: SAAS_TOKEN_TTL,
      algorithm: "HS256",
      issuer: appEnv.auth.jwtIssuer,
      audience: SAAS_TOKEN_AUDIENCE,
    }
  );
}

export function verifySaasAccessToken(token: string): SaasAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: appEnv.auth.jwtIssuer,
      audience: SAAS_TOKEN_AUDIENCE,
    }) as SaasAccessTokenPayload & { purpose?: string };
    if (decoded.purpose !== "saas-access") return null;
    if (!decoded.uid || !decoded.appId || !decoded.moduleKey || !decoded.tenantId) return null;
    return {
      uid: decoded.uid,
      appId: decoded.appId,
      moduleKey: decoded.moduleKey,
      tenantId: decoded.tenantId,
      email: decoded.email,
      stripeSubscriptionId: decoded.stripeSubscriptionId ?? null,
    };
  } catch {
    return null;
  }
}
