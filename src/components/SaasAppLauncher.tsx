import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, ExternalLink, Loader2, MessageCircle } from 'lucide-react';
import type { AppCatalogEntry } from '../data/appCatalog';
import type { AppLicense } from '@/lib/licenses';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from './AuthProvider';
import {
  appendSaasTokenToUrl,
  buildExternalCheckoutUrl,
  isExternalSaasBilling,
} from '../lib/saasBilling';
import {
  appendTenantToSaasUrl,
  defaultSaasTenantId,
  resolveSaasProvisioningStatus,
  resolveSaasTenantId,
  resolveSaasUrl,
  isSaasSubscriptionReady,
} from '../lib/saasAccess';

type Props = {
  license?: AppLicense | null;
  app?: AppCatalogEntry;
  embedded?: boolean;
};

export default function SaasAppLauncher({ license, app, embedded = true }: Props) {
  const { user, userData } = useAuth();
  const [iframeError, setIframeError] = useState(false);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const externalBilling = isExternalSaasBilling(app);

  const status = license ? resolveSaasProvisioningStatus(license, app) : 'pending';

  const tenantId = useMemo(() => {
    if (license) return resolveSaasTenantId(license);
    if (user?.uid && app?.id) return defaultSaasTenantId(user.uid, app.id);
    return null;
  }, [license, user?.uid, app?.id]);

  const saasUrl = useMemo(() => {
    if (license) return resolveSaasUrl(license, app);
    const base = app?.saasBaseUrl?.trim();
    if (!base || !tenantId) return base || null;
    return appendTenantToSaasUrl(base, tenantId, app);
  }, [license, app, tenantId]);

  const ready = license ? isSaasSubscriptionReady(license, app) : Boolean(app?.saasBaseUrl?.trim());

  const externalCheckoutUrl = useMemo(() => {
    const template = app?.saasExternalCheckoutUrl?.trim();
    if (!template || !user?.uid) return null;
    return buildExternalCheckoutUrl(template, {
      userId: user.uid,
      email: user.email ?? undefined,
      appId: app?.id,
      moduleKey: app?.moduleKey,
      tenantId: tenantId ?? undefined,
    });
  }, [app, user?.uid, user?.email, tenantId]);

  useEffect(() => {
    if (externalBilling || !license || !ready || !saasUrl) {
      setLaunchUrl(saasUrl);
      return;
    }
    let cancelled = false;
    setLoadingToken(true);
    apiRequest<{ success: boolean; token?: string }>(
      `/api/saas/access-token?appId=${encodeURIComponent(license.appId)}`
    )
      .then((res) => {
        if (cancelled) return;
        if (res.token) {
          setLaunchUrl(appendSaasTokenToUrl(saasUrl, res.token));
        } else {
          setLaunchUrl(saasUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setLaunchUrl(saasUrl);
      })
      .finally(() => {
        if (!cancelled) setLoadingToken(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalBilling, license, ready, saasUrl]);

  if (externalBilling) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" aria-hidden />
            <div>
              <p className="font-bold text-orange-900">Abonnement géré par l&apos;application</p>
              <p className="mt-2 text-sm text-orange-800">
                Application <strong>multi-tenant</strong> : un espace isolé par client
              {tenantId ? (
                <>
                  {' '}
                  (tenant <code className="rounded bg-orange-100 px-1 text-xs">{tenantId}</code>)
                </>
              ) : null}
              . Paiement sur le site de l&apos;app — pas de double facturation Infinite Core.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {externalCheckoutUrl ? (
              <a
                href={externalCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
              >
                S&apos;abonner / payer
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
            {saasUrl ? (
              <a
                href={saasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-100"
              >
                Ouvrir l&apos;application
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
        {embedded && saasUrl ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <iframe
              title={`${app?.title ?? 'Application'} — SaaS`}
              src={saasUrl}
              className="h-[min(75vh,720px)] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (license && (status === 'suspended' || license.status === 'suspended' || license.status === 'expired')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-bold text-red-900">Abonnement suspendu</p>
        <p className="mt-2 text-sm text-red-800">
          L&apos;accès SaaS est suspendu (paiement ou résiliation). Réactivez votre abonnement depuis la boutique.
        </p>
        <Link
          to="/dashboard/boutique"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Gérer mon abonnement
        </Link>
      </div>
    );
  }

  if (!ready || !saasUrl || loadingToken) {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-orange-700" aria-hidden />
          <div>
            <p className="font-bold text-orange-900">
              {loadingToken ? 'Connexion sécurisée au SaaS…' : 'Instance SaaS en cours de déploiement'}
            </p>
            <p className="mt-2 text-sm text-orange-800">
              {loadingToken
                ? 'Génération du jeton d’accès Infinite Core pour votre application hébergée.'
                : `Infinite Core prépare votre espace SaaS. Délai indicatif : ${app?.deliveryLabel ?? '24-48 h'}.`}
            </p>
            <Link
              to="/dashboard/messagerie"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-900 hover:underline"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Contacter l&apos;équipe
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const openUrl = launchUrl ?? saasUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-orange-900">
          <Cloud className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>SaaS actif</strong> — {app?.title ?? license?.appName}
            {userData?.email ? (
              <span className="ml-1 text-orange-700/80">({userData.email})</span>
            ) : null}
          </span>
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
        >
          Ouvrir en plein écran
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      {embedded && !iframeError ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <iframe
            title={`${app?.title ?? license?.appName} — SaaS`}
            src={openUrl}
            className="h-[min(75vh,720px)] w-full border-0"
            onError={() => setIframeError(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          />
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          L&apos;application s&apos;ouvre dans un nouvel onglet. Utilisez le bouton ci-dessus si la fenêtre ne
          s&apos;affiche pas ici.
        </p>
      )}
    </div>
  );
}
