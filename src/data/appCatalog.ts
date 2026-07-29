/**
 * Catalogue mono-éditeur Infinite Core — licences et abonnements.
 * Source unique pour la boutique client, l'accueil et les endpoints Stripe.
 */
import { APP_CATALOG_DETAIL_DEFAULTS } from './appCatalogDetails';
import { enrichCatalogSaasDefaults } from '../lib/saasUrlTemplate';

export type BillingInterval = 'month' | 'year';

export interface AppLicensePricing {
  type: 'license';
  price: number;
  durationDays: number;
  label?: string;
}

export interface AppSubscriptionPricing {
  type: 'subscription';
  price: number;
  billingCycle: BillingInterval;
  label?: string;
}

export type AppPricing = AppLicensePricing | AppSubscriptionPricing;

export interface AppCatalogFeature {
  title: string;
  description: string;
}

/** Champs enrichis pour la page détail (admin + marketing). */
export interface AppCatalogDetailFields {
  longDescription?: string;
  problem?: string;
  advantages?: string[];
  features?: AppCatalogFeature[];
  galleryImages?: string[];
  demoUrl?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
}

export interface AppCatalogEntry extends AppCatalogDetailFields {
  id: string;
  moduleKey: string;
  title: string;
  desc: string;
  deliveryLabel: string;
  /** Lien ZIP / dépôt pour licence à vie (auto-hébergée). */
  licensePackageUrl?: string;
  /** Identifiant stockage (upload local / R2) pour suppression et téléchargement. */
  licensePackagePublicId?: string;
  /** Nom affiché du fichier package (ex. erp-multi-ecole-v1.zip). */
  licensePackageName?: string;
  /** Guide d'installation PDF ou doc pour licence à vie. */
  installGuideUrl?: string;
  /** URL SaaS partagée — une déploiement multi-tenant, un tenant par client. */
  saasBaseUrl?: string;
  /** Comment passer le tenant dans l'URL : query (?tenant=) ou path (/t/{tenant}). */
  saasTenantRoute?: 'query' | 'path';
  /** Nom du paramètre query tenant (défaut : tenant). */
  saasTenantQueryKey?: string;
  /**
   * Facturation abonnement : `infinitecore` = Stripe IC + jeton SaaS ;
   * `external` = redirection vers le paiement propre de l'app.
   */
  saasBillingMode?: 'infinitecore' | 'external';
  /** Page de paiement / abonnement sur le site de l'app (placeholders : {tenantId}, {userId}, …). */
  saasExternalCheckoutUrl?: string;
  /** Webhook app : création tenant à l'activation abonnement (POST JSON, event tenant.provision). */
  saasProvisionWebhookUrl?: string;
  /** Webhook app : suspension / reprise abonnement. */
  saasWebhookUrl?: string;
  /** Visuel carte (accueil / boutique). */
  imageUrl?: string;
  pricing: AppPricing[];
  onlineCheckout: boolean;
}

/** Licence à vie : le client héberge l'application. */
export const LICENSE_HOSTING_SHORT = 'Auto-hébergée (chez vous)';

/** Abonnement : Infinite Core héberge l'application en SaaS. */
export const SUBSCRIPTION_HOSTING_SHORT = 'Hébergée en ligne par Infinite Core (SaaS)';

export function formatLicenseHostingLabel(): string {
  return 'Vous hébergez l\'application sur votre serveur ou cloud.';
}

export function formatSubscriptionHostingLabel(): string {
  return 'Infinite Core héberge et exploite l\'application en ligne — accès immédiat, rien à installer.';
}

export function formatPricingHostingLabel(pricing: AppPricing): string {
  return pricing.type === 'license' ? formatLicenseHostingLabel() : formatSubscriptionHostingLabel();
}

export function formatPricingHostingShort(pricing: AppPricing): string {
  return pricing.type === 'license' ? LICENSE_HOSTING_SHORT : SUBSCRIPTION_HOSTING_SHORT;
}

function monthly(price: number): AppSubscriptionPricing {
  return {
    type: 'subscription',
    price,
    billingCycle: 'month',
    label: 'Abonnement mensuel (SaaS Infinite Core)',
  };
}

/** Annuel = 12 × mensuel × 0,8 (−20 %), montant total facturé une fois / an. */
function yearlyFromMonthly(monthlyPrice: number): AppSubscriptionPricing {
  return {
    type: 'subscription',
    price: Math.round(monthlyPrice * 0.8 * 12),
    billingCycle: 'year',
    label: 'Abonnement annuel (SaaS Infinite Core, −20 %)',
  };
}

/** `durationDays: 0` = licence à vie (sans date d'expiration). */
function lifetimeLicense(price: number): AppLicensePricing {
  return { type: 'license', price, durationDays: 0, label: 'Licence à vie (auto-hébergée)' };
}

