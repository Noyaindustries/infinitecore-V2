import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { useAppCatalog } from '../hooks/useAppCatalog';
import { useAuth } from './AuthProvider';
import { formatFcfa } from '../data/appCatalog';
import AppCatalogCardImage from './AppCatalogCardImage';

export default function HomeAppCatalogSection() {
  const { apps, loading } = useAppCatalog();
  const { user, userData } = useAuth();
  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const isClient = Boolean(user && role === 'client');

  const purchasable = apps.filter((a) => a.onlineCheckout && a.pricing.length > 0);

  const ctaTo = isClient ? '/dashboard/boutique' : '/signup';
  const ctaLabel = isClient ? 'Ouvrir la boutique' : 'Créer un compte et acheter';

  return (
    <section id="boutique" className="relative z-10 border-t border-white/5 py-16 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-6">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFB332] before:mr-3 before:h-px before:w-6 before:bg-[#FFB332] after:ml-3 after:h-px after:w-6 after:bg-[#FFB332]">
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
            Boutique applications
          </span>
          <h2 className="text-3xl font-black tracking-tight text-[#F2F4F8] md:text-[44px]">
            Licences &amp; abonnements
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#8D98AA] md:text-[15px]">
            ERP, CRM, caisse et applications métier.{' '}
            <strong className="text-[#C5CDD9]">Licence à vie</strong> : vous hébergez chez vous.{' '}
            <strong className="text-[#C5CDD9]">Abonnement</strong> : SaaS en ligne, hébergé par Infinite Core.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/5" aria-hidden />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {purchasable.map((app) => {
              const sub = app.pricing.find((p) => p.type === 'subscription');
              const license = app.pricing.find((p) => p.type === 'license');
              return (
                <div
                  key={app.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0D1320] transition-all duration-500 hover:border-[#FFB332]/35 hover:shadow-[0_0_40px_rgba(255,179,50,0.12)]"
                >
                  <Link to={`/applications/${app.id}`} className="block shrink-0">
                    <AppCatalogCardImage app={app} showTitle={false} className="rounded-none border-0 border-b border-white/5" />
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                  <Link to={`/applications/${app.id}`}>
                    <h3 className="text-lg font-bold text-[#F2F4F8] transition hover:text-[#FFB332]">{app.title}</h3>
                  </Link>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#8D98AA]">{app.desc}</p>
                  <div className="mt-4 space-y-1 border-t border-white/5 pt-4 text-sm">
                    {sub && (
                      <div>
                        <p className="font-bold text-[#FFB332]">
                          {formatFcfa(sub.price)}
                          <span className="text-xs font-medium text-[#8D98AA]"> / mois</span>
                        </p>
                        <p className="text-[11px] text-[#6B7280]">SaaS — hébergé par Infinite Core</p>
                      </div>
                    )}
                    {license && (
                      <p className="text-xs text-[#8D98AA]">
                        ou licence à vie {formatFcfa(license.price)} — auto-hébergée
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <Link
                      to={`/applications/${app.id}`}
                      className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6EA7EA] transition-all hover:gap-3"
                    >
                      En savoir plus
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                    <Link
                      to={ctaTo}
                      className="inline-flex items-center gap-2 text-[13px] font-bold text-[#FFB332] transition-all hover:gap-3"
                    >
                      {isClient ? 'Acheter' : 'Commencer'}
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={ctaTo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFB332] px-6 py-3 text-sm font-bold text-[#06080D] shadow-[0_8px_24px_rgba(255,179,50,0.35)] transition hover:brightness-105"
          >
            {ctaLabel}
            <ArrowRight size={18} aria-hidden />
          </Link>
          {isClient ? (
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]"
            >
              Mes applications actives
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]"
            >
              Déjà client ? Se connecter
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
