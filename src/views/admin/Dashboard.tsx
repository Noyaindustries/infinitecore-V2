import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';
import { cn } from '../../lib/utils';
import { useCommandoClients, clientDisplayName } from '../../hooks/useCommandoClients';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { leadService } from '../../services/leadService';
import toast from 'react-hot-toast';
import {
  FolderOpen,
  KanbanSquare,
  MessageCircle,
  Users,
  Briefcase,
  Wallet,
  Copy,
  Sparkles,
  ClipboardList,
  ChevronRight,
  Bell,
} from 'lucide-react';

const shortcuts: {
  to: string;
  title: string;
  description: string;
  icon: typeof FolderOpen;
  highlight?: boolean;
}[] = [
  {
    to: '/admin/dossiers',
    title: 'Dossiers clients',
    description:
      'Déposer les documents du parcours (audit, proposition, contrat, facture) pour un client — ce n’est pas sur cette page d’accueil, mais ici.',
    icon: FolderOpen,
    highlight: true,
  },
  {
    to: '/admin/pipeline',
    title: 'Pipeline Noya',
    description: 'Kanban des missions et tâches opérationnelles.',
    icon: KanbanSquare,
  },
  {
    to: '/admin/audits-padde',
    title: 'Audits PADDE-CI',
    description: 'Flux padde-ci.com : liste, détail et prise en charge des commandes audit.',
    icon: ClipboardList,
  },
  {
    to: '/admin/clients',
    title: 'CRM clients',
    description: 'Fiches et suivi des comptes clients.',
    icon: Users,
  },
  {
    to: '/admin/leads',
    title: 'Leads partenaires',
    description: 'Visualiser tous les leads acquis via les liens partenaires.',
    icon: Users,
  },
  {
    to: '/admin/messagerie',
    title: 'Messagerie',
    description: 'Échanges avec les clients.',
    icon: MessageCircle,
  },
  {
    to: '/admin/operations',
    title: 'Opérations',
    description: 'Vue opérationnelle consolidée.',
    icon: Briefcase,
  },
  {
    to: '/admin/finance',
    title: 'Finance',
    description: 'Indicateurs et suivi financier.',
    icon: Wallet,
  },
  {
    to: '/admin/instances',
    title: 'Clonage d’instances',
    description: 'Duplication et gestion des instances.',
    icon: Copy,
  },
];

function HeroCorners() {
  const corner = 'absolute h-10 w-10 border-luxe-champagne/35 pointer-events-none';
  return (
    <>
      <span className={cn(corner, 'left-5 top-5 border-l border-t rounded-tl-sm')} aria-hidden />
      <span className={cn(corner, 'right-5 top-5 border-r border-t rounded-tr-sm')} aria-hidden />
      <span className={cn(corner, 'bottom-5 left-5 border-b border-l rounded-bl-sm')} aria-hidden />
      <span className={cn(corner, 'bottom-5 right-5 border-b border-r rounded-br-sm')} aria-hidden />
    </>
  );
}

