import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Star, Search, Zap, Building2, Globe,
  LayoutTemplate, Wrench, Share2, TrendingUp, X, CheckCircle2,
  Send, ExternalLink, Sparkles
} from 'lucide-react';
import AppCatalogCardImage from '../../components/AppCatalogCardImage';
import AppHowToGetAppGuide from '../../components/AppHowToGetAppGuide';
import { db, auth } from '@/lib/clientSdk';
import { collection, doc, setDoc } from '@/lib/mongoFirestore';
import { apiRequest } from '@/lib/apiClient';
import { useAuth } from '../../components/AuthProvider';
import toast from 'react-hot-toast';
import { PADDE_CI_FREE_AUDITS } from '../../data/paddeCiFreeAudits';
import {
  formatFcfa,
  formatPricingHostingLabel,
  formatPricingHostingShort,
  type AppPricing,
} from '../../data/appCatalog';
import { openPaddeCiAuditForm } from '../../utils/openPaddeCiAuditForm';
import { useLicenses } from '../../hooks/useLicenses';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import { buildExternalCheckoutUrl, isExternalSaasBilling } from '../../lib/saasBilling';
import { defaultSaasTenantId } from '../../lib/saasAccess';
const AUDIT_ICONS = {
  'audit-rapide': Zap,
  'audit-business': Search,
  'audit-institutionnel': Building2,
} as const;

type ShopSelection = {
  id: string;
  title: string;
  duration: string;
  desc?: string;
  moduleKey?: string;
  imageUrl?: string;
  onlineCheckout?: boolean;
  isSubscription?: boolean;
  billingCycle?: string;
  price?: number;
  pricing?: AppPricing[];
};

