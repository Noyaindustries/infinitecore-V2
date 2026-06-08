import { Link, Outlet, useParams } from 'react-router-dom';
import { useLicenses } from '../hooks/useLicenses';
import { getAppByModuleKey } from '../data/appCatalog';
import { useAppCatalog } from '../hooks/useAppCatalog';
import { isExternalSaasBilling } from '../lib/saasBilling';

export default function ModuleLicenseGate() {
  const { id: moduleKey } = useParams();
  const { canAccessModule, loading, bypass } = useLicenses();
  const { apps } = useAppCatalog();
  const app = moduleKey ? getAppByModuleKey(moduleKey, apps) : undefined;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#2A4365]" />
      </div>
    );
  }

  const externalSaasPortal = Boolean(app && isExternalSaasBilling(app) && app.saasBaseUrl?.trim());
  const allowed = bypass || canAccessModule(moduleKey!) || externalSaasPortal;

  if (!moduleKey || !allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Licence requise</h1>
        <p className="mt-2 max-w-md text-gray-600">
          {app
            ? `Vous n'avez pas encore de licence active pour ${app.title}.`
            : 'Cette application nécessite une licence ou un abonnement actif.'}
        </p>
        <Link
          to="/dashboard/boutique"
          className="mt-6 rounded-xl bg-noya-orange px-5 py-3 font-semibold text-noya-black transition hover:opacity-90"
        >
          Voir la boutique
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
