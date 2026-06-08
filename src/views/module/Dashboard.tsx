import type { ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAppByModuleKey } from '../../data/appCatalog';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import { useLicenses } from '../../hooks/useLicenses';
import AppCatalogCardImage from '../../components/AppCatalogCardImage';
import ModuleDeliveryBanner from '../../components/ModuleDeliveryBanner';
import SaasAppLauncher from '../../components/SaasAppLauncher';
import { isExternalSaasBilling } from '../../lib/saasBilling';
import {
  AcademyDashboard,
  CommsDashboard,
  CRMDashboard,
  FinanceDashboard,
  ProjectsDashboard,
  RHDashboard,
  StoreDashboard,
} from './ModuleViews';

/** Écrans métier démo — les nouvelles apps utilisent le tableau de bord générique. */
const LEGACY_MODULE_COMPONENTS: Record<string, ComponentType> = {
  crm: CRMDashboard,
  finance: FinanceDashboard,
  rh: RHDashboard,
  projects: ProjectsDashboard,
  academy: AcademyDashboard,
  comms: CommsDashboard,
  store: StoreDashboard,
};

function GenericAppDashboard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-gray-600">{desc}</p>
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Licence active — l&apos;interface métier complète sera déployée ici.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {['Tableau de bord', 'Rapports', 'Paramètres'].map((label) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center text-sm font-semibold text-gray-700">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModuleDashboard() {
  const { id } = useParams();
  const { apps } = useAppCatalog();
  const { activeLicenses } = useLicenses();
  const moduleKey = id || '';
  const app = getAppByModuleKey(moduleKey, apps);
  const LegacyView = LEGACY_MODULE_COMPONENTS[moduleKey];
  const moduleLicense = activeLicenses.find((l) => l.moduleKey === moduleKey);
  const externalSaas = Boolean(app && isExternalSaasBilling(app));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {app && (
              <div className="hidden w-28 shrink-0 sm:block">
                <AppCatalogCardImage app={app} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Infinite Core</p>
              <h1 className="truncate text-xl font-bold text-gray-900">{app?.title ?? `Module ${moduleKey}`}</h1>
            </div>
          </div>
          <Link to="/dashboard" className="shrink-0 text-sm font-semibold text-[#F27D26] hover:underline">
            Mon espace
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        {moduleLicense?.type === 'subscription' || externalSaas ? (
          <SaasAppLauncher license={moduleLicense} app={app} />
        ) : (
          <>
            {moduleLicense ? <ModuleDeliveryBanner license={moduleLicense} app={app} /> : null}
            {LegacyView ? (
              <LegacyView />
            ) : (
              <GenericAppDashboard
                title={app?.title ?? moduleKey}
                desc={app?.desc ?? 'Application sous licence.'}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