/** Toutes les licences catalogue sont à vie — ignore toute durée stockée (ex. 365 jours). */
export function normalizeLicensePricing(pricing: AppLicensePricing): AppLicensePricing {
  return {
    ...pricing,
    durationDays: 0,
    label: pricing.label?.trim() || 'Licence à vie (auto-hébergée)',
  };
}

function normalizeEntryPricing(pricing: AppPricing[]): AppPricing[] {
  return pricing.map((p) => (p.type === 'license' ? normalizeLicensePricing(p) : p));
}

export const DEFAULT_CATALOG_LICENSE_PRICE = 100_000;
export const DEFAULT_CATALOG_SUBSCRIPTION_PRICE = 10_000;

export function hasLicensePricing(entry: Pick<AppCatalogEntry, 'pricing'>): boolean {
  return entry.pricing.some((p) => p.type === 'license');
}

export function hasSubscriptionPricing(entry: Pick<AppCatalogEntry, 'pricing'>): boolean {
  return entry.pricing.some((p) => p.type === 'subscription');
}

export function setLicensePricingEnabled(
  entry: AppCatalogEntry,
  enabled: boolean,
  price = DEFAULT_CATALOG_LICENSE_PRICE
): AppCatalogEntry {
  const without = entry.pricing.filter((p) => p.type !== 'license');
  if (!enabled) return { ...entry, pricing: without };
  const existing = entry.pricing.find((p): p is AppLicensePricing => p.type === 'license');
  return { ...entry, pricing: [...without, existing ?? lifetimeLicense(price)] };
}

export function setSubscriptionPricingEnabled(
  entry: AppCatalogEntry,
  enabled: boolean,
  price = DEFAULT_CATALOG_SUBSCRIPTION_PRICE
): AppCatalogEntry {
  const without = entry.pricing.filter((p) => p.type !== 'subscription');
  if (!enabled) return { ...entry, pricing: without };
  const existing = entry.pricing.find((p): p is AppSubscriptionPricing => p.type === 'subscription');
  return { ...entry, pricing: [...without, existing ?? monthly(price)] };
}

export function validateCatalogEntryPricing(entry: AppCatalogEntry): string | null {
  if (entry.onlineCheckout && entry.pricing.length === 0) {
    return `« ${entry.title} » : cochez au moins un tarif (licence ou abonnement).`;
  }
  return null;
}

export function formatLicenseValidityLabel(_pricing: AppLicensePricing): string {
  return 'À vie — hébergement client';
}

export function formatLicensePricingLabel(pricing: AppLicensePricing): string {
  return pricing.label?.trim() || 'Licence à vie (auto-hébergée)';
}

function app(
  id: string,
  title: string,
  desc: string,
  licensePrice: number,
  monthlyPrice: number,
  deliveryLabel = '5-7 jours'
): AppCatalogEntry {
  return {
    id,
    moduleKey: id,
    title,
    desc,
    deliveryLabel,
    imageUrl: `/apps/${id}.svg`,
    onlineCheckout: true,
    pricing: [lifetimeLicense(licensePrice), monthly(monthlyPrice), yearlyFromMonthly(monthlyPrice)],
  };
}

export const INFINITE_APP_CATALOG: AppCatalogEntry[] = [
  app(
    'erp-multi-ecole',
    'ERP Multi-École',
    'Scolarité, notes, frais de scolarité, emplois du temps et suivi multi-établissements.',
    350_000,
    35_000,
    '10-14 jours'
  ),
  app(
    'caisse-enregistreuse',
    'Caisse enregistreuse',
    'Point de vente, tickets, encaissement Wave/Orange Money et rapports de caisse en temps réel.',
    120_000,
    12_000,
    '3-5 jours'
  ),
  app(
    'erp-immobiliere',
    'ERP immobilière',
    'Biens, mandats, baux, quittances de loyer et tableau de bord propriétaires.',
    400_000,
    40_000,
    '10-14 jours'
  ),
  app(
    'erp-gestion-stock',
    'ERP gestion de stock',
    'Entrées, sorties, inventaires, alertes seuil et traçabilité multi-dépôts.',
    180_000,
    18_000,
    '5-7 jours'
  ),
  app(
    'erp-gestion-evenementielle',
    'ERP gestion événementielle',
    'Planning, invités, prestataires, budget et billetterie pour vos événements.',
    220_000,
    22_000,
    '7-10 jours'
  ),
  app(
    'crm-boutique',
    'CRM Boutique',
    'Clients, fidélité, ventes omnicanal et suivi des commandes pour commerces de détail.',
    150_000,
    15_000,
    '5-7 jours'
  ),
  app(
    'app-location-voiture',
    'Application location voiture',
    'Flotte, réservations, contrats, états des lieux et facturation location.',
    200_000,
    20_000,
    '7-10 jours'
  ),
  app(
    'cms-clinique',
    'CMS Clinique en ligne',
    'Site vitrine, prise de RDV, dossiers patients et téléconsultation.',
    280_000,
    28_000,
    '10-14 jours'
  ),
  app(
    'crm-multi-hotel',
    'CRM Gestion Multi-Hôtel',
    'Chambres, réservations, housekeeping et pilotage multi-établissements hôteliers.',
    380_000,
    38_000,
    '10-14 jours'
  ),
];

