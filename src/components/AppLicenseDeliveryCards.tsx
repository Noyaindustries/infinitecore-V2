import { Link } from 'react-router-dom';
import { ExternalLink, FileText, MessageCircle, Server } from 'lucide-react';
import LicensePackageDownloadButton from './LicensePackageDownloadButton';
import type { AppCatalogEntry } from '../data/appCatalog';
import type { AppLicense } from '@/lib/licenses';
import { isLifetimeLicense } from '../lib/appDeliveryGuide';

type Props = {
  licenses: AppLicense[];
  catalogApps: AppCatalogEntry[];
};

export default function AppLicenseDeliveryCards({ licenses, catalogApps }: Props) {
  const lifetimeLicenses = licenses.filter((license) => {
    const app = catalogApps.find((a) => a.moduleKey === license.moduleKey || a.id === license.appId);
    return isLifetimeLicense(license, app);
  });

  if (lifetimeLicenses.length === 0) return null;

  return (
    <section className="rounded-2xl border border-noya-blue/20 bg-noya-blue/5 p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-noya-blue">
            Livraison — licences auto-hébergées
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Téléchargez et installez l&apos;application sur votre infrastructure.
          </p>
        </div>
        <Link
          to="/dashboard/messagerie"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-noya-orange hover:underline"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Contacter l&apos;équipe
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {lifetimeLicenses.map((license) => {
          const app = catalogApps.find((a) => a.moduleKey === license.moduleKey || a.id === license.appId);
          const packageUrl = app?.licensePackageUrl?.trim();
          const guideUrl = app?.installGuideUrl?.trim();

          return (
            <div
              key={license.id}
              className="rounded-xl border border-white/[0.08] bg-[#060910]/90 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-noya-blue/15 text-noya-blue">
                  <Server className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{license.appName || app?.title}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Licence à vie · délai {app?.deliveryLabel ?? 'selon accompagnement'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {packageUrl ? (
                  <LicensePackageDownloadButton
                    packageUrl={packageUrl}
                    packageName={app?.licensePackageName}
                    appId={app?.id}
                  />
                ) : (
                  <p className="text-xs text-text-muted">
                    Le lien de téléchargement sera envoyé via la messagerie.
                  </p>
                )}
                {guideUrl ? (
                  <a
                    href={guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-text-primary/5"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    Guide d&apos;installation
                    <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
