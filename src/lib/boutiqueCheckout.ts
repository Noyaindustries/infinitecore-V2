/** Deep links boutique marketing → Shop client / auth. */

export type BoutiquePricingIntent = 'license' | 'subscription';
export type BoutiqueBillingIntent = 'month' | 'year';

export type BoutiqueCheckoutParams = {
  appId: string;
  pricing?: BoutiquePricingIntent;
  billing?: BoutiqueBillingIntent;
  /** Démarre l’essai 14 jours (sans paiement) une fois connecté. */
  trial?: boolean;
};

export function buildClientShopPath(params: BoutiqueCheckoutParams): string {
  const q = new URLSearchParams();
  q.set('app', params.appId);
  if (params.pricing) q.set('pricing', params.pricing);
  if (params.billing) q.set('billing', params.billing);
  if (params.trial) q.set('trial', '1');
  return `/dashboard/boutique?${q.toString()}`;
}

/** URL signup qui conserve le retour vers la boutique client. */
export function buildSignupWithReturn(params: BoutiqueCheckoutParams): string {
  const returnTo = buildClientShopPath(params);
  return `/signup?returnTo=${encodeURIComponent(returnTo)}`;
}

export function buildLoginWithReturn(params: BoutiqueCheckoutParams): string {
  const returnTo = buildClientShopPath(params);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Chemin acheteur selon session : Shop si client, sinon signup avec retour. */
export function resolveBoutiqueCta(
  isClient: boolean,
  params: BoutiqueCheckoutParams
): string {
  return isClient ? buildClientShopPath(params) : buildSignupWithReturn(params);
}

export function safeReturnToPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  if (decoded.includes('://')) return null;
  return decoded;
}