export default function AdminDashboard() {
  const { user, userData } = useAuth();
  const isCommandoOnly = userData?.role === 'commando';
  const firstName = userData?.firstName?.trim() || null;
  const { clients: crmClients, loading: crmLoading } = useCommandoClients();
  const recentCrm = useMemo(() => crmClients.slice(0, 5), [crmClients]);
  const [referralAlerts, setReferralAlerts] = useState<
    Array<{
      id: string;
      message: string;
      createdAt: string;
      referralCode: string;
      referredByPartnerId: string | null;
      referredByPartnerName: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      companyName: string;
      industry: string;
      leadCreated: boolean;
    }>
  >([]);
  const [creatingLeadNotifId, setCreatingLeadNotifId] = useState<string | null>(null);
  const [partnerLeads, setPartnerLeads] = useState<
    Array<{
      id: string;
      partnerId?: string;
      firstName?: string;
      lastName?: string;
      companyName?: string;
      partnerName?: string;
      whatsapp?: string;
      phone?: string;
      status?: string;
      createdAt?: string;
    }>
  >([]);
  const [partnerNameById, setPartnerNameById] = useState<Record<string, string>>({});

  const featured = shortcuts.find((s) => s.highlight);
  const others = shortcuts.filter((s) => !s.highlight);

  const now = new Date();
  const dateLong = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeShort = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const roleLabel =
    userData?.role === 'admin' ? 'Plein accès' : isCommandoOnly ? 'Commando' : 'Équipe';

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { role?: string; firstName?: string; lastName?: string; email?: string; uid?: string };
        if (String(data.role || '').toLowerCase() !== 'partner') return;
        const uid = String(data.uid || docSnap.id);
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        map[uid] = fullName || data.email || `Partenaire ${uid}`;
      });
      setPartnerNameById(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setReferralAlerts([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs
        .map((d) => {
          const data = d.data() as {
            message?: string;
            createdAt?: string;
            metadata?: {
              source?: string;
              referralCode?: string;
              referredByPartnerId?: string | null;
              referredByPartnerName?: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              phone?: string;
              companyName?: string;
              industry?: string;
              leadCreated?: boolean;
            };
          };
          return {
            id: d.id,
            message: data.message || '',
            createdAt: data.createdAt || '',
            source: data.metadata?.source || '',
            referralCode: data.metadata?.referralCode || '',
            referredByPartnerId: data.metadata?.referredByPartnerId || null,
            referredByPartnerName:
              data.metadata?.referredByPartnerName ||
              (data.metadata?.referredByPartnerId ? partnerNameById[data.metadata.referredByPartnerId] || '' : ''),
            firstName: data.metadata?.firstName || '',
            lastName: data.metadata?.lastName || '',
            email: data.metadata?.email || '',
            phone: data.metadata?.phone || '',
            companyName: data.metadata?.companyName || '',
            industry: data.metadata?.industry || '',
            leadCreated: Boolean(data.metadata?.leadCreated),
          };
        })
        .filter((n) => n.source === 'referral_signup')
        .slice(0, 5)
        .map(
          ({
            id,
            message,
            createdAt,
            referralCode,
            referredByPartnerId,
            referredByPartnerName,
            firstName,
            lastName,
            email,
            phone,
            companyName,
            industry,
            leadCreated,
          }) => ({
            id,
            message,
            createdAt,
            referralCode,
            referredByPartnerId,
            referredByPartnerName,
            firstName,
            lastName,
            email,
            phone,
            companyName,
            industry,
            leadCreated,
          })
        );
      setReferralAlerts(alerts);
    });
    return () => unsub();
  }, [user?.uid, partnerNameById]);

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(8));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setPartnerLeads(
          snapshot.docs.map((d) => {
            const data = d.data() as {
              firstName?: string;
              lastName?: string;
              companyName?: string;
              partnerName?: string;
              partnerId?: string;
              whatsapp?: string;
              phone?: string;
              status?: string;
              createdAt?: string;
            };
            return {
              id: d.id,
              firstName: data.firstName,
              lastName: data.lastName,
              companyName: data.companyName,
              partnerName: data.partnerName,
              partnerId: data.partnerId,
              whatsapp: data.whatsapp,
              phone: data.phone,
              status: data.status,
              createdAt: data.createdAt,
            };
          })
        );
      },
      (error) => {
        console.error('[AdminDashboard] leads snapshot:', error);
      }
    );
    return () => unsub();
  }, []);

  const handleCreateLeadFromReferral = async (alert: (typeof referralAlerts)[number]) => {
    const uid = user?.uid;
    if (!uid) {
      toast.error('Session expirée.');
      return;
    }
    if (!alert.referredByPartnerId) {
      toast.error('Partenaire introuvable pour ce parrainage.');
      return;
    }
    setCreatingLeadNotifId(alert.id);
    try {
      const partnerLabel =
        alert.referredByPartnerName ||
        (alert.referredByPartnerId ? partnerNameById[alert.referredByPartnerId] || '' : '') ||
        'Partenaire parrain';

      const leadId = await leadService.createLead({
        partnerId: alert.referredByPartnerId,
        partnerName: partnerLabel,
        firstName: alert.firstName,
        lastName: alert.lastName,
        email: alert.email,
        companyName: alert.companyName || 'Entreprise non renseignée',
        sector: alert.industry || 'Non spécifié',
        whatsapp: alert.phone || 'Non renseigné',
        phone: alert.phone || 'Non renseigné',
        note: `Lead créé depuis formulaire parrainage (${alert.referralCode || 'sans code'}).`,
        status: 'soumis',
      });

      const taskId = `TSK-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      await setDoc(doc(db, 'tasks', taskId), {
        id: taskId,
        leadId,
        userId: uid,
        title: `Lead partenaire: ${alert.companyName || 'Entreprise non renseignée'}`,
        client: `${alert.firstName} ${alert.lastName}`.trim() || alert.companyName || 'Nouveau contact',
        columnId: 'nouveau',
        isOrder: false,
        source: 'partner_lead',
        partnerId: alert.referredByPartnerId,
        partnerName: partnerLabel,
        leadCompany: alert.companyName || 'Entreprise non renseignée',
        leadPhone: alert.phone || 'Non renseigné',
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'notifications', alert.id), {
        metadata: {
          source: 'referral_signup',
          referralCode: alert.referralCode || null,
          referredByPartnerId: alert.referredByPartnerId || null,
          referredByPartnerName: partnerLabel,
          firstName: alert.firstName || '',
          lastName: alert.lastName || '',
          email: alert.email || '',
          phone: alert.phone || '',
          companyName: alert.companyName || '',
          industry: alert.industry || '',
          leadCreated: true,
        },
      });

      toast.success('Lead créé dans le pipeline Commando.');
    } catch (error) {
      console.error('[AdminDashboard] create lead from referral:', error);
      toast.error('Impossible de créer le lead.');
    } finally {
      setCreatingLeadNotifId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10 pb-20">
      {/* Bandeau contextualisé */}
      <div className="mb-8 flex flex-col gap-3 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="commando-luxe-ornament-diamond shrink-0" aria-hidden />
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-luxe-champagne-bright/85">
              Infinite Core
            </p>
            <p className="mt-1 text-xs capitalize text-text-muted">{dateLong}</p>
          </div>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          {timeShort} <span className="mx-2 text-luxe-champagne/40">·</span> Paris
        </p>
      </div>

      {/* Hero */}
      <header className="commando-luxe-hero-shell relative overflow-hidden rounded-2xl border border-luxe-champagne/18 bg-noya-sidebar/50 px-6 py-9 backdrop-blur-md md:px-11 md:py-11">
        <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <HeroCorners />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] uppercase tracking-[0.42em] text-luxe-champagne-bright/90 md:text-xs">
              Atelier opérationnel
            </p>
            <h1 className="mt-4 font-display text-[2rem] font-normal leading-[1.08] tracking-tight text-text-primary sm:text-4xl lg:text-[2.65rem]">
              <span className="bg-linear-to-r from-luxe-champagne-bright via-text-primary to-noya-blue bg-clip-text text-transparent">
                Infinite Commando
              </span>
            </h1>
            {firstName ? (
              <p className="mt-4 max-w-xl font-display text-lg italic text-text-secondary/95 md:text-xl">
                Bonjour, <span className="text-luxe-champagne-bright not-italic">{firstName}</span>.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-luxe-champagne/28 bg-luxe-champagne/8 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-luxe-champagne-bright">
                <Sparkles className="h-3 w-3 opacity-80" aria-hidden />
                {isCommandoOnly ? 'Vue Commando' : 'Vue équipe'}
              </span>
              <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
                Excellence & discrétion
              </span>
            </div>
            <p className="mt-7 max-w-2xl text-sm leading-[1.75] text-text-secondary md:text-[15px]">
              {isCommandoOnly ? (
                <>
                  Vous êtes connecté avec un compte <strong className="font-medium text-text-primary">Commando</strong>{' '}
                  : tout se passe sous <strong className="text-luxe-champagne">/admin</strong>. Le dépôt des livrables du
                  dossier client (audit → facture) se fait dans{' '}
                  <strong className="text-luxe-champagne">Dossiers clients</strong> — cette page orchestre vos accès.
                </>
              ) : (
                <>
                  Accueil opérationnel. Les livrables dossier se déposent dans{' '}
                  <strong className="text-luxe-champagne">Dossiers clients</strong> ; les admins disposent aussi des
                  espaces SuperAdmin, Dev et Partenaire via « Tous les espaces ».
                </>
              )}
            </p>
          </div>

          {/* Monogramme */}
          <div className="flex shrink-0 justify-start lg:justify-end">
            <div
              className="flex h-22 w-22 items-center justify-center rounded-2xl border border-luxe-champagne/35 bg-linear-to-br from-luxe-champagne/20 via-noya-sidebar/90 to-noya-blue/15 font-display text-2xl font-medium uppercase tracking-widest text-luxe-champagne-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-20px_rgba(201,169,98,0.25)]"
              role="img"
              aria-label={firstName ? `Monogramme ${firstName[0]}` : 'Monogramme Infinite Core'}
            >
              {firstName?.[0] || 'I'}
            </div>
          </div>
        </div>
      </header>

      {/* Statistiques décoratives (données réelles légères) */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Profil</p>
          <p className="mt-2 font-display text-2xl text-luxe-champagne-bright">{roleLabel}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Niveau d&apos;accès actuel</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Modules</p>
          <p className="mt-2 font-display text-2xl text-text-primary">{shortcuts.length}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Raccourcis disponibles</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Hub</p>
          <p className="mt-2 font-mono text-lg tracking-tight text-noya-blue">/admin</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Espace sécurisé TLS</p>
        </div>
      </div>

      {/* Entrées formulaires parrainage */}
      <section className="mt-12 md:mt-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="commando-luxe-ornament-diamond shrink-0" aria-hidden />
            <div>
              <h2 className="font-display text-xl tracking-tight text-text-primary md:text-2xl">Parrainages entrants</h2>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Formulaires du lien partenaire
              </p>
            </div>
          </div>
          <Link
            to="/admin/clients"
            className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/28 bg-luxe-champagne/8 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-luxe-champagne-bright transition-all hover:border-luxe-champagne/45 hover:bg-luxe-champagne/12"
          >
            Voir les clients
            <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>

        <div className="commando-luxe-hero-shell relative overflow-hidden rounded-2xl border border-luxe-champagne/15 bg-noya-sidebar/40 p-5 backdrop-blur-md md:p-7">
          <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-35" aria-hidden />
          <div className="relative">
            {referralAlerts.length === 0 ? (
              <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-6 text-sm text-text-muted">
                Aucun formulaire de parrainage reçu pour l’instant.
              </div>
            ) : (
              <ul className="space-y-2">
                {referralAlerts.map((item) => (
                  <li key={item.id} className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-luxe-champagne-bright" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary">{item.message}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-text-dim">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString('fr-FR')
                            : 'Date non disponible'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCreateLeadFromReferral(item)}
                            disabled={item.leadCreated || creatingLeadNotifId === item.id || !item.referredByPartnerId}
                            className="inline-flex items-center gap-2 rounded-lg border border-luxe-champagne/25 bg-luxe-champagne/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-luxe-champagne-bright transition-colors hover:bg-luxe-champagne/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {item.leadCreated
                              ? 'Lead déjà créé'
                              : creatingLeadNotifId === item.id
                                ? 'Création...'
                                : 'Créer lead'}
                          </button>
                          {item.leadCreated ? (
                            <Link
                              to="/admin/pipeline"
                              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary transition-colors hover:bg-white/5"
                            >
                              Ouvrir le pipeline
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Leads partenaires (source formulaire partenaire) */}
      <section className="mt-12 md:mt-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="commando-luxe-ornament-diamond shrink-0" aria-hidden />
            <div>
              <h2 className="font-display text-xl tracking-tight text-text-primary md:text-2xl">Leads partenaires</h2>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Formulaires reçus depuis l&apos;espace partenaire
              </p>
            </div>
          </div>
          <Link
            to="/admin/pipeline"
            className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/28 bg-luxe-champagne/8 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-luxe-champagne-bright transition-all hover:border-luxe-champagne/45 hover:bg-luxe-champagne/12"
          >
            Ouvrir le pipeline
            <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>

        <div className="commando-luxe-hero-shell relative overflow-hidden rounded-2xl border border-luxe-champagne/15 bg-noya-sidebar/40 p-5 backdrop-blur-md md:p-7">
          <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-35" aria-hidden />
          <div className="relative overflow-x-auto custom-scrollbar">
            {partnerLeads.length === 0 ? (
              <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-6 text-sm text-text-muted">
                Aucun lead partenaire pour l&apos;instant.
              </div>
            ) : (
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Entreprise</th>
                    <th className="px-3 py-3">Partenaire</th>
                    <th className="px-3 py-3">Téléphone</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/5 text-sm text-text-secondary">
                      <td className="px-3 py-3 text-text-primary">
                        {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Contact'}
                      </td>
                      <td className="px-3 py-3">{lead.companyName || '—'}</td>
                    <td className="px-3 py-3">
                      {lead.partnerName || (lead.partnerId ? partnerNameById[lead.partnerId] || `Partenaire ${lead.partnerId}` : '—')}
                    </td>
                      <td className="px-3 py-3">{lead.phone || lead.whatsapp || '—'}</td>
                      <td className="px-3 py-3 uppercase text-[11px]">{lead.status || 'soumis'}</td>
                      <td className="px-3 py-3 text-[12px]">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Aperçu CRM — carnet clients */}
      <section className="mt-12 md:mt-14" aria-labelledby="crm-dashboard-heading">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="commando-luxe-ornament-diamond shrink-0" aria-hidden />
            <div className="h-px flex-1 min-w-12 max-w-xs bg-linear-to-r from-luxe-champagne/35 to-transparent max-md:hidden" aria-hidden />
            <div>
              <h2 id="crm-dashboard-heading" className="font-display text-xl tracking-tight text-text-primary md:text-2xl">
                Carnet clients
              </h2>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Aperçu du portefeuille portail
              </p>
            </div>
          </div>
          <Link
            to="/admin/clients"
            className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/28 bg-luxe-champagne/8 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-luxe-champagne-bright transition-all hover:border-luxe-champagne/45 hover:bg-luxe-champagne/12"
          >
            CRM complet
            <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>

        <div className="commando-luxe-hero-shell relative overflow-hidden rounded-2xl border border-luxe-champagne/15 bg-noya-sidebar/40 p-5 backdrop-blur-md md:p-7">
          <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="flex flex-1 flex-col justify-center rounded-xl border border-white/8 bg-black/20 px-6 py-6">
              <div className="flex items-center gap-3 text-luxe-champagne-bright">
                <Users className="h-5 w-5 opacity-90" aria-hidden />
                <span className="font-display text-4xl font-normal tabular-nums text-text-primary md:text-5xl">
                  {crmLoading ? '—' : crmClients.length}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">Comptes avec rôle client connectés à l’espace portail.</p>
            </div>
            <ul className="flex min-w-0 flex-[1.4] flex-col gap-2">
              {crmLoading ? (
                <li className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-6 text-center text-sm text-text-muted">
                  Chargement des fiches…
                </li>
              ) : recentCrm.length === 0 ? (
                <li className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-6 text-center text-sm text-text-muted">
                  Aucun client enregistré pour le moment.
                </li>
              ) : (
                recentCrm.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition-all hover:border-luxe-champagne/25 hover:bg-white/4">
                      <div className="min-w-0 flex-1 px-1">
                        <p className="truncate font-medium text-text-primary">{clientDisplayName(c)}</p>
                        {c.email ? (
                          <p className="truncate text-xs text-text-muted">{c.email}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          to="/admin/dossiers"
                          state={{ selectClientId: c.id }}
                          title="Ouvrir le dossier"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-luxe-champagne/25 bg-luxe-champagne/10 text-luxe-champagne-bright transition-colors hover:border-luxe-champagne/45"
                        >
                          <FolderOpen className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Dossier {clientDisplayName(c)}</span>
                        </Link>
                        <Link
                          to={`/admin/messagerie?client=${encodeURIComponent(c.id)}`}
                          state={{ selectClientId: c.id }}
                          title="Ouvrir la messagerie"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-text-muted transition-colors hover:border-noya-blue/35 hover:text-noya-blue"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Messagerie {clientDisplayName(c)}</span>
                        </Link>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Grille modules — bento */}
      <div className="mt-12 md:mt-14">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <div className="commando-luxe-ornament-diamond shrink-0" aria-hidden />
          <div className="h-px flex-1 min-w-12 max-w-xs bg-linear-to-r from-luxe-champagne/35 to-transparent" aria-hidden />
          <div>
            <h2 className="font-display text-xl tracking-tight text-text-primary md:text-2xl">Vos accès</h2>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
              Sélectionnez un module
            </p>
          </div>
          <div className="h-px flex-1 min-w-12 max-w-xs bg-linear-to-l from-luxe-champagne/35 to-transparent max-sm:hidden" aria-hidden />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {featured ? (
            <ShortcutCard item={featured} className="commando-luxe-module-card lg:col-span-2" large />
          ) : null}
          {others.map((item) => (
            <Fragment key={item.to}>
              <ShortcutCard item={item} className="commando-luxe-module-card" />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutCard({
  item,
  className,
  large,
}: {
  item: (typeof shortcuts)[number];
  className?: string;
  large?: boolean;
}) {
  const { to, title, description, icon: Icon, highlight } = item;
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-500 md:p-7',
        highlight
          ? 'border-luxe-champagne/42 bg-linear-to-br from-luxe-champagne/14 via-noya-sidebar/85 to-noya-sidebar/55 shadow-[0_24px_72px_-32px_rgba(201,169,98,0.42),inset_0_1px_0_rgba(228,212,165,0.18)] hover:border-luxe-champagne/58 hover:shadow-[0_32px_80px_-28px_rgba(201,169,98,0.38)]'
          : 'border-white/8 bg-noya-sidebar/40 backdrop-blur-sm shadow-[0_20px_56px_-36px_rgba(0,0,0,0.88)] hover:border-luxe-champagne/28 hover:bg-noya-sidebar/55 hover:shadow-[0_28px_64px_-30px_rgba(110,167,234,0.14)]',
        large && 'min-h-56 md:min-h-60',
        className
      )}
    >
      {highlight ? (
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-luxe-champagne/18 blur-3xl"
          aria-hidden
        />
      ) : null}
      <div className={cn('relative flex items-start justify-between gap-4', large && 'md:flex-row')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl border transition-all duration-500',
            large ? 'h-14 w-14 md:h-16 md:w-16' : 'h-12 w-12',
            highlight
              ? 'border-luxe-champagne/38 bg-luxe-champagne/14 text-luxe-champagne-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
              : 'border-white/8 bg-black/25 text-text-muted group-hover:border-luxe-champagne/32 group-hover:text-luxe-champagne-bright'
          )}
        >
          <Icon size={large ? 26 : 22} strokeWidth={1.5} aria-hidden className="transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        {highlight ? (
          <span className="rounded-full border border-luxe-champagne/32 bg-luxe-champagne/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-luxe-champagne-bright">
            Dépôt livrables
          </span>
        ) : null}
      </div>
      <h3 className={cn('mt-5 font-display font-medium tracking-tight text-text-primary', large ? 'text-xl md:text-2xl' : 'text-lg')}>
        {title}
      </h3>
      <p className={cn('mt-2 flex-1 leading-relaxed text-text-secondary', large ? 'text-sm md:text-[15px] md:max-w-2xl' : 'text-sm')}>
        {description}
      </p>
      <span
        className={cn(
          'mt-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]',
          highlight ? 'text-luxe-champagne-bright' : 'text-text-muted group-hover:text-luxe-champagne-bright'
        )}
      >
        Entrer dans le module
        <span className="transition-transform duration-500 group-hover:translate-x-1" aria-hidden>
          →
        </span>
      </span>
    </Link>
  );
}