export function slugifyAppId(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 56) || 'application'
  );
}

export function createEmptyAppCatalogEntry(): AppCatalogEntry {
  const suffix = Date.now().toString(36);
  const id = `nouvelle-app-${suffix}`;
  return {
    id,
    moduleKey: id,
    title: 'Nouvelle application',
    desc: 'Description courte affichée sur la carte boutique.',
    deliveryLabel: '5-7 jours',
    imageUrl: '',
    onlineCheckout: true,
    pricing: [lifetimeLicense(100_000), monthly(10_000), yearlyFromMonthly(10_000)],
    galleryImages: [],
    advantages: [],
    features: [],
    longDescription: '',
    problem: '',
    whatsappNumber: '2250103015467',
    whatsappMessage: 'Bonjour, je souhaite en savoir plus sur cette application Infinite Core.',
  };
}

export function isBuiltInAppId(id: string): boolean {
  return INFINITE_APP_CATALOG.some((a) => a.id === id);
}

export function getAppImageUrl(app: Pick<AppCatalogEntry, 'id' | 'imageUrl'>): string {
  if (app.imageUrl?.trim()) return app.imageUrl.trim();
  const known = INFINITE_APP_CATALOG.find((a) => a.id === app.id);
  return known?.imageUrl || `/apps/${app.id}.svg`;
}

export function getAppById(appId: string, catalog: AppCatalogEntry[] = INFINITE_APP_CATALOG): AppCatalogEntry | undefined {
  return catalog.find((a) => a.id === appId);
}

export function getAppByModuleKey(moduleKey: string, catalog: AppCatalogEntry[] = INFINITE_APP_CATALOG): AppCatalogEntry | undefined {
  return catalog.find((a) => a.moduleKey === moduleKey);
}

function mergeDetailFields(entry: AppCatalogEntry): AppCatalogEntry {
  const details = APP_CATALOG_DETAIL_DEFAULTS[entry.id];
  if (!details) return entry;
  const gallery =
    entry.galleryImages?.length
      ? entry.galleryImages
      : details.galleryImages?.length
        ? details.galleryImages
        : entry.imageUrl
          ? [entry.imageUrl]
          : [];
  return {
    ...entry,
    longDescription: entry.longDescription || details.longDescription,
    problem: entry.problem || details.problem,
    advantages: entry.advantages !== undefined ? entry.advantages : details.advantages,
    features: entry.features !== undefined ? entry.features : details.features,
    galleryImages: gallery,
    demoUrl: entry.demoUrl?.trim() || details.demoUrl?.trim() || undefined,
    whatsappNumber: entry.whatsappNumber || details.whatsappNumber,
    whatsappMessage: entry.whatsappMessage || details.whatsappMessage,
  };
}

function mergeStoredWithDefault(def: AppCatalogEntry, found?: AppCatalogEntry): AppCatalogEntry {
  if (!found) return mergeDetailFields(def);
  const merged: AppCatalogEntry = {
    ...def,
    ...found,
    moduleKey: found.moduleKey || def.moduleKey,
    imageUrl: found.imageUrl?.trim() ? found.imageUrl : def.imageUrl,
    pricing: normalizeEntryPricing(Array.isArray(found.pricing) ? found.pricing : def.pricing),
    advantages: found.advantages !== undefined ? found.advantages : def.advantages,
    features: found.features !== undefined ? found.features : def.features,
    galleryImages: found.galleryImages?.length ? found.galleryImages : def.galleryImages,
  };
  return mergeDetailFields(merged);
}

/** Fusionne les apps par défaut + personnalisées (admin). */
export function mergeCatalogWithDefaults(remote: AppCatalogEntry[]): AppCatalogEntry[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const defaultIds = new Set(INFINITE_APP_CATALOG.map((d) => d.id));

  const defaults = INFINITE_APP_CATALOG.map((def) =>
    mergeStoredWithDefault(def, remoteById.get(def.id))
  );

  const customs = remote
    .filter((r) => !defaultIds.has(r.id))
    .map((r) => mergeDetailFields({ ...r, pricing: normalizeEntryPricing(r.pricing || []) }));

  return enrichCatalogSaasDefaults([...defaults, ...customs]);
}

