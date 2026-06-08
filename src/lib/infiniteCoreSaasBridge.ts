/**
 * SDK côté application multi-tenant Infinite Core.
 * Importez ce module dans vos apps SaaS pour valider `ic_token` et isoler le tenant.
 */

export type InfiniteCoreSaasSession = {
  valid: boolean;
  userId: string;
  tenantId: string;
  appId: string;
  moduleKey: string;
  email: string | null;
  stripeSubscriptionId: string | null;
};

export function extractIcTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get("ic_token")?.trim() || null;
  } catch {
    return null;
  }
}

export async function verifyInfiniteCoreSaasToken(
  token: string,
  options: { apiBaseUrl: string; apiKey?: string }
): Promise<InfiniteCoreSaasSession | null> {
  const base = options.apiBaseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (options.apiKey?.trim()) {
    headers["X-InfiniteCore-SaaS-Key"] = options.apiKey.trim();
  }
  const res = await fetch(
    `${base}/api/saas/verify-token?token=${encodeURIComponent(token)}`,
    { headers }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    valid?: boolean;
    userId?: string;
    tenantId?: string;
    appId?: string;
    moduleKey?: string;
    email?: string | null;
    stripeSubscriptionId?: string | null;
  };
  if (!data.valid || !data.userId || !data.tenantId || !data.appId || !data.moduleKey) {
    return null;
  }
  return {
    valid: true,
    userId: data.userId,
    tenantId: data.tenantId,
    appId: data.appId,
    moduleKey: data.moduleKey,
    email: data.email ?? null,
    stripeSubscriptionId: data.stripeSubscriptionId ?? null,
  };
}

/** Middleware Express minimal — attache `req.infiniteCoreSaas` si jeton valide. */
export function createInfiniteCoreSaasMiddleware(options: {
  apiBaseUrl: string;
  apiKey?: string;
  tokenQueryParam?: string;
}) {
  const param = options.tokenQueryParam ?? "ic_token";
  return async function infiniteCoreSaasMiddleware(
    req: {
      query?: Record<string, unknown>;
      headers?: Record<string, unknown>;
      infiniteCoreSaas?: InfiniteCoreSaasSession;
    },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) {
    const fromQuery = String(req.query?.[param] || "").trim();
    const fromHeader = String(req.headers?.["x-ic-token"] || "").trim();
    const token = fromQuery || fromHeader;
    if (!token) return next();
    const session = await verifyInfiniteCoreSaasToken(token, options);
    if (!session) {
      return res.status(401).json({ error: "Jeton Infinite Core invalide ou expiré." });
    }
    req.infiniteCoreSaas = session;
    return next();
  };
}
