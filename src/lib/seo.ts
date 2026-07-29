import { INFINITE_APP_CATALOG, formatFcfa, type AppCatalogEntry } from '@/data/appCatalog';

export function siteUrl(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return String(raw || 'https://www.infinitecore.net').replace(/\/$/, '');
}

export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${p}`;
}

export type SeoPayload = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'product';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export function buildAppProductJsonLd(app: AppCatalogEntry): Record<string, unknown> {
  const license = app.pricing.find((p) => p.type === 'license');
  const subscription = app.pricing.find((p) => p.type === 'subscription');
  const offers = [];
  if (subscription && app.onlineCheckout) {
    offers.push({
      '@type': 'Offer',
      price: subscription.price,
      priceCurrency: 'XOF',
      priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        .toISOString()
        .slice(0, 10),
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/applications/${app.id}`),
      description: `Abonnement mensuel SaaS Infinite Core — ${formatFcfa(subscription.price)}`,
    });
  }
  if (license && app.onlineCheckout) {
    offers.push({
      '@type': 'Offer',
      price: license.price,
      priceCurrency: 'XOF',
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/applications/${app.id}`),
      description: `Licence à vie auto-hébergée — ${formatFcfa(license.price)}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.title,
    description: app.longDescription || app.desc,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: offers.length ? offers : undefined,
    image: absoluteUrl(app.imageUrl || `/apps/${app.id}.svg`),
    url: absoluteUrl(`/applications/${app.id}`),
    provider: {
      '@type': 'Organization',
      name: 'Infinite Core',
      url: siteUrl(),
    },
  };
}

export const STATIC_SEO_ROUTES: Record<string, Omit<SeoPayload, 'path'>> = {
  '/': {
    title: 'Infinite Core — ERP, CRM et applications métier pour l\'Afrique',
    description:
      'Licences et abonnements : ERP multi-école, caisse, immobilier, stock, CRM boutique, clinique en ligne. Paiement sécurisé, déploiement rapide en Côte d\'Ivoire.',
    image: '/infinite-core-logo-v2.png',
  },
  '/solutions': {
    title: 'Solutions Infinite Core — Applications métier modulaires',
    description:
      'Découvrez nos ERP, CRM et outils sectoriels pour digitaliser votre entreprise en Afrique.',
    image: '/infinite-core-logo-v2.png',
  },
  '/boutique': {
    title: 'Boutique Infinite Core — Logiciels métier',
    description:
      'CaisseCI, School Manager, Diamond Hotel et plus. Abonnements ou licences perpétuelles en FCFA. Essai 14 jours, Mobile Money accepté.',
    image: '/infinite-core-logo-v2.png',
  },
  '/tarifs': {
    title: 'Tarifs Infinite Core — Licences et abonnements',
    description: 'Tarifs en FCFA : licence à vie (auto-hébergée) ou abonnement mensuel SaaS Infinite Core.',
    image: '/infinite-core-logo-v2.png',
  },
  '/signup': {
    title: 'Créer un compte Infinite Core',
    description: 'Inscription gratuite — accédez à la boutique et activez vos applications après paiement.',
    image: '/infinite-core-logo-v2.png',
  },
};

export function allSitemapPaths(): string[] {
  const staticPaths = Object.keys(STATIC_SEO_ROUTES);
  const appPaths = INFINITE_APP_CATALOG.map((a) => `/applications/${a.id}`);
  return [...staticPaths, ...appPaths, '/login', '/a-propos', '/faq'];
}
