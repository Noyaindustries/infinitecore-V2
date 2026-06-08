import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, X } from 'lucide-react';
import {
  formatFcfa,
  isBuiltInAppId,
  slugifyAppId,
  type AppCatalogEntry,
  type AppLicensePricing,
  type AppSubscriptionPricing,
} from '../data/appCatalog';
import { APP_CATALOG_DETAIL_DEFAULTS } from '../data/appCatalogDetails';
import AppCatalogImageManager from './AppCatalogImageManager';
import AppCatalogFeaturesEditor from './AppCatalogFeaturesEditor';
import AppCatalogPackageUpload from './AppCatalogPackageUpload';

export type AppCatalogEditorMode = 'create' | 'edit';

type Props = {
  mode: AppCatalogEditorMode;
  draft: AppCatalogEntry;
  onChange: (draft: AppCatalogEntry) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function patchDraft(draft: AppCatalogEntry, patch: Partial<AppCatalogEntry>): AppCatalogEntry {
  return { ...draft, ...patch };
}

function patchLicensePrice(draft: AppCatalogEntry, price: number): AppCatalogEntry {
  return {
    ...draft,
    pricing: draft.pricing.map((p) =>
      p.type === 'license' ? { ...p, price: Math.max(0, price) } : p
    ),
  };
}

function patchSubscriptionPrice(draft: AppCatalogEntry, price: number): AppCatalogEntry {
  return {
    ...draft,
    pricing: draft.pricing.map((p) =>
      p.type === 'subscription' ? { ...p, price: Math.max(0, price) } : p
    ),
  };
}

function linesToList(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function listToLines(items?: string[]): string {
  return items?.join('\n') ?? '';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-text-primary/[0.02] p-4">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

export default function AppCatalogEditorModal({ mode, draft, onChange, onClose, onSubmit }: Props) {
  const license = draft.pricing.find((p): p is AppLicensePricing => p.type === 'license');
  const subscription = draft.pricing.find((p): p is AppSubscriptionPricing => p.type === 'subscription');
  const isCreate = mode === 'create';
  const autoSlugFromTitle = isCreate || draft.id.startsWith('nouvelle-app-');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const titleId = 'app-catalog-editor-title';

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-noya-sidebar shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85)]"
      >
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-noya-green">
                {isCreate ? 'Nouvelle application' : 'Modifier l’application'}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold text-text-primary">
                {isCreate ? 'Créer une application' : draft.title || 'Sans titre'}
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Même formulaire pour la création et l’édition — pensez à enregistrer le catalogue en haut de page.
              </p>
            </div>
            <button
              type="button"
              title="Fermer"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-border p-2 text-text-muted transition-colors hover:bg-text-primary/5 hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <Section title="Identité">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label htmlFor="editor-title" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Titre <span className="text-noya-orange">*</span>
                </label>
                <input
                  id="editor-title"
                  autoFocus
                  value={draft.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    if (autoSlugFromTitle) {
                      const slug = slugifyAppId(title);
                      onChange(patchDraft(draft, { title, id: slug, moduleKey: slug }));
                    } else {
                      onChange(patchDraft(draft, { title }));
                    }
                  }}
                  placeholder="Ex. — Gestion de pharmacie"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-module" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Clé module
                </label>
                <input
                  id="editor-module"
                  value={draft.moduleKey}
                  onChange={(e) => onChange(patchDraft(draft, { moduleKey: slugifyAppId(e.target.value) }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 font-mono text-sm text-text-primary"
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="editor-id" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Identifiant (URL)
                </label>
                <input
                  id="editor-id"
                  value={draft.id}
                  disabled={!isCreate && isBuiltInAppId(draft.id)}
                  onChange={(e) => {
                    const newId = slugifyAppId(e.target.value);
                    onChange(
                      patchDraft(draft, {
                        id: newId,
                        moduleKey: draft.moduleKey === draft.id ? newId : draft.moduleKey,
                      })
                    );
                  }}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 font-mono text-sm text-text-primary disabled:opacity-60"
                />
                <p className="mt-1 font-mono text-[10px] text-text-muted">/applications/{draft.id}</p>
              </div>
            </div>
          </Section>

          <Section title="Tarifs & carte boutique">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="editor-desc" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Description courte
                </label>
                <textarea
                  id="editor-desc"
                  value={draft.desc}
                  rows={2}
                  onChange={(e) => onChange(patchDraft(draft, { desc: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-delivery" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Délai mise en service
                </label>
                <input
                  id="editor-delivery"
                  value={draft.deliveryLabel}
                  onChange={(e) => onChange(patchDraft(draft, { deliveryLabel: e.target.value }))}
                  placeholder="Ex. — 5-7 jours"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={draft.onlineCheckout}
                onChange={(e) => onChange(patchDraft(draft, { onlineCheckout: e.target.checked }))}
                className="accent-noya-orange"
              />
              Paiement en ligne (Stripe)
            </label>

            <div className="mt-4 rounded-xl border border-noya-orange/25 bg-noya-orange/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-noya-orange">Tarifs (FCFA)</p>
              <p className="mt-1 text-xs text-text-muted">
                Licence à vie : client héberge. Abonnement : SaaS en ligne par Infinite Core.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {license ? (
                  <div>
                    <label htmlFor="editor-license-price" className="mb-1 block text-xs font-semibold text-text-secondary">
                      Licence à vie — auto-hébergée
                    </label>
                    <input
                      id="editor-license-price"
                      type="number"
                      min={0}
                      step={1000}
                      value={license.price}
                      onChange={(e) => onChange(patchLicensePrice(draft, Number(e.target.value)))}
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm font-bold text-text-primary"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      {formatFcfa(license.price)} — à vie, hébergement client
                    </p>
                  </div>
                ) : null}
                {subscription ? (
                  <div>
                    <label htmlFor="editor-sub-price" className="mb-1 block text-xs font-semibold text-text-secondary">
                      Abonnement / mois — SaaS en ligne
                    </label>
                    <input
                      id="editor-sub-price"
                      type="number"
                      min={0}
                      step={500}
                      value={subscription.price}
                      onChange={(e) => onChange(patchSubscriptionPrice(draft, Number(e.target.value)))}
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm font-bold text-text-primary"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      {formatFcfa(subscription.price)} / mois — Infinite Core
                    </p>
                    <label htmlFor="editor-saas-url" className="mb-1 mt-3 block text-xs font-semibold text-text-secondary">
                      URL SaaS (abonnement)
                    </label>
                    <input
                      id="editor-saas-url"
                      type="url"
                      value={draft.saasBaseUrl ?? ''}
                      onChange={(e) =>
                        onChange(
                          patchDraft(draft, {
                            saasBaseUrl: e.target.value.trim() || undefined,
                          })
                        )
                      }
                      placeholder="https://app.infinitecore.net"
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      URL partagée multi-tenant (un déploiement, un tenant par client). Laissez vide pour
                      provisionner manuellement.
                    </p>
                    <label htmlFor="editor-tenant-route" className="mb-1 mt-3 block text-xs font-semibold text-text-secondary">
                      Routage tenant (multi-tenant)
                    </label>
                    <select
                      id="editor-tenant-route"
                      value={draft.saasTenantRoute ?? 'query'}
                      onChange={(e) =>
                        onChange(
                          patchDraft(draft, {
                            saasTenantRoute: e.target.value as 'query' | 'path',
                          })
                        )
                      }
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="query">Paramètre URL (?tenant=…)</option>
                      <option value="path">Chemin URL (/t/…)</option>
                    </select>
                    {(draft.saasTenantRoute ?? 'query') === 'query' ? (
                      <>
                        <label htmlFor="editor-tenant-key" className="mb-1 mt-2 block text-xs font-semibold text-text-secondary">
                          Nom du paramètre
                        </label>
                        <input
                          id="editor-tenant-key"
                          type="text"
                          value={draft.saasTenantQueryKey ?? 'tenant'}
                          onChange={(e) =>
                            onChange(
                              patchDraft(draft, {
                                saasTenantQueryKey: e.target.value.trim() || 'tenant',
                              })
                            )
                          }
                          placeholder="tenant"
                          className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                        />
                      </>
                    ) : null}
                    <label htmlFor="editor-saas-billing" className="mb-1 mt-3 block text-xs font-semibold text-text-secondary">
                      Facturation abonnement
                    </label>
                    <select
                      id="editor-saas-billing"
                      value={draft.saasBillingMode ?? 'infinitecore'}
                      onChange={(e) =>
                        onChange(
                          patchDraft(draft, {
                            saasBillingMode: e.target.value as 'infinitecore' | 'external',
                          })
                        )
                      }
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="infinitecore">Infinite Core (Stripe + jeton SaaS)</option>
                      <option value="external">Application (paiement sur le site de l&apos;app)</option>
                    </select>
                    {(draft.saasBillingMode ?? 'infinitecore') === 'external' ? (
                      <>
                        <label htmlFor="editor-saas-checkout" className="mb-1 mt-3 block text-xs font-semibold text-text-secondary">
                          URL paiement abonnement (externe)
                        </label>
                        <input
                          id="editor-saas-checkout"
                          type="url"
                          value={draft.saasExternalCheckoutUrl ?? ''}
                          onChange={(e) =>
                            onChange(
                              patchDraft(draft, {
                                saasExternalCheckoutUrl: e.target.value.trim() || undefined,
                              })
                            )
                          }
                          placeholder="https://app.example.com/subscribe?tenant={tenantId}"
                          className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                        />
                        <p className="mt-1 text-xs text-text-muted">
                          Placeholders : {'{tenantId}'}, {'{userId}'}, {'{email}'}, {'{appId}'}, {'{moduleKey}'}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-text-muted">
                        Jeton <code className="text-[10px]">ic_token</code> (inclut{' '}
                        <code className="text-[10px]">tenantId</code>) — vérification via{' '}
                        <code className="text-[10px]">GET /api/saas/verify-token</code>
                      </p>
                    )}
                    <label htmlFor="editor-saas-provision-wh" className="mb-1 mt-3 block text-xs font-semibold text-text-secondary">
                      Webhook provision tenant (app)
                    </label>
                    <input
                      id="editor-saas-provision-wh"
                      type="url"
                      value={draft.saasProvisionWebhookUrl ?? ''}
                      onChange={(e) =>
                        onChange(
                          patchDraft(draft, {
                            saasProvisionWebhookUrl: e.target.value.trim() || undefined,
                          })
                        )
                      }
                      placeholder="https://app.example.com/api/infinitecore/tenant"
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                    />
                    <label htmlFor="editor-saas-events-wh" className="mb-1 mt-2 block text-xs font-semibold text-text-secondary">
                      Webhook événements (suspend / reprise)
                    </label>
                    <input
                      id="editor-saas-events-wh"
                      type="url"
                      value={draft.saasWebhookUrl ?? ''}
                      onChange={(e) =>
                        onChange(
                          patchDraft(draft, {
                            saasWebhookUrl: e.target.value.trim() || undefined,
                          })
                        )
                      }
                      placeholder="https://app.example.com/api/infinitecore/events"
                      className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Header <code className="text-[10px]">X-InfiniteCore-SaaS-Key</code> = SAAS_BRIDGE_API_KEY
                    </p>
                  </div>
                ) : null}
              </div>
              {!draft.onlineCheckout && (
                <p className="mt-3 text-xs text-noya-blue">
                  Tarifs affichés seulement. Activez le paiement en ligne pour l’achat direct.
                </p>
              )}
            </div>
          </Section>

          <Section title="Images">
            <AppCatalogImageManager
              appId={draft.id}
              imageUrl={draft.imageUrl}
              galleryImages={draft.galleryImages}
              onChange={(patch) => onChange(patchDraft(draft, patch))}
            />
          </Section>

          <Section title="Page détail">
            <div className="grid gap-4">
              <div>
                <label htmlFor="editor-long-desc" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Description longue
                </label>
                <textarea
                  id="editor-long-desc"
                  value={draft.longDescription ?? ''}
                  rows={3}
                  onChange={(e) => onChange(patchDraft(draft, { longDescription: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-problem" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Problème résolu
                </label>
                <textarea
                  id="editor-problem"
                  value={draft.problem ?? ''}
                  rows={3}
                  onChange={(e) => onChange(patchDraft(draft, { problem: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-advantages" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Avantages (une ligne = un point)
                </label>
                <textarea
                  id="editor-advantages"
                  value={listToLines(draft.advantages)}
                  rows={4}
                  onChange={(e) => onChange(patchDraft(draft, { advantages: linesToList(e.target.value) }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          </Section>

          <Section title="Fonctionnalités (page détail)">
            <AppCatalogFeaturesEditor
              features={draft.features ?? []}
              onChange={(features) => onChange(patchDraft(draft, { features }))}
              onImportDefaults={
                APP_CATALOG_DETAIL_DEFAULTS[draft.id]?.features?.length
                  ? () =>
                      onChange(
                        patchDraft(draft, {
                          features: [...(APP_CATALOG_DETAIL_DEFAULTS[draft.id].features ?? [])],
                        })
                      )
                  : undefined
              }
            />
          </Section>

          <Section title="Liens & livraison">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="editor-demo" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Lien démo
                </label>
                <input
                  id="editor-demo"
                  value={draft.demoUrl ?? ''}
                  onChange={(e) => onChange(patchDraft(draft, { demoUrl: e.target.value }))}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-whatsapp" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  WhatsApp
                </label>
                <input
                  id="editor-whatsapp"
                  value={draft.whatsappNumber ?? ''}
                  onChange={(e) => onChange(patchDraft(draft, { whatsappNumber: e.target.value }))}
                  placeholder="2250103015467"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="editor-wa-msg" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Message WhatsApp
                </label>
                <input
                  id="editor-wa-msg"
                  value={draft.whatsappMessage ?? ''}
                  onChange={(e) => onChange(patchDraft(draft, { whatsappMessage: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Package licence (ZIP)</p>
                <AppCatalogPackageUpload
                  appId={draft.id}
                  packageUrl={draft.licensePackageUrl}
                  packagePublicId={draft.licensePackagePublicId}
                  packageName={draft.licensePackageName}
                  onChange={(patch) => onChange(patchDraft(draft, patch))}
                />
                <label htmlFor="editor-package-url" className="mb-1 mt-3 block text-xs font-semibold text-text-muted">
                  URL externe (optionnel)
                </label>
                <input
                  id="editor-package-url"
                  value={draft.licensePackageUrl ?? ''}
                  onChange={(e) =>
                    onChange(
                      patchDraft(draft, {
                        licensePackageUrl: e.target.value,
                        licensePackagePublicId: e.target.value.trim() ? draft.licensePackagePublicId : '',
                        licensePackageName: e.target.value.trim() ? draft.licensePackageName : '',
                      })
                    )
                  }
                  placeholder="https://…/package.zip"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="editor-guide" className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                  Guide d&apos;installation (URL)
                </label>
                <input
                  id="editor-guide"
                  value={draft.installGuideUrl ?? ''}
                  onChange={(e) => onChange(patchDraft(draft, { installGuideUrl: e.target.value }))}
                  placeholder="https://…/guide.pdf"
                  className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          </Section>
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-border bg-noya-sidebar px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-text-primary/5"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
              isCreate ? 'bg-noya-green text-noya-black' : 'bg-noya-blue text-noya-black'
            }`}
          >
            {isCreate ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isCreate ? 'Créer l’application' : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
