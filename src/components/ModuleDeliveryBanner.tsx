import { Link } from 'react-router-dom';
import { Cloud, FileText, Server } from 'lucide-react';
import LicensePackageDownloadButton from './LicensePackageDownloadButton';
import type { AppCatalogEntry } from '../data/appCatalog';
import type { AppLicense } from '@/lib/licenses';
import { isLifetimeLicense } from '../lib/appDeliveryGuide';

type Props = {
  license: AppLicense;
  app?: AppCatalogEntry;
};

export default function ModuleDeliveryBanner({ license, app }: Props) {
  const lifetime = isLifetimeLicense(license, app);
  const packageUrl = app?.licensePackageUrl?.trim();
  const guideUrl = app?.installGuideUrl?.trim();

  if (lifetime) {
    return (
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-blue-900">Licence à vie — auto-hébergée</p>
            <p className="mt-1 text-sm text-blue-800">
              Installez cette application sur votre serveur. Délai indicatif : {app?.deliveryLabel ?? 'selon accompagnement'}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {packageUrl ? (
                <LicensePackageDownloadButton
                  packageUrl={packageUrl}
                  packageName={app?.licensePackageName}
                  appId={app?.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                />
              ) : (
                <Link
                  to="/dashboard/messagerie"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Demander le package via la messagerie
                </Link>
              )}
              {guideUrl ? (
                <a
                  href={guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Guide d&apos;installation
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex items-start gap-3">
        <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" aria-hidden />
        <div>
          <p className="font-bold text-orange-900">Abonnement actif — SaaS en ligne</p>
          <p className="mt-1 text-sm text-orange-800">
            Application hébergée par Infinite Core (multi-tenant). Ouvrez votre espace ci-dessous.
          </p>
        </div>
      </div>
    </div>
  );
}
