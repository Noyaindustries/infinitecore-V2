import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { useAppCatalog } from '../hooks/useAppCatalog';
import { useAuth } from './AuthProvider';
import AppCatalogBoutiqueCard from './AppCatalogBoutiqueCard';

const PREVIEW_COUNT = 3;

export default function HomeAppCatalogSection() {
  const { apps, loading } = useAppCatalog();
  const { user, userData } = useAuth();
  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const isClient = Boolean(user && role === 'client');

  const purchasable = apps.filter((a) => a.onlineCheckout && a.pricing.length > 0);
  const preview = purchasable.slice(0, PREVIEW_COUNT);
  const buyLabel = isClient ? 'Acheter' : 'Commencer';
  const buyTo = (appId: string) =>
    isClient ? `/dashboard/boutique?app=${appId}` : '/signup';

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
            {preview.map((app) => (
              <AppCatalogBoutiqueCard key={app.id} app={app} buyTo={buyTo(app.id)} buyLabel={buyLabel} />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/boutique"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFB332] px-6 py-3 text-sm font-bold text-[#06080D] shadow-[0_8px_24px_rgba(255,179,50,0.35)] transition hover:brightness-105"
          >
            Voir toute la boutique
            <ArrowRight size={18} aria-hidden />
          </Link>
          {isClient ? (
            <Link
              to="/dashboard/boutique"
              className="text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]"
            >
              Acheter depuis mon espace
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]">
              Déjà client ? Se connecter
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