export function parseAppCatalogEntries(raw: unknown): AppCatalogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AppCatalogEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || '').trim();
    const moduleKey = String(row.moduleKey || id).trim();
    const title = String(row.title || '').trim();
    if (!id || !title) continue;
    const pricing: AppPricing[] = [];
    if (Array.isArray(row.pricing)) {
      for (const p of row.pricing) {
        if (!p || typeof p !== 'object') continue;
        const pr = p as Record<string, unknown>;
        const type = String(pr.type || '');
        const price = Number(pr.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        if (type === 'license') {
          pricing.push(
            normalizeLicensePricing({
              type: 'license',
              price: Math.round(price),
              durationDays: 0,
              label: typeof pr.label === 'string' ? pr.label : undefined,
            })
          );
        } else if (type === 'subscription') {
          const cycle = String(pr.billingCycle || 'month') === 'year' ? 'year' : 'month';
          pricing.push({
            type: 'subscription',
            price: Math.round(price),
            billingCycle: cycle,
            label: typeof pr.label === 'string' ? pr.label : undefined,
          });
        }
      }
    }
    const features: AppCatalogFeature[] = [];
    if (Array.isArray(row.features)) {
      for (const f of row.features) {
        if (!f || typeof f !== 'object') continue;
        const fr = f as Record<string, unknown>;
        const fTitle = String(fr.title || '').trim();
        if (!fTitle) continue;
        features.push({
          title: fTitle,
          description: String(fr.description || '').trim(),
        });
      }
    }
    const advantages: string[] = [];
    if (Array.isArray(row.advantages)) {
      for (const a of row.advantages) {
        const line = String(a || '').trim();
        if (line) advantages.push(line);
      }
    }
    const galleryImages: string[] = [];
    if (Array.isArray(row.galleryImages)) {
      for (const g of row.galleryImages) {
        const url = String(g || '').trim();
        if (url) galleryImages.push(url);
      }
    }

    out.push({
      id,
      moduleKey,
      title,
      desc: String(row.desc || ''),
      deliveryLabel: String(row.deliveryLabel || 'Sur devis'),
      imageUrl: typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : `/apps/${id}.svg`,
      onlineCheckout: row.onlineCheckout === true,
      pricing,
      longDescription: typeof row.longDescription === 'string' ? row.longDescription : undefined,
      problem: typeof row.problem === 'string' ? row.problem : undefined,
      advantages: Array.isArray(row.advantages) ? advantages : undefined,
      features: Array.isArray(row.features) ? features : undefined,
      galleryImages: galleryImages.length ? galleryImages : undefined,
      demoUrl: typeof row.demoUrl === 'string' ? row.demoUrl : undefined,
      whatsappNumber: typeof row.whatsappNumber === 'string' ? row.whatsappNumber : undefined,
      whatsappMessage: typeof row.whatsappMessage === 'string' ? row.whatsappMessage : undefined,
      licensePackageUrl:
        typeof row.licensePackageUrl === 'string' && row.licensePackageUrl.trim()
          ? row.licensePackageUrl.trim()
          : undefined,
      licensePackagePublicId:
        typeof row.licensePackagePublicId === 'string' && row.licensePackagePublicId.trim()
          ? row.licensePackagePublicId.trim()
          : undefined,
      licensePackageName:
        typeof row.licensePackageName === 'string' && row.licensePackageName.trim()
          ? row.licensePackageName.trim()
          : undefined,
      installGuideUrl:
        typeof row.installGuideUrl === 'string' && row.installGuideUrl.trim()
          ? row.installGuideUrl.trim()
          : undefined,
      saasBaseUrl:
        typeof row.saasBaseUrl === 'string' && row.saasBaseUrl.trim() ? row.saasBaseUrl.trim() : undefined,
      saasTenantRoute: row.saasTenantRoute === 'path' ? 'path' : 'query',
      saasTenantQueryKey:
        typeof row.saasTenantQueryKey === 'string' && row.saasTenantQueryKey.trim()
          ? row.saasTenantQueryKey.trim()
          : undefined,
      saasBillingMode: row.saasBillingMode === 'external' ? 'external' : 'infinitecore',
      saasExternalCheckoutUrl:
        typeof row.saasExternalCheckoutUrl === 'string' && row.saasExternalCheckoutUrl.trim()
          ? row.saasExternalCheckoutUrl.trim()
          : undefined,
      saasProvisionWebhookUrl:
        typeof row.saasProvisionWebhookUrl === 'string' && row.saasProvisionWebhookUrl.trim()
          ? row.saasProvisionWebhookUrl.trim()
          : undefined,
      saasWebhookUrl:
        typeof row.saasWebhookUrl === 'string' && row.saasWebhookUrl.trim()
          ? row.saasWebhookUrl.trim()
          : undefined,
    });
  }
  return mergeCatalogWithDefaults(out);
}

export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}
