import type { AppCatalogEntry, AppLicensePricing } from '../data/appCatalog';
import type { AppLicense, LicenseType } from './licenses';

export const SYSTEM_SENDER_ID = 'system-infinitecore';
export const SYSTEM_SENDER_NAME = 'Infinite Core';

export interface DeliveryGuideContext {
  appName: string;
  moduleKey: string;
  deliveryLabel: string;
  licensePackageUrl?: string | null;
  installGuideUrl?: string | null;
  saasBaseUrl?: string | null;
}

export const LICENSE_DELIVERY_STEPS = [
  'Votre paiement est confirmé et la licence est active sur Infinite Core.',
  'Téléchargez le package d’installation (lien ci-dessous ou via la messagerie).',
  'Déployez l’application sur votre serveur ou cloud — notre équipe vous accompagne.',
  'Conservez votre clé de licence : elle valide l’usage à vie de l’application.',
] as const;

export const SUBSCRIPTION_DELIVERY_STEPS = [
  'Choisissez l’abonnement dans la boutique Infinite Core.',
  'Paiement mensuel sur Infinite Core (Stripe) ou redirection vers le paiement de l’application, selon l’app.',
  'Un espace tenant dédié est créé — accès via Mon espace → Applications SaaS.',
  'Renouvellement et facturation : boutique Infinite Core ou site de l’application.',
] as const;

function optionalLinks(ctx: DeliveryGuideContext): string {
  const lines: string[] = [];
  if (ctx.licensePackageUrl?.trim()) {
    lines.push(`📥 Téléchargement : ${ctx.licensePackageUrl.trim()}`);
  }
  if (ctx.installGuideUrl?.trim()) {
    lines.push(`📘 Guide d’installation : ${ctx.installGuideUrl.trim()}`);
  }
  return lines.length ? `\n\n${lines.join('\n')}` : '';
}

export function buildLicenseWelcomeMessage(ctx: DeliveryGuideContext): string {
  const links = optionalLinks(ctx);
  const packageHint = ctx.licensePackageUrl?.trim()
    ? 'Le lien de téléchargement est disponible ci-dessous et dans Mon espace.'
    : 'Notre équipe vous transmettra le lien de téléchargement ici sous peu.';

  return [
    `Félicitations ! Votre licence à vie pour « ${ctx.appName} » est active.`,
    '',
    '📦 Auto-hébergement — prochaines étapes :',
    `1. ${packageHint}`,
    '2. Installez l’application sur votre infrastructure (serveur, VPS ou cloud).',
    `3. Délai indicatif de mise en service : ${ctx.deliveryLabel}.`,
    '4. Répondez à ce message pour planifier l’accompagnement technique.',
    links,
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
}

export function buildSubscriptionWelcomeMessage(ctx: DeliveryGuideContext): string {
  const saasUrl = ctx.saasBaseUrl?.trim();
  const accessLines = saasUrl
    ? [
        '🚀 Accès SaaS immédiat :',
        `1. Ouvrez directement : ${saasUrl}`,
        '2. Ou Mon espace → Applications SaaS → Ouvrir le SaaS.',
        '3. Aucune installation requise — Infinite Core héberge et maintient l’application.',
      ]
    : [
        '🚀 Accès SaaS Infinite Core :',
        '1. Mon espace → Mes applications → votre module.',
        '2. Notre équipe finalise le déploiement de votre instance (délai indicatif selon accompagnement).',
        '3. Vous serez notifié dès que l’URL est active.',
      ];

  return [
    `Votre abonnement à « ${ctx.appName} » est actif !`,
    '',
    ...accessLines,
    '4. Gérez votre abonnement via la boutique (Gérer mes abonnements).',
    '',
    `Module intégré : /module/${ctx.moduleKey}/dashboard`,
  ].join('\n');
}

export function buildWelcomeMessage(licenseType: LicenseType, ctx: DeliveryGuideContext): string {
  return licenseType === 'license'
    ? buildLicenseWelcomeMessage(ctx)
    : buildSubscriptionWelcomeMessage(ctx);
}

export function buildActivationNotification(
  licenseType: LicenseType,
  appName: string
): { title: string; message: string } {
  if (licenseType === 'license') {
    return {
      title: 'Licence activée',
      message: `${appName} — consultez la messagerie et Mon espace pour télécharger et installer l’application chez vous.`,
    };
  }
  return {
    title: 'Abonnement activé',
    message: `${appName} — accédez au SaaS depuis Mon espace (Applications SaaS ou module intégré).`,
  };
}

export function deliveryContextFromApp(app: AppCatalogEntry): DeliveryGuideContext {
  return {
    appName: app.title,
    moduleKey: app.moduleKey,
    deliveryLabel: app.deliveryLabel,
    licensePackageUrl: app.licensePackageUrl ?? null,
    installGuideUrl: app.installGuideUrl ?? null,
    saasBaseUrl: app.saasBaseUrl ?? null,
  };
}

export function isLifetimeLicense(license: AppLicense, app?: AppCatalogEntry): boolean {
  if (license.type !== 'license') return false;
  if (!license.expiresAt) return true;
  const catalogLicense = app?.pricing.find((p): p is AppLicensePricing => p.type === 'license');
  return catalogLicense?.durationDays === 0;
}
