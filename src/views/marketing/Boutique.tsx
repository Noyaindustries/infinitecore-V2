import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Cloud,
  ExternalLink,
  Search,
  Server,
  ShoppingCart,
  Sparkles,
  Zap,
  Building2,
} from 'lucide-react';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import { useAuth } from '../../components/AuthProvider';
import AppCatalogBoutiqueCard from '../../components/AppCatalogBoutiqueCard';
import { PADDE_CI_FREE_AUDITS } from '../../data/paddeCiFreeAudits';
import { openPaddeCiAuditForm } from '../../utils/openPaddeCiAuditForm';

type FilterId = 'all' | 'saas' | 'license';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'saas', label: 'Abonnement SaaS' },
  { id: 'license', label: 'Licence à vie' },
];

const AUDIT_ICONS = {
  'audit-rapide': Zap,
  'audit-business': Search,
  'audit-institutionnel': Building2,
} as const;

export default function Boutique() {
  const { apps, loading } = useAppCatalog();
  const { user, userData } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const isClient = Boolean(user && role === 'client');
  const buyTo = (appId: string) =>
    isClient ? `/dashboard/boutique?app=${appId}` : '/signup';
  const buyLabel = isClient ? 'Acheter' : 'Créer un compte';

  const purchasable = useMemo(
    () => apps.filter((a) => a.onlineCheckout && a.pricing.length > 0),
    [apps],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchasable.filter((app) => {
      const hasSub = app.pricing.some((p) => p.type === 'subscription');
      const hasLicense = app.pricing.some((p) => p.type === 'license');
      if (filter === 'saas' && !hasSub) return false;
      if (filter === 'license' && !hasLicense) return false;
      if (!q) return true;
      return (
        app.title.toLowerCase().includes(q) ||
        app.desc.toLowerCase().includes(q) ||
        app.id.toLowerCase().includes(q)
      );
    });
  }, [purchasable, query, filter]);

  return (
    <div className="relative z-10 pb-24">
      {/* Hero */}
      <section className="border-b border-white/5 bg-[#06080D] py-14 md:py-20">
        <div className="container mx-auto max-w-[1200px] px-6">
          <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFB332] before:mr-3 before:h-px before:w-6 before:bg-[#FFB332] after:ml-3 after:h-px after:w-6 after:bg-[#FFB332]">
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
            Boutique officielle
          </span>
          <h1 className="max-w-3xl text-3xl font-black tracking-tight text-[#F2F4F8] md:text-5xl">
            Applications métier — licences &amp; abonnements
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#8D98AA] md:text-lg">
            Choisissez votre mode : <strong className="text-[#C5CDD9]">licence à vie</strong> (vous hébergez) ou{' '}
            <strong className="text-[#C5CDD9]">abonnement SaaS</strong> (hébergé par Infinite Core). Paiement en FCFA,
            activation rapide.
          </p>

          <div className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-[#0D1320] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <Search className="h-5 w-5 shrink-0 text-[#8D98AA]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une application (ERP, caisse, clinique…)"
              className="w-full bg-transparent text-sm text-[#F2F4F8] outline-none placeholder:text-[#6B7280]"
              aria-label="Rechercher dans la boutique"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  filter === f.id
                    ? 'bg-[#FFB332] text-[#06080D]'
                    : 'border border-white/10 bg-white/5 text-[#8D98AA] hover:text-[#F2F4F8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto max-w-[1200px] px-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" aria-hidden />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0D1320] px-6 py-16 text-center">
              <p className="text-lg font-semibold text-[#F2F4F8]">Aucune application trouvée</p>
              <p className="mt-2 text-sm text-[#8D98AA]">Modifiez votre recherche ou réinitialisez les filtres.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="mt-6 text-sm font-bold text-[#FFB332] hover:underline"
              >
                Réinitialiser
              </button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-[#8D98AA]">
                {filtered.length} application{filtered.length !== 1 ? 's' : ''} disponible
                {filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((app) => (
                  <AppCatalogBoutiqueCard
                    key={app.id}
                    app={app}
                    buyTo={buyTo(app.id)}
                    buyLabel={buyLabel}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-t border-white/5 bg-[#06080D] py-12 md:py-16">
        <div className="container mx-auto max-w-[1200px] px-6">
          <h2 className="text-2xl font-black text-[#F2F4F8] md:text-3xl">Comment obtenir votre application</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#6EA7EA]/25 bg-[#6EA7EA]/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-[#6EA7EA]">
                <Server className="h-5 w-5" aria-hidden />
                <h3 className="font-bold">Licence à vie — chez vous</h3>
              </div>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[#8D98AA]">
                <li>Créez votre compte et choisissez l&apos;application</li>
                <li>Payez en ligne (Stripe) ou via la messagerie</li>
                <li>Téléchargez le package ZIP et le guide d&apos;installation</li>
                <li>Hébergez sur votre serveur ou cloud</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-[#FFB332]/25 bg-[#FFB332]/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-[#FFB332]">
                <Cloud className="h-5 w-5" aria-hidden />
                <h3 className="font-bold">Abonnement — SaaS en ligne</h3>
              </div>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[#8D98AA]">
                <li>Souscrivez depuis la boutique client</li>
                <li>Accès immédiat à l&apos;URL SaaS (multi-tenant)</li>
                <li>Pas d&apos;installation — Infinite Core héberge pour vous</li>
                <li>Gérez le renouvellement depuis votre espace</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Audits PADDE gratuits */}
      <section className="border-t border-white/5 py-12 md:py-16">
        <div className="container mx-auto max-w-[1200px] px-6">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFB332]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                PADDE-CI · Gratuit
              </span>
              <h2 className="mt-2 text-2xl font-black text-[#F2F4F8]">Audits digitaux offerts</h2>
              <p className="mt-2 max-w-xl text-sm text-[#8D98AA]">
                Diagnostic gratuit avant d&apos;investir — réservé aux clients connectés.
              </p>
            </div>
            {!isClient && (
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#6EA7EA] hover:gap-3"
              >
                Créer un compte pour demander
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PADDE_CI_FREE_AUDITS.map((audit) => {
              const Icon = AUDIT_ICONS[audit.id as keyof typeof AUDIT_ICONS];
              return (
                <div
                  key={audit.id}
                  className="flex flex-col rounded-2xl border border-white/8 bg-[#0D1320] p-5"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFB332]/12 text-[#FFB332]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F2F4F8]">{audit.title}</h3>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-[#2BC673]">Gratuit</p>
                    </div>
                  </div>
                  <p className="flex-1 text-xs leading-relaxed text-[#8D98AA]">{audit.desc}</p>
                  <p className="mt-3 text-[11px] text-[#6B7280]">Délai : {audit.duration}</p>
                  {isClient ? (
                    <button
                      type="button"
                      onClick={() => openPaddeCiAuditForm(audit.formUrl)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFB332] px-3 py-2.5 text-xs font-bold text-[#06080D] transition hover:brightness-105"
                    >
                      Demander l&apos;audit
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </button>
                  ) : (
                    <Link
                      to="/signup"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-[#8D98AA] transition hover:border-[#FFB332]/40 hover:text-[#F2F4F8]"
                    >
                      Compte requis
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 bg-[#06080D] py-14">
        <div className="container mx-auto max-w-[800px] px-6 text-center">
          <h2 className="text-2xl font-black text-[#F2F4F8] md:text-3xl">Prêt à digitaliser votre activité ?</h2>
          <p className="mt-3 text-sm text-[#8D98AA] md:text-base">
            Compte gratuit, paiement sécurisé, accompagnement par l&apos;équipe Infinite Core.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={isClient ? '/dashboard/boutique' : '/signup'}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFB332] px-6 py-3 text-sm font-bold text-[#06080D] shadow-[0_8px_24px_rgba(255,179,50,0.35)] transition hover:brightness-105"
            >
              {isClient ? 'Ouvrir ma boutique client' : 'Créer mon compte'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link to="/tarifs" className="text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]">
              Voir les packs tarifaires
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
