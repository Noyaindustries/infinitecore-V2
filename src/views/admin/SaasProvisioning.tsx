import { useEffect, useMemo, useState } from 'react';
import { Cloud, ExternalLink, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { licenseService } from '../../services/licenseService';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import type { AppLicense } from '@/lib/licenses';
import { resolveSaasProvisioningStatus, resolveSaasTenantId, resolveSaasUrl } from '../../lib/saasAccess';
import { apiRequest } from '../../lib/apiClient';

export default function SaasProvisioning() {
  const { apps: catalogApps } = useAppCatalog();
  const [licenses, setLicenses] = useState<AppLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [tenantDrafts, setTenantDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = licenseService.subscribeToAllLicenses((rows) => {
      setLicenses(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const subscriptions = useMemo(
    () => licenses.filter((l) => l.type === 'subscription'),
    [licenses]
  );

  const pendingCount = useMemo(
    () =>
      subscriptions.filter((license) => {
        const app = catalogApps.find((a) => a.id === license.appId || a.moduleKey === license.moduleKey);
        return resolveSaasProvisioningStatus(license, app) === 'pending';
      }).length,
    [subscriptions, catalogApps]
  );

  const handleProvision = async (license: AppLicense) => {
    const app = catalogApps.find((a) => a.id === license.appId || a.moduleKey === license.moduleKey);
    const url = (urlDrafts[license.id] ?? license.saasInstanceUrl ?? '').trim();
    const tenantId = (
      tenantDrafts[license.id] ?? resolveSaasTenantId(license)
    ).trim();
    if (!url && !tenantId) {
      toast.error('Indiquez un tenant ou une URL dédiée.');
      return;
    }
    setSavingId(license.id);
    try {
      await apiRequest<{ success: boolean; error?: string }>('/api/admin/saas/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: license.userId,
          appId: license.appId,
          saasInstanceUrl: url || undefined,
          saasTenantId: tenantId || undefined,
        }),
      });
      toast.success(app?.saasBaseUrl ? 'Tenant SaaS enregistré.' : 'Instance SaaS provisionnée.');
      setUrlDrafts((prev) => {
        const next = { ...prev };
        delete next[license.id];
        return next;
      });
      setTenantDrafts((prev) => {
        const next = { ...prev };
        delete next[license.id];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du provisionnement.';
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Provisionnement SaaS</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Apps multi-tenant : une URL partagée dans le catalogue, un tenant par client. Confirmez ou ajustez le
          tenant après création dans l&apos;app.
        </p>
        {!loading && (
          <p className="mt-2 text-xs text-text-muted">
            {subscriptions.length} abonnement(s) · {pendingCount} en attente de déploiement
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement des abonnements…
        </div>
      ) : subscriptions.length === 0 ? (
        <p className="rounded-xl border border-border bg-text-primary/[0.02] p-6 text-sm text-text-muted">
          Aucun abonnement enregistré pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-text-primary/[0.03] text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">URL dédiée (optionnel)</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((license) => {
                const app = catalogApps.find((a) => a.id === license.appId || a.moduleKey === license.moduleKey);
                const status = resolveSaasProvisioningStatus(license, app);
                const currentUrl = resolveSaasUrl(license, app);
                const urlDraft = urlDrafts[license.id] ?? license.saasInstanceUrl ?? '';
                const tenantDraft = tenantDrafts[license.id] ?? resolveSaasTenantId(license);

                return (
                  <tr key={license.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{license.appName || app?.title}</p>
                      <p className="text-xs text-text-muted">{license.moduleKey}</p>
                      {app?.saasBaseUrl ? (
                        <p className="mt-1 text-[10px] text-text-muted">Multi-tenant : {app.saasBaseUrl}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{license.userId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          status === 'ready'
                            ? 'bg-green-500/15 text-green-400'
                            : status === 'suspended'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-orange-500/15 text-orange-400'
                        }`}
                      >
                        {status === 'ready' ? 'Prêt' : status === 'suspended' ? 'Suspendu' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={tenantDraft}
                        onChange={(e) =>
                          setTenantDrafts((prev) => ({ ...prev, [license.id]: e.target.value }))
                        }
                        placeholder="userId__appId"
                        className="w-full min-w-[160px] rounded-lg border border-border bg-noya-black px-3 py-2 font-mono text-xs text-text-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="url"
                        value={urlDraft}
                        onChange={(e) =>
                          setUrlDrafts((prev) => ({ ...prev, [license.id]: e.target.value }))
                        }
                        placeholder={app?.saasBaseUrl ? 'Instance dédiée (rare)' : 'https://client.app.example.com'}
                        className="w-full min-w-[200px] rounded-lg border border-border bg-noya-black px-3 py-2 text-xs text-text-primary"
                      />
                      {currentUrl && status === 'ready' ? (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-noya-orange hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          Ouvrir (tenant)
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={savingId === license.id}
                        onClick={() => handleProvision(license)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-noya-orange px-3 py-2 text-xs font-semibold text-noya-black disabled:opacity-50"
                      >
                        {savingId === license.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Save className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Enregistrer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-noya-orange/25 bg-noya-orange/5 p-4 text-sm text-text-secondary">
        <div className="flex items-start gap-2">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-noya-orange" aria-hidden />
          <p>
            Astuce : URL partagée + routage tenant dans le catalogue. Chaque abonnement reçoit un{' '}
            <code className="text-xs">saasTenantId</code> automatique (<code className="text-xs">userId__appId</code>
            ).
          </p>
        </div>
      </div>
    </div>
  );
}
