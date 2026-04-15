import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Star, Users, Wallet, FileSignature, Briefcase,
  GraduationCap, MessageSquare, ShoppingCart, Search, Zap, Building2, Globe,
  LayoutTemplate, Wrench, Share2, TrendingUp, Package, Crown, X, CheckCircle2,
  Send, ExternalLink, Sparkles
} from 'lucide-react';
import { db, auth } from '@/lib/clientSdk';
import { collection, doc, setDoc } from '@/lib/mongoFirestore';
import { apiRequest } from '@/lib/apiClient';
import { useAuth } from '../../components/AuthProvider';
import toast from 'react-hot-toast';
import { PADDE_CI_FREE_AUDITS } from '../../data/paddeCiFreeAudits';
import { openPaddeCiAuditForm } from '../../utils/openPaddeCiAuditForm';

const AUDIT_ICONS = {
  'audit-rapide': Zap,
  'audit-business': Search,
  'audit-institutionnel': Building2,
} as const;

export default function ClientShop() {
  const { user, userData } = useAuth();
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    if (checkout === 'success') {
      toast.success("Abonnement activé. Vous pouvez gérer votre offre via 'Gérer mes abonnements'.");
    } else if (checkout === 'cancel') {
      toast("Paiement annulé. Vous pouvez réessayer quand vous voulez.");
    }
    params.delete('checkout');
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

  const coreModules = [
    { id: 'crm', title: 'Infinite CRM', price: 15000, desc: 'Gestion clients, pipeline, devis, facturation, signature OHADA', duration: '5-7 jours', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'finance', title: 'Infinite Finance', price: 15000, desc: 'Trésorerie, factures, relances, rapports financiers en temps réel', duration: '5-7 jours', icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 'rh', title: 'Infinite RH', price: 15000, desc: 'Employés, paie CNPS, congés, contrats droit ivoirien', duration: '5-7 jours', icon: FileSignature, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'projects', title: 'Infinite Projects', price: 10000, desc: 'Kanban projets, tâches, deadlines, suivi client', duration: '5 jours', icon: Briefcase, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'academy', title: 'Infinite Academy', price: 10000, desc: 'Formation interne, quiz, certifications, bibliothèque ressources', duration: '5 jours', icon: GraduationCap, color: 'text-red-500', bg: 'bg-red-50' },
    { id: 'comms', title: 'Infinite Comms', price: 5000, desc: 'Messagerie sécurisée d\'entreprise — remplace WhatsApp pro', duration: '3-5 jours', icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'store', title: 'Infinite Store', price: 25000, desc: 'Boutique en ligne + Wave/Orange Money + lien CRM et finances', duration: '7-10 jours', icon: ShoppingCart, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'pack-croissance', title: 'Pack Croissance', price: 35000, desc: '3 modules au choix + onboarding dédié + support WhatsApp prioritaire', duration: '7-14 jours', icon: Package, color: 'text-teal-500', bg: 'bg-teal-50' },
    { id: 'pack-elite', title: 'Pack Elite', price: 95000, desc: '7 solutions + personnalisation + chef de projet dédié + SLA garanti', duration: 'Sur devis', icon: Crown, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  const handleOrderClick = (service: any) => {
    if (!auth.currentUser) {
      toast.error('Vous devez être connecté pour passer une commande.');
      return;
    }
    setSelectedService(service);
    setNote('');
    setOrderSent(false);
  };

  const handleConfirmOrder = async () => {
    if (!auth.currentUser || !selectedService) return;
    setIsSubmitting(true);

    try {
      if (selectedService.isSubscription === true) {
        const payload = await apiRequest<{
          success: boolean;
          checkoutUrl?: string;
          error?: string;
        }>('/api/stripe/checkout/subscription', {
          method: 'POST',
          body: JSON.stringify({
            serviceId: selectedService.id,
            serviceName: selectedService.title,
            amount: selectedService.price,
            billingCycle: selectedService.billingCycle || 'mensuel',
            note: note.trim() || null,
          }),
        });
        if (!payload?.checkoutUrl) {
          throw new Error(payload?.error || "Impossible d'ouvrir la page de paiement.");
        }
        window.location.assign(payload.checkoutUrl);
        return;
      }

      const clientName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || auth.currentUser.email || 'Client';
      const orderId = `CMD-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        userId: auth.currentUser.uid,
        clientName,
        clientEmail: auth.currentUser.email,
        serviceName: selectedService.title,
        serviceId: selectedService.id,
        isSubscription: selectedService.isSubscription === true,
        billingCycle: selectedService.billingCycle || null,
        orderType: selectedService.isSubscription === true ? 'abonnement' : 'service',
        amount: selectedService.price,
        note: note.trim() || null,
        status: 'En attente',
        createdAt: new Date().toISOString(),
      });

      const msgRef = doc(collection(db, 'chats', auth.currentUser.uid, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: auth.currentUser.uid,
        senderName: clientName,
        senderRole: 'client',
        text: `Demande de service : ${selectedService.title}${note ? `\n\nNote : ${note}` : ''}`,
        type: 'order',
        orderDetails: { serviceName: selectedService.title, orderId },
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

      setOrderSent(true);
    } catch (error) {
      console.error('Erreur commande:', error);
      toast.error('Erreur lors de l\'envoi de la commande.');
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
            <span className="font-bold text-noya-blue">NOTE</span> — Les offres marquées mensuelles ouvrent un paiement Stripe sécurisé avec renouvellement automatique.
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
            Catégorie 2 — Modules Infinite Core
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-noya-sidebar rounded-2xl p-6 shadow-sm border border-border hover:border-noya-orange/30 hover:bg-text-primary/5 transition-all flex flex-col h-full relative"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-text-primary/5`}>
                    <module.icon className={`w-6 h-6 text-noya-orange`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary leading-tight">{module.title}</h3>
                    <p className="text-noya-orange font-bold mt-1">Sur devis</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-6 flex-grow">{module.desc}</p>
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-border">
                  <div className="text-xs text-text-secondary">
                    <span className="block font-medium text-text-muted mb-1">Durée livraison</span>
                    {module.duration}
                  </div>
                  <button
                    onClick={() => handleOrderClick(module)}
                    className="flex items-center gap-1 text-sm font-medium text-noya-orange hover:text-noya-orange/80 transition-colors bg-noya-orange/10 hover:bg-noya-orange/20 px-3 py-1.5 rounded-lg border border-noya-orange/20"
                  >
                    Commander <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* Modale commande — services payants uniquement */}
      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0D1320] rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 w-full max-w-md overflow-hidden"
            >
              <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-noya-black/50">
                <h3 className="text-xl font-bold text-text-primary">Confirmer la demande</h3>
                <button
                  onClick={() => setSelectedService(null)}
                  title="Fermer la fenêtre"
                  aria-label="Fermer la fenêtre"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 md:p-8">
                {!orderSent ? (
                  <div className="space-y-6">
                    <div className="bg-noya-blue/10 p-4 rounded-2xl border border-noya-blue/20">
                      <p className="text-sm text-noya-blue font-medium mb-1">Service sélectionné</p>
                      <h4 className="text-lg font-bold text-text-primary">{selectedService.title}</h4>
                      <p className="text-xs text-text-secondary mt-2">Délai : {selectedService.duration}</p>
                      <p className="text-xs text-noya-blue mt-1">Notre équipe vous communiquera les modalités de paiement dans la messagerie.</p>
                    </div>

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

                    <button
                      onClick={handleConfirmOrder}
                      disabled={isSubmitting}
                      className="w-full py-4 bg-noya-blue text-noya-black rounded-2xl font-bold text-lg shadow-[0_0_15px_rgba(110,167,234,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <><Send size={20} /> Envoyer la demande</>
                      )}
                    </button>
                    <p className="text-center text-xs text-text-muted">
                      Notre équipe vous contactera dans la messagerie pour organiser le paiement.
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
                      onClick={() => setSelectedService(null)}
                      className="w-full py-4 bg-text-primary/5 text-text-primary hover:bg-text-primary/10 border border-border rounded-2xl font-bold transition-all"
                    >
                      Retour à la boutique
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
