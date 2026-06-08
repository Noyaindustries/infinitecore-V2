import { Link } from 'react-router-dom';
import { Cloud, ExternalLink } from 'lucide-react';
import type { AppCatalogEntry } from '../data/appCatalog';
import type { AppLicense } from '@/lib/licenses';
import { isSaasSubscriptionReady, resolveSaasProvisioningStatus, resolveSaasUrl } from '../lib/saasAccess';
import { buildExternalCheckoutUrl, isExternalSaasBilling } from '../lib/saasBilling';
import { defaultSaasTenantId, resolveSaasTenantId } from '../lib/saasAccess';
import { useAuth } from './AuthProvider';

type Props = {
  licenses: AppLicense[];
  catalogApps: AppCatalogEntry[];
};

export default function AppSubscriptionSaasCards({ licenses, catalogApps }: Props) {
  const { user } = useAuth();
  const subscriptions = licenses.filter((l) => l.type === 'subscription');
  const externalApps = catalogApps.filter(
    (a) =>
      isExternalSaasBilling(a) &&
      (a.saasExternalCheckoutUrl?.trim() || a.saasBaseUrl?.trim()) &&
      !subscriptions.some((l) => l.appId === a.id || l.moduleKey === a.moduleKey)
  );
  if (subscriptions.length === 0 && externalApps.length === 0) return null;

  return (
    <section className="rounded-2xl border border-noya-orange/20 bg-noya-orange/5 p-5 sm:p-6">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-noya-orange">
        Applications SaaS (abonnement)
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Abonnement actif : ouvrez votre espace tenant (multi-tenant). Paiement géré par Infinite Core ou par
        l&apos;application selon la formule.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {externalApps.map((app) => {
          const checkoutUrl =
            app.saasExternalCheckoutUrl?.trim() && user?.uid
              ? buildExternalCheckoutUrl(app.saasExternalCheckoutUrl.trim(), {
                  userId: user.uid,
                  email: user.email ?? undefined,
                  appId: app.id,
                  moduleKey: app.moduleKey,
                  tenantId: defaultSaasTenantId(user.uid, app.id),
                })
              : null;
          const appUrl = app.saasBaseUrl?.trim();
          return (
            <div
              key={`ext-${app.id}`}
              className="rounded-xl border border-white/[0.08] bg-[#060910]/90 p-4"
            >
              <div className="flex items-start gap-3">
                <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-noya-orange" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{app.title}</p>
                  <p className="mt-1 text-xs text-text-muted">Paiement sur le site de l&apos;application</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {checkoutUrl ? (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-noya-orange px-3 py-2 text-xs font-semibold text-noya-black"
                  >
                    S&apos;abonner
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
                {appUrl ? (
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-text-primary/5"
                  >
                    Ouvrir l&apos;app
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
                <Link
                  to={`/module/${app.moduleKey}/dashboard`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-text-primary/5"
                >
                  Portail Infinite Core
                </Link>
              </div>
            </div>
          );
        })}
        {subscriptions.map((license) => {
          const app = catalogApps.find((a) => a.moduleKey === license.moduleKey || a.id === license.appId);
          if (app && isExternalSaasBilling(app)) {
            const checkoutUrl =
              app.saasExternalCheckoutUrl?.trim() && user?.uid
                ? buildExternalCheckoutUrl(app.saasExternalCheckoutUrl.trim(), {
                    userId: user.uid,
                    email: user.email ?? undefined,
                    appId: app.id,
                    moduleKey: app.moduleKey,
                    tenantId: resolveSaasTenantId(license),
                  })
                : null;
            return (
              <div
                key={license.id}
                className="rounded-xl border border-white/[0.08] bg-[#060910]/90 p-4"
              >
                <p className="font-semibold text-text-primary">{license.appName || app.title}</p>
                <p className="mt-1 text-xs text-text-muted">Abonnement géré par l&apos;application</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {checkoutUrl ? (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-noya-orange px-3 py-2 text-xs font-semibold text-noya-black"
                    >
                      Gérer l&apos;abonnement
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          }
          const ready = isSaasSubscriptionReady(license, app);
          const status = resolveSaasProvisioningStatus(license, app);
          const url = resolveSaasUrl(license, app);

          return (
            <div
              key={license.id}
              className="rounded-xl border border-white/[0.08] bg-[#060910]/90 p-4"
            >
              <div className="flex items-start gap-3">
                <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-noya-orange" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{license.appName || app?.title}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {status === 'ready'
                      ? 'SaaS actif'
                      : status === 'suspended'
                        ? 'Suspendu'
                        : 'Déploiement en cours…'}
                    {license.expiresAt
                      ? ` · jusqu'au ${new Date(license.expiresAt).toLocaleDateString('fr-FR')}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ready && url ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-noya-orange px-3 py-2 text-xs font-semibold text-noya-black"
                    >
                      Ouvrir le SaaS
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    <Link
                      to={`/module/${license.moduleKey}/dashboard`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-text-primary/5"
                    >
                      Module intégré
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/dashboard/messagerie"
                    className="text-xs font-semibold text-noya-orange hover:underline"
                  >
                    Instance en préparation — contacter l&apos;équipe
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
