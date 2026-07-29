import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  LayoutDashboard,
  MessageCircle,
  PlayCircle,
  ShoppingCart,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import { useAuth } from '../../components/AuthProvider';
import { useLicenses } from '../../hooks/useLicenses';
import {
  formatFcfa,
  formatLicenseHostingLabel,
  formatSubscriptionHostingLabel,
  getAppImageUrl,
  type AppLicensePricing,
  type AppSubscriptionPricing,
} from '../../data/appCatalog';
import AppCatalogCardImage from '../../components/AppCatalogCardImage';
import AppDetailGallery from '../../components/AppDetailGallery';
import AppDetailDemoLink from '../../components/AppDetailDemoLink';
import AppAppointmentForm from '../../components/AppAppointmentForm';
import { buildAppGallery } from '../../lib/appGallery';
import { resolveAppDemoUrl } from '../../lib/appDemoUrl';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import AppHowToGetAppGuide from '../../components/AppHowToGetAppGuide';
import { defaultSaasTenantId } from '../../lib/saasAccess';
import { buildExternalCheckoutUrl, isExternalSaasBilling } from '../../lib/saasBilling';

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const { apps, loading } = useAppCatalog();
  const { user, userData } = useAuth();
  const { canAccessModule } = useLicenses();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FFB332]" />
      </div>
    );
  }

  const app = apps.find((a) => a.id === appId);
  if (!app) return <Navigate to="/boutique" replace />;

  const license = app.pricing.find((p): p is AppLicensePricing => p.type === 'license');
  const subscription = app.pricing.find((p): p is AppSubscriptionPricing => p.type === 'subscription');
  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const isClient = Boolean(user && role === 'client');
  const owned = canAccessModule(app.moduleKey);
  const buyTo = isClient ? `/dashboard/boutique?app=${app.id}` : '/signup';
  const externalSubUrl =
    isClient &&
    user?.uid &&
    subscription &&
    isExternalSaasBilling(app) &&
    app.saasExternalCheckoutUrl?.trim()
      ? buildExternalCheckoutUrl(app.saasExternalCheckoutUrl.trim(), {
          userId: user.uid,
          email: user.email ?? undefined,
          appId: app.id,
          moduleKey: app.moduleKey,
          tenantId: defaultSaasTenantId(user.uid, app.id),
        })
      : null;
  const gallery = buildAppGallery(app);
  const demoUrl = resolveAppDemoUrl(app);
  const heroApp = { ...app, imageUrl: gallery[0] || getAppImageUrl(app) };
  const waUrl = buildWhatsAppUrl(
    app.whatsappNumber || '2250103015467',
    app.whatsappMessage || `Bonjour, je souhaite en savoir plus sur ${app.title}.`
  );

  return (
    <div className="relative z-10 pb-20">
      {/* Hero */}
      <section className="border-b border-white/5 bg-[#06080D] py-10 md:py-14">
        <div className="container mx-auto max-w-[1100px] px-6">
          <Link
            to="/boutique"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#8D98AA] transition hover:text-[#F2F4F8]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la boutique
          </Link>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#FFB332]/25 bg-[#FFB332]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FFB332]">
                <Sparkles className="h-3 w-3" />
                Application métier
              </span>
              <h1 className="text-3xl font-black tracking-tight text-[#F2F4F8] md:text-5xl">{app.title}</h1>
              <p className="mt-4 text-base leading-relaxed text-[#8D98AA] md:text-lg">
                {app.longDescription || app.desc}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {owned ? (
                  <Link
                    to={`/module/${app.moduleKey}/dashboard`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2BC673] px-5 py-3 text-sm font-bold text-[#06080D]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Ouvrir le module
                  </Link>
                ) : externalSubUrl ? (
                  <a
                    href={externalSubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FFB332] px-5 py-3 text-sm font-bold text-[#06080D]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    S&apos;abonner
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <Link
                    to={buyTo}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FFB332] px-5 py-3 text-sm font-bold text-[#06080D]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {isClient ? 'Acheter' : 'Créer un compte'}
                  </Link>
                )}
                {demoUrl ? (
                  <a
                    href={demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-[#F2F4F8] transition hover:border-[#6EA7EA]/50"
                  >
                    <PlayCircle className="h-4 w-4 text-[#6EA7EA]" />
                    Voir la démo
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                ) : null}
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2BC673]/30 bg-[#2BC673]/10 px-5 py-3 text-sm font-bold text-[#2BC673]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(255,179,50,0.08)]">
              <AppCatalogCardImage app={heroApp} showTitle={false} className="rounded-none" />
            </div>
          </div>
        </div>
      </section>

      <AppDetailGallery images={gallery} title={app.title} />

      {demoUrl ? <AppDetailDemoLink demoUrl={demoUrl} appTitle={app.title} /> : null}

      {/* Problème */}
      {app.problem && (
        <section className="border-b border-white/5 py-12">
          <div className="container mx-auto max-w-[900px] px-6">
            <div className="rounded-2xl border border-[#E15B64]/20 bg-[#E15B64]/5 p-6 md:p-8">
              <div className="mb-3 flex items-center gap-2 text-[#E15B64]">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-lg font-bold">Le problème que nous résolvons</h2>
              </div>
              <p className="text-[15px] leading-relaxed text-[#C8D0E0]">{app.problem}</p>
            </div>
          </div>
        </section>
      )}

      {/* Fonctionnalités */}
      {app.features && app.features.length > 0 && (
        <section className="border-b border-white/5 py-12">
          <div className="container mx-auto max-w-[1100px] px-6">
            <h2 className="mb-8 text-2xl font-bold text-[#F2F4F8]">Fonctionnalités clés</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {app.features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/8 bg-[#0D1320] p-5 transition hover:border-[#FFB332]/25"
                >
                  <h3 className="text-lg font-bold text-[#F2F4F8]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#8D98AA]">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Avantages */}
      {app.advantages && app.advantages.length > 0 && (
        <section className="border-b border-white/5 py-12">
          <div className="container mx-auto max-w-[900px] px-6">
            <h2 className="mb-6 text-2xl font-bold text-[#F2F4F8]">Avantages</h2>
            <ul className="space-y-3">
              {app.advantages.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[#C8D0E0]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2BC673]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Tarifs + module */}
      <section className="border-b border-white/5 py-12">
        <div className="container mx-auto max-w-[1100px] px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-2xl font-bold text-[#F2F4F8]">Tarifs</h2>
              <div className="space-y-4">
                {subscription && app.onlineCheckout && (
                  <div className="rounded-2xl border border-[#FFB332]/25 bg-[#FFB332]/5 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#FFB332]">Abonnement mensuel</p>
                    <p className="mt-2 text-3xl font-black text-[#F2F4F8]">
                      {formatFcfa(subscription.price)}
                      <span className="text-base font-medium text-[#8D98AA]"> / mois</span>
                    </p>
                    <p className="mt-2 text-xs text-[#8D98AA]">{formatSubscriptionHostingLabel()}</p>
                  </div>
                )}
                {license && app.onlineCheckout && (
                  <div className="rounded-2xl border border-white/10 bg-[#0D1320] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#6EA7EA]">Licence à vie</p>
                    <p className="mt-2 text-2xl font-black text-[#F2F4F8]">Sur devis</p>
                    <p className="mt-2 text-xs text-[#8D98AA]">{formatLicenseHostingLabel()}</p>
                    <p className="mt-3 text-sm text-[#8D98AA]">
                      Tarif personnalisé selon votre organisation — demandez un devis ou prenez rendez-vous.
                    </p>
                  </div>
                )}
                <p className="text-sm text-[#8D98AA]">
                  Délai de mise en service : <strong className="text-[#F2F4F8]">{app.deliveryLabel}</strong>
                </p>
                <p className="text-xs text-[#8D98AA]">
                  Module technique : <code className="rounded bg-white/5 px-1.5 py-0.5 text-[#F2F4F8]">{app.moduleKey}</code>
                </p>
              </div>
              <Link
                to={buyTo}
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#FFB332] hover:gap-3 transition-all"
              >
                Commander maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-8">
                <AppHowToGetAppGuide variant="detail" showMessagerieLink={isClient} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0D1320] p-6">
              <h2 className="mb-2 text-xl font-bold text-[#F2F4F8]">Prendre rendez-vous</h2>
              <p className="mb-6 text-sm text-[#8D98AA]">
                Démo personnalisée, devis sur mesure ou questions techniques — réponse sous 24h.
              </p>
              <AppAppointmentForm appId={app.id} appTitle={app.title} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