export default function ClientShop() {
  const { user, userData } = useAuth();
  const { canAccessModule } = useLicenses();
  const { apps: catalogApps, loading: catalogLoading } = useAppCatalog();
  const [selectedService, setSelectedService] = useState<ShopSelection | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<AppPricing | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    const checkoutType = params.get('type');
    if (checkout === 'success') {
      if (checkoutType === 'license') {
        toast.success('Licence activée — consultez la messagerie et Mon espace pour télécharger votre application.');
      } else {
        toast.success('Abonnement actif — ouvrez Mes applications. Gérez le paiement via « Gérer mes abonnements ».');
      }
    } else if (checkout === 'cancel') {
      toast("Paiement annulé. Vous pouvez réessayer quand vous voulez.");
    }
    params.delete('checkout');
    params.delete('type');
    params.delete('orderId');
    const next = params.toString();
    const newUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  const auditPadde = PADDE_CI_FREE_AUDITS.map((a) => ({
    ...a,
    icon: AUDIT_ICONS[a.id as keyof typeof AUDIT_ICONS],
    color: 'text-noya-orange',
    bg: 'bg-text-primary/5',
  }));

  // Autres services PADDE-CI — payants
  const autresServicesPadde = [
    { id: 'presenz-one', title: 'PRESENZ One-Page', price: 75000, desc: 'Site web professionnel one-page + WhatsApp + Facebook + coaching 60 min', duration: '7 jours ouvrables', icon: Globe, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 'presenz-pro', title: 'PRESENZ PRO + ERP', price: 250000, desc: 'Site complet multi-pages + fonctionnalités avancées + intégration ERP', duration: '15-21 jours', icon: LayoutTemplate, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'maint-mens', title: 'Maintenance Mensuelle', price: 25000, desc: 'Hébergement, mises à jour, 2 modifications/mois, support WhatsApp', duration: 'Mensuel — en continu', icon: Wrench, color: 'text-gray-500', bg: 'bg-gray-50', isSubscription: true, billingCycle: 'mensuel' },
    { id: 'rs-starter', title: 'RS Formule Starter', price: 45000, desc: '8 visuels/mois Facebook + 4 visuels Instagram + coaching publication', duration: 'Mensuel', icon: Share2, color: 'text-pink-500', bg: 'bg-pink-50', isSubscription: true, billingCycle: 'mensuel' },
    { id: 'rs-croissance', title: 'RS Formule Croissance', price: 85000, desc: 'Starter + 4 Reels TikTok/Reels + 1 campagne Meta Ads + rapport mensuel', duration: 'Mensuel', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50', isSubscription: true, billingCycle: 'mensuel' },
    { id: 'rs-dominance', title: 'RS Formule Dominance', price: 150000, desc: 'Croissance + carrousels + stories + 2 campagnes Ads + retargeting', duration: 'Mensuel', icon: Star, color: 'text-red-500', bg: 'bg-red-50', isSubscription: true, billingCycle: 'mensuel' },
  ];

  const coreModules = catalogApps.map((app) => ({
    ...app,
    duration: app.deliveryLabel,
  }));

  const selectedCatalogApp = selectedService
    ? catalogApps.find((a) => a.id === selectedService.id)
    : undefined;
  const usesExternalSubscriptionCheckout = Boolean(
    selectedPricing?.type === 'subscription' &&
      selectedCatalogApp &&
      isExternalSaasBilling(selectedCatalogApp) &&
      selectedCatalogApp.saasExternalCheckoutUrl?.trim()
  );

  const closeOrderModal = useCallback(() => {
    if (isSubmitting) return;
    setSelectedService(null);
    setSelectedPricing(null);
    setNote('');
    setOrderSent(false);
  }, [isSubmitting]);

  const handleOrderClick = (service: ShopSelection, pricing?: AppPricing) => {
    if (!auth.currentUser) {
      toast.error('Vous devez être connecté pour passer une commande.');
      return;
    }
    setSelectedService(service);
    setSelectedPricing(pricing ?? service.pricing?.[0] ?? null);
    setNote('');
    setOrderSent(false);
  };

  useEffect(() => {
    if (!selectedService) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOrderModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedService, closeOrderModal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preselectApp = params.get('app');
    if (!preselectApp || !catalogApps.length || !auth.currentUser) return;
    const mod = coreModules.find((m) => m.id === preselectApp);
    if (!mod) return;
    handleOrderClick(mod);
    params.delete('app');
    const next = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois au chargement catalogue + session
  }, [catalogApps.length, auth.currentUser?.uid]);

  const submitOrderViaMessagerie = async (options?: { stripeUnavailable?: boolean }) => {
    if (!auth.currentUser || !selectedService) return;
    const clientName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || auth.currentUser.email || 'Client';
    const orderId = `CMD-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    const isSub =
      selectedService.isSubscription === true || selectedPricing?.type === 'subscription';
    const amount = selectedPricing?.price ?? selectedService.price ?? 0;

    await setDoc(doc(db, 'orders', orderId), {
      id: orderId,
      userId: auth.currentUser.uid,
      clientName,
      clientEmail: auth.currentUser.email,
      serviceName: selectedService.title,
      serviceId: selectedService.id,
      moduleKey: selectedService.moduleKey || null,
      isSubscription: isSub,
      billingCycle:
        selectedPricing?.type === 'subscription'
          ? selectedPricing.billingCycle
          : selectedService.billingCycle || null,
      orderType: isSub ? 'abonnement' : selectedPricing?.type === 'license' ? 'licence' : 'service',
      amount,
      note: note.trim() || null,
      status: 'En attente',
      paymentMode: isSub ? 'manuel-messagerie' : 'messagerie',
      stripeUnavailable: options?.stripeUnavailable === true,
      createdAt: new Date().toISOString(),
    });

    const subLine = isSub
      ? `\n\nType : Abonnement ${selectedService.billingCycle || 'mensuel'} — paiement à organiser manuellement (Stripe non disponible).`
      : '';

    const msgRef = doc(collection(db, 'chats', auth.currentUser.uid, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: auth.currentUser.uid,
      senderName: clientName,
      senderRole: 'client',
      text: `Demande de service : ${selectedService.title}${note ? `\n\nNote : ${note}` : ''}${subLine}`,
      type: 'order',
      orderDetails: {
        serviceName: selectedService.title,
        orderId,
        isSubscription: isSub,
        billingCycle: selectedService.billingCycle || null,
      },
      createdAt: new Date().toISOString(),
      readByCommando: false,
    });

    await setDoc(doc(db, 'chats', auth.currentUser.uid), {
      clientId: auth.currentUser.uid,
      clientName,
      clientEmail: auth.currentUser.email,
      lastMessage: `Commande : ${selectedService.title}`,
      lastMessageAt: new Date().toISOString(),
      unreadCommando: true,
    }, { merge: true });

    try {
      await apiRequest<{ success: boolean; notified?: number; error?: string }>(
        '/api/orders/notify-team',
        {
          method: 'POST',
          body: JSON.stringify({
            orderId,
            serviceName: selectedService.title,
            note: note.trim() || null,
            isSubscription: isSub,
            billingCycle: selectedService.billingCycle || null,
            stripeUnavailable: options?.stripeUnavailable === true,
          }),
        }
      );
    } catch (notifyError) {
      // La commande est créée et le message envoyé : on ne bloque pas l'utilisateur si la notif échoue.
      console.warn('[ClientShop] notify-team failed:', notifyError);
    }

    setOrderSent(true);
  };

  const startStripeCheckout = async (
    endpoint: '/api/stripe/checkout/subscription' | '/api/stripe/checkout/license',
    body: Record<string, unknown>
  ) => {
    const payload = await apiRequest<{
      success: boolean;
      checkoutUrl?: string;
      error?: string;
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!payload?.checkoutUrl) {
      throw new Error(payload?.error || "Impossible d'ouvrir la page de paiement.");
    }
    window.location.assign(payload.checkoutUrl);
  };

  const handleConfirmOrder = async () => {
    if (!auth.currentUser || !selectedService) return;
    setIsSubmitting(true);

    try {
      const pricing = selectedPricing;
      if (selectedService.onlineCheckout && pricing) {
        try {
          if (pricing.type === 'subscription') {
            const catalogApp = catalogApps.find((a) => a.id === selectedService.id);
            if (catalogApp && isExternalSaasBilling(catalogApp)) {
              const checkoutTemplate = catalogApp.saasExternalCheckoutUrl?.trim();
              if (!checkoutTemplate) {
                toast.error('URL de paiement de l’application non configurée. Contactez l’équipe.');
                return;
              }
              const url = buildExternalCheckoutUrl(checkoutTemplate, {
                userId: auth.currentUser.uid,
                email: auth.currentUser.email ?? undefined,
                appId: catalogApp.id,
                moduleKey: catalogApp.moduleKey,
                tenantId: defaultSaasTenantId(auth.currentUser.uid, catalogApp.id),
              });
              window.location.assign(url);
              return;
            }
          }
          if (pricing.type === 'license') {
            await startStripeCheckout('/api/stripe/checkout/license', {
              appId: selectedService.id,
              appName: selectedService.title,
              moduleKey: selectedService.moduleKey || selectedService.id,
              amount: pricing.price,
              licenseDurationDays: pricing.type === 'license' ? pricing.durationDays : 0,
              ...(note.trim() ? { note: note.trim() } : {}),
            });
            return;
          }
          await startStripeCheckout('/api/stripe/checkout/subscription', {
            serviceId: selectedService.id,
            serviceName: selectedService.title,
            moduleKey: selectedService.moduleKey || selectedService.id,
            amount: pricing.price,
            billingCycle: pricing.billingCycle,
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          return;
        } catch (stripeError) {
          const msg = stripeError instanceof Error ? stripeError.message : String(stripeError);
          const stripeUnavailable = /Stripe non configur/i.test(msg) || /STRIPE_SECRET_KEY/i.test(msg);
          if (!stripeUnavailable) {
            throw stripeError;
          }
          await submitOrderViaMessagerie({ stripeUnavailable: true });
          toast.success('Paiement en ligne indisponible — votre demande a été envoyée à l\'équipe via la messagerie.');
          return;
        }
      }

      if (selectedService.isSubscription === true) {
        try {
          await startStripeCheckout('/api/stripe/checkout/subscription', {
            serviceId: selectedService.id,
            serviceName: selectedService.title,
            amount: selectedService.price,
            billingCycle: selectedService.billingCycle || 'mensuel',
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          return;
        } catch (stripeError) {
          const msg = stripeError instanceof Error ? stripeError.message : String(stripeError);
          const stripeUnavailable = /Stripe non configur/i.test(msg) || /STRIPE_SECRET_KEY/i.test(msg);
          if (!stripeUnavailable) {
            throw stripeError;
          }
          await submitOrderViaMessagerie({ stripeUnavailable: true });
          toast.success('Paiement en ligne indisponible — votre demande a été envoyée à l\'équipe via la messagerie.');
          return;
        }
      }

      await submitOrderViaMessagerie();
    } catch (error) {
      console.error('Erreur commande:', error);
      const msg = error instanceof Error ? error.message : 'Erreur lors de l\'envoi de la commande.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!auth.currentUser) {
      toast.error('Vous devez être connecté.');
      return;
    }
    setOpeningPortal(true);
    try {
      const payload = await apiRequest<{ success: boolean; url?: string; error?: string }>(
        '/api/stripe/billing-portal-session',
        { method: 'POST' }
      );
      if (!payload.url) {
        throw new Error(payload.error || "Impossible d'ouvrir le portail d'abonnement.");
      }
      window.location.assign(payload.url);
    } catch (error) {
      console.error('[ClientShop] billing portal:', error);
      toast.error("Impossible d'ouvrir la gestion des abonnements.");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Boutique & Services — Catalogue Complet</h1>
        <div className="mt-4 bg-noya-blue/10 border-l-4 border-noya-blue p-4 rounded-r-lg">
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-noya-blue">NOTE</span> —{' '}
            <strong>Licence à vie</strong> : vous hébergez l&apos;application chez vous (package ZIP).{' '}
            <strong>Abonnement</strong> : accès SaaS en ligne — paiement mensuel soit sur Infinite Core (Stripe,
            espace tenant automatique), soit sur le site de l&apos;application (selon l&apos;app choisie).
          </p>
          <button
            type="button"
            onClick={() => void handleOpenBillingPortal()}
            disabled={openingPortal}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-noya-blue/35 bg-noya-blue/15 px-3 py-2 text-xs font-semibold text-noya-blue transition-colors hover:bg-noya-blue/20 disabled:opacity-60"
          >
            {openingPortal ? 'Ouverture...' : 'Gérer mes abonnements'}
          </button>
        </div>
      </div>

      <AppHowToGetAppGuide variant="shop" />

      <div className="space-y-12">

        {/* ── Audits PADDE-CI GRATUITS ────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6 border-b-2 border-noya-orange/20 pb-3">
            <div className="p-2 bg-noya-orange/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-noya-orange" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Audits PADDE-CI — 100% Gratuits</h2>
              <p className="text-sm text-text-secondary mt-0.5">Diagnostiquez votre entreprise sans engagement — résultats livrés par nos experts</p>
            </div>
            <span className="ml-auto px-3 py-1 bg-noya-green/10 text-noya-green text-xs font-bold rounded-full uppercase tracking-wide border border-noya-green/20">Gratuit</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {auditPadde.map((audit, index) => (
              <motion.div
                key={audit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                className="bg-noya-sidebar rounded-2xl p-6 shadow-sm border border-noya-orange/20 hover:shadow-[0_0_20px_rgba(255,179,50,0.15)] hover:border-noya-orange/40 transition-all flex flex-col h-full relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-noya-orange/5 rounded-full blur-[50px] -mr-10 -mt-10 group-hover:bg-noya-orange/10 transition-colors"></div>
                <div className="flex items-start gap-4 mb-4 relative z-10">
                  <div className={`p-3 rounded-xl bg-text-primary/5`}>
                    <audit.icon className={`w-6 h-6 text-noya-orange`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-text-primary leading-tight">{audit.title}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-noya-green/10 text-noya-green text-xs font-bold rounded-md border border-noya-green/20">GRATUIT</span>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-6 flex-grow relative z-10">{audit.desc}</p>
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-border relative z-10">
                  <div className="text-xs text-text-secondary">
                    <span className="block font-medium text-text-muted mb-1">Délai de réponse</span>
                    {audit.duration}
                  </div>
                  <button
                    type="button"
                    onClick={() => openPaddeCiAuditForm(audit.formUrl)}
                    className="flex items-center gap-1.5 text-sm font-bold text-noya-black bg-noya-orange hover:bg-noya-orange/80 transition-colors px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(255,179,50,0.3)]"
                  >
                    Demander <ExternalLink size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 bg-noya-orange/5 border border-noya-orange/20 rounded-xl p-4 text-sm text-noya-orange">
            <strong>Comment ça marche ?</strong> Cliquez sur "Demander" — votre demande est enregistrée et vous serez redirigé vers un nouvel onglet pour le formulaire PADDE-CI. Notre équipe vous contacte dans la messagerie avec les résultats.
          </div>
        </section>

        {/* ── Autres Services PADDE-CI ────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-text-primary mb-6 border-b-2 border-border pb-2">
            Catégorie 1 — Services PADDE-CI
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {autresServicesPadde.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-noya-sidebar rounded-2xl p-6 shadow-sm border border-border hover:border-noya-blue/30 hover:bg-text-primary/5 transition-all flex flex-col h-full"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-text-primary/5`}>
                    <service.icon className={`w-6 h-6 text-noya-blue`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary leading-tight">{service.title}</h3>
                    <p className="text-noya-green font-bold mt-1 tracking-wider">Sur devis</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-6 flex-grow">{service.desc}</p>
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-border">
                  <div className="text-xs text-text-secondary">
                    <span className="block font-medium text-text-muted mb-1">Durée livraison</span>
                    {service.duration}
                  </div>
                  <button
                    onClick={() => handleOrderClick(service)}
                    className="flex items-center gap-1 text-sm font-medium text-noya-blue hover:text-noya-blue/80 transition-colors bg-noya-blue/10 hover:bg-noya-blue/20 px-3 py-1.5 rounded-lg border border-noya-blue/20"
                  >
                    Commander <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Modules Infinite Core ───────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-text-primary mb-6 border-b-2 border-border pb-2">
            Catégorie 2 — Applications métier
          </h2>
          {catalogLoading ? (
            <div className="h-32 animate-pulse rounded-2xl bg-text-primary/5" aria-hidden />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((module) => {
              const owned = canAccessModule(module.moduleKey);
              const subPrice = module.pricing.find((p) => p.type === 'subscription');
              const licensePrice = module.pricing.find((p) => p.type === 'license');
              return (
              <div
                key={module.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-noya-sidebar shadow-sm transition-all hover:border-noya-orange/30 hover:bg-text-primary/5"
              >
                {owned && (
                  <span className="absolute right-4 top-4 z-10 rounded-full border border-noya-green/25 bg-noya-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-noya-green">
                    Actif
                  </span>
                )}
                <Link to={`/applications/${module.id}`} className="block shrink-0">
                  <AppCatalogCardImage app={module} showTitle={false} className="rounded-none border-0 border-b border-border" />
                </Link>
                <div className="flex flex-1 flex-col p-5">
                <Link to={`/applications/${module.id}`}>
                  <h3 className="text-lg font-bold leading-tight text-text-primary hover:text-noya-orange transition-colors">{module.title}</h3>
                </Link>
                {module.onlineCheckout && subPrice ? (
                  <div className="mt-1">
                    <p className="font-bold text-noya-orange">À partir de {formatFcfa(subPrice.price)}/mois</p>
                    <p className="text-[11px] text-text-muted">
                      {isExternalSaasBilling(module)
                        ? 'Abonnement sur le site de l’app'
                        : 'SaaS hébergé par Infinite Core'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 font-bold text-noya-orange">Sur devis</p>
                )}
                <p className="mb-4 mt-3 flex-grow text-sm text-text-secondary">{module.desc}</p>
                {module.onlineCheckout && licensePrice && (
                  <p className="text-xs text-text-muted mb-4">
                    Licence à vie : {formatFcfa(licensePrice.price)} — auto-hébergée chez vous
                  </p>
                )}
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-border gap-2">
                  <div className="text-xs text-text-secondary">
                    <span className="block font-medium text-text-muted mb-1">Mise en service</span>
                    {module.duration}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Link
                      to={`/applications/${module.id}`}
                      className="flex items-center gap-1 text-sm font-medium text-noya-blue hover:text-noya-blue/80 transition-colors bg-noya-blue/10 hover:bg-noya-blue/20 px-3 py-1.5 rounded-lg border border-noya-blue/20"
                    >
                      Détails
                    </Link>
                    <button
                      onClick={() => handleOrderClick(module)}
                      className="flex items-center gap-1 text-sm font-medium text-noya-orange hover:text-noya-orange/80 transition-colors bg-noya-orange/10 hover:bg-noya-orange/20 px-3 py-1.5 rounded-lg border border-noya-orange/20"
                    >
                      {module.onlineCheckout ? 'Acheter' : 'Commander'} <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                </div>
              </div>
            );})}
          </div>
          )}
        </section>
      </div>

      {/* Modale commande — portal + z-index au-dessus des barres d’espace */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedService ? (
              <div
                className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
                role="presentation"
                onClick={(e) => e.target === e.currentTarget && closeOrderModal()}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  className="flex max-h-[min(92dvh,820px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0D1320] shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="shop-order-modal-title"
                >
                  <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-noya-black/90 px-4 py-4 backdrop-blur-md md:px-6">
                    <h3 id="shop-order-modal-title" className="text-lg font-bold text-text-primary md:text-xl">
                      {selectedService.onlineCheckout ? 'Choisir votre formule' : 'Confirmer la demande'}
                    </h3>
                    <button
                      type="button"
                      onClick={closeOrderModal}
                      title="Fermer"
                      aria-label="Fermer"
                      className="shrink-0 rounded-xl border border-border p-2 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                    >
                      <X size={20} aria-hidden />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {!orderSent ? (
                  <div className="space-y-6">
                    <div className="bg-noya-blue/10 p-4 rounded-2xl border border-noya-blue/20">
                      <p className="text-sm text-noya-blue font-medium mb-1">Application sélectionnée</p>
                      <h4 className="text-lg font-bold text-text-primary">{selectedService.title}</h4>
                      <p className="text-xs text-text-secondary mt-2">Mise en service : {selectedService.duration}</p>
                      {usesExternalSubscriptionCheckout ? (
                        <p className="text-xs text-noya-blue mt-1">
                          Redirection vers le paiement de l&apos;application — pas de double facturation Infinite Core.
                        </p>
                      ) : selectedService.onlineCheckout ? (
                        <p className="text-xs text-noya-blue mt-1">Paiement sécurisé Stripe — accès activé automatiquement.</p>
                      ) : (
                        <p className="text-xs text-noya-blue mt-1">Notre équipe vous communiquera les modalités de paiement dans la messagerie.</p>
                      )}
                    </div>

                    {selectedService.onlineCheckout && selectedService.pricing && selectedService.pricing.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-text-primary">Formule</p>
                        {selectedService.pricing.map((option) => (
                          <label
                            key={option.type === 'license' ? `license-${option.durationDays}` : `sub-${option.billingCycle}`}
                            className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                              selectedPricing === option
                                ? 'border-noya-orange bg-noya-orange/10'
                                : 'border-border hover:border-noya-orange/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="pricing"
                                checked={selectedPricing === option}
                                onChange={() => setSelectedPricing(option)}
                                className="accent-noya-orange"
                              />
                              <div>
                                <span className="text-sm font-medium text-text-primary">
                                  {option.label ??
                                    (option.type === 'license' ? 'Licence à vie' : 'Abonnement mensuel')}
                                </span>
                                <p className="text-xs text-text-muted">{formatPricingHostingShort(option)}</p>
                                <p className="text-[11px] text-text-muted">{formatPricingHostingLabel(option)}</p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-noya-orange">
                              {formatFcfa(option.price)}
                              {option.type === 'subscription' ? '/mois' : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Note pour l'équipe (optionnel)
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Précisez vos besoins spécifiques, votre secteur d'activité..."
                        className="w-full px-4 py-3 bg-noya-black border border-border text-text-primary rounded-xl focus:ring-1 focus:ring-noya-orange outline-none resize-none text-sm placeholder-text-muted"
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={closeOrderModal}
                        disabled={isSubmitting}
                        className="w-full rounded-2xl border border-border py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-white/5 disabled:opacity-50 sm:flex-1"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmOrder}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-noya-blue py-4 text-lg font-bold text-noya-black shadow-[0_0_15px_rgba(110,167,234,0.3)] transition-all hover:scale-[1.02] disabled:opacity-70 sm:flex-[2]"
                      >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <><Send size={20} /> {usesExternalSubscriptionCheckout ? 'Payer sur le site de l\'app' : selectedService.onlineCheckout ? 'Payer en ligne' : 'Envoyer la demande'}</>
                      )}
                      </button>
                    </div>
                    <p className="text-center text-xs text-text-muted">
                      {usesExternalSubscriptionCheckout
                        ? 'Vous serez redirigé vers la page d’abonnement de l’application.'
                        : selectedService.onlineCheckout
                          ? 'Vous serez redirigé vers Stripe pour finaliser le paiement.'
                          : 'Notre équipe vous contactera dans la messagerie pour organiser le paiement.'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-noya-green/20 text-noya-green border border-noya-green/30 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={48} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-text-primary">Demande envoyée !</h3>
                      <p className="text-text-secondary mt-2">Notre équipe va traiter votre demande et vous recontactera dans la <strong>Messagerie</strong> très prochainement.</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeOrderModal}
                      className="w-full rounded-2xl border border-border bg-text-primary/5 py-4 font-bold text-text-primary transition-all hover:bg-text-primary/10"
                    >
                      Retour à la boutique
                    </button>
                  </div>
                )}
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
