import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  Copy,
  Handshake,
  Percent,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../components/FirebaseProvider';
import { Lead, LeadStatus, leadService } from '../../services/leadService';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const STATUS_LABELS: Record<LeadStatus, string> = {
  soumis: 'Soumis',
  contacte: 'Contacté',
  en_demo: 'En démo',
  proposition: 'Proposition',
  signe: 'Signé',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

const PIPELINE_ORDER: LeadStatus[] = ['soumis', 'contacte', 'en_demo', 'proposition', 'signe', 'gagne', 'perdu'];
type DashboardRange = '7d' | '30d' | '90d' | 'all';
type ReferredSignup = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  createdAt?: string;
};

const normalizePartnerCode = (code: string) => code.toUpperCase().replace('PART-USR', 'PART-INF');
const buildPartnerCode = (uid?: string) => `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: 'Trimestre' },
  { value: 'all', label: 'Tout' },
];

function formatFCFA(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
}

function isInSelectedRange(dateIso: string, range: DashboardRange): boolean {
  if (range === 'all') return true;

  const now = new Date();
  const targetDate = new Date(dateIso);
  if (Number.isNaN(targetDate.getTime())) return false;

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const minDate = new Date(now);
  minDate.setDate(now.getDate() - days);
  return targetDate >= minDate;
}

export default function PartnerDashboard() {
  const { user, userData } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [referredSignups, setReferredSignups] = useState<ReferredSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DashboardRange>('30d');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const partnerUid = String(userData?.uid || user?.uid || '');

  useEffect(() => {
    if (!partnerUid) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const unsubscribe = leadService.subscribeToPartnerLeads(partnerUid, (data) => {
      setLeads(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [partnerUid]);

  const partnerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Partenaire';
  const referralCode = normalizePartnerCode(String(userData?.referralCode || buildPartnerCode(partnerUid)));
  const partnerCodeLegacy = normalizePartnerCode(String(userData?.partnerCode || ''));
  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://infinitecore.app'}/signup?ref=${encodeURIComponent(referralCode)}`
    : '';

  useEffect(() => {
    if (!partnerUid) {
      setReferredSignups([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const referralKeys = new Set<string>([
        referralCode,
        normalizePartnerCode(String(userData?.referralCode || '')),
        normalizePartnerCode(buildPartnerCode(partnerUid)),
        partnerCodeLegacy,
        String(partnerUid || '').toUpperCase(),
      ].filter(Boolean));

      const signups = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ReferredSignup, "id"> & { role?: string; referredBy?: string; referredByPartnerId?: string }),
        }))
        .filter((row) => {
          const role = String((row as { role?: string }).role || '').toLowerCase();
          if (role !== 'client') return false;
          const byPartnerId = (row as { referredByPartnerId?: string }).referredByPartnerId === partnerUid;
          const byReferralCode = referralKeys.has(normalizePartnerCode(String((row as { referredBy?: string }).referredBy || '')));
          const byLegacyUid = String((row as { referredBy?: string }).referredBy || '') === String(partnerUid || '');
          return byPartnerId || byReferralCode || byLegacyUid;
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setReferredSignups(signups);
    });

    return () => unsubscribe();
  }, [partnerUid, referralCode, partnerCodeLegacy, userData]);

  const sortedLeads = useMemo(
    () =>
      [...leads].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
      ),
    [leads],
  );

  const leadsInRange = useMemo(() => leads.filter((lead) => isInSelectedRange(lead.createdAt, range)), [leads, range]);

  const signedLeads = useMemo(
    () => leadsInRange.filter((lead) => lead.status === 'signe' || lead.status === 'gagne'),
    [leadsInRange],
  );
  const wonLeads = useMemo(() => leadsInRange.filter((lead) => lead.status === 'gagne'), [leadsInRange]);
  const activeLeads = useMemo(
    () => leadsInRange.filter((lead) => lead.status !== 'gagne' && lead.status !== 'perdu' && lead.status !== 'signe'),
    [leadsInRange],
  );

  const totalCommission = signedLeads.reduce((sum, lead) => sum + (lead.commissionAmount || 0), 0);
  const paidCommission = signedLeads
    .filter((lead) => lead.commissionPaid)
    .reduce((sum, lead) => sum + (lead.commissionAmount || 0), 0);
  const pendingCommission = Math.max(totalCommission - paidCommission, 0);
  const conversionRate = leadsInRange.length > 0 ? Math.round((wonLeads.length / leadsInRange.length) * 100) : 0;

  const pipeline = useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      soumis: 0,
      contacte: 0,
      en_demo: 0,
      proposition: 0,
      signe: 0,
      gagne: 0,
      perdu: 0,
    };

    for (const lead of leadsInRange) counts[lead.status] += 1;
    return PIPELINE_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: counts[status],
    }));
  }, [leadsInRange]);

  const maxPipelineCount = useMemo(() => Math.max(...pipeline.map((item) => item.count), 1), [pipeline]);
  const selectedRangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'Tout';
  const handleCopyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedReferral(true);
      window.setTimeout(() => setCopiedReferral(false), 2000);
    } catch {
      // Navigateur sans accès presse-papiers
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border border-white/10 bg-linear-to-r from-noya-sidebar to-surface-secondary p-6">
        <p className="text-sm text-text-secondary">Bienvenue</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">{partnerName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Voici votre cockpit partenaire : suivi des contacts, conversion commerciale, commissions et prochaines actions.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                range === option.value
                  ? 'border-noya-blue bg-noya-blue/20 text-noya-blue'
                  : 'border-white/10 text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/partenaire/clients"
            className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2.5 text-sm font-bold text-noya-black shadow-[0_4px_15px_rgba(110,167,234,0.3)] transition-transform hover:scale-[1.02]"
          >
            Soumettre un contact <ArrowRight size={16} />
          </Link>
          <Link
            to="/partenaire/commissions"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white/5"
          >
            Voir mes commissions
          </Link>
          <Link
            to="/partenaire/filleuls"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white/5"
          >
            Voir mes clients parrainés
          </Link>
        </div>
        {referralLink ? (
          <div className="mt-5 rounded-xl border border-noya-green/30 bg-noya-green/10 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-noya-green">Lien de parrainage</p>
            <p className="mt-1 text-sm text-text-secondary">
              Partagez ce lien pour rattacher les nouvelles inscriptions à votre compte partenaire.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-text-primary break-all">
                {referralLink}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyReferralLink()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/5"
              >
                <Copy size={14} />
                {copiedReferral ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Navigation rapide</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a
            href="#partner-dashboard-kpis"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
          >
            KPIs
          </a>
          <a
            href="#partner-dashboard-pipeline"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
          >
            Pipeline
          </a>
          <a
            href="#partner-dashboard-activity"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
          >
            Activité récente
          </a>
          <Link
            to="/partenaire/filleuls"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
          >
            Clients parrainés
          </Link>
        </div>
      </section>

      <section id="partner-dashboard-kpis" className="scroll-mt-24 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-text-secondary">Contacts actifs</p>
            <Users size={18} className="text-noya-blue" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{activeLeads.length}</p>
          <p className="mt-1 text-xs text-text-secondary">sur {selectedRangeLabel.toLowerCase()}</p>
        </article>

        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-text-secondary">Deals gagnés</p>
            <CheckCircle2 size={18} className="text-noya-green" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{wonLeads.length}</p>
          <p className="mt-1 text-xs text-text-secondary">sur {leadsInRange.length} contacts soumis</p>
        </article>

        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-text-secondary">Conversion</p>
            <Percent size={18} className="text-noya-orange" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{conversionRate}%</p>
          <p className="mt-1 text-xs text-text-secondary">taux gagné / total soumis ({selectedRangeLabel.toLowerCase()})</p>
        </article>

        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-text-secondary">Commissions à venir</p>
            <Banknote size={18} className="text-noya-green" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{pendingCommission > 0 ? formatFCFA(pendingCommission) : '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">en attente de versement</p>
        </article>
      </section>

      <section className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Inscriptions via mon lien</h2>
            <p className="text-sm text-text-secondary">Utilisateurs rattachés à votre parrainage</p>
          </div>
          <span className="rounded-full border border-noya-blue/30 bg-noya-blue/10 px-3 py-1 text-xs font-bold text-noya-blue">
            {referredSignups.length}
          </span>
        </div>

        {referredSignups.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/5 p-4 text-sm text-text-secondary">
            Aucune inscription issue de votre lien pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {referredSignups.map((signup) => (
              <div key={signup.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">
                    {`${signup.firstName || ''} ${signup.lastName || ''}`.trim() || signup.email || 'Nouveau client'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {signup.companyName || signup.company || 'Entreprise non renseignée'} · {signup.phone || 'Téléphone non renseigné'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-secondary">
                  {signup.createdAt ? format(new Date(signup.createdAt), 'dd MMM', { locale: fr }) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="partner-dashboard-pipeline" className="scroll-mt-24 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Pipeline commercial</h2>
              <p className="text-sm text-text-secondary">Répartition de vos leads par étape ({selectedRangeLabel.toLowerCase()})</p>
            </div>
            <Handshake size={18} className="text-text-secondary" />
          </div>

          <div className="space-y-3">
            {pipeline.map((item) => (
              <div key={item.status}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">{item.label}</span>
                  <span className="font-bold text-text-primary">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-noya-black/50">
                  <progress
                    className={`h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full ${
                      item.status === 'gagne'
                        ? '[&::-webkit-progress-value]:bg-noya-green [&::-moz-progress-bar]:bg-noya-green'
                        : item.status === 'perdu'
                          ? '[&::-webkit-progress-value]:bg-text-secondary/40 [&::-moz-progress-bar]:bg-text-secondary/40'
                          : '[&::-webkit-progress-value]:bg-noya-blue [&::-moz-progress-bar]:bg-noya-blue'
                    }`}
                    value={item.count}
                    max={maxPipelineCount}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <h2 className="text-lg font-bold text-text-primary">Résumé commissions</h2>
          <p className="mt-1 text-sm text-text-secondary">Vision financière sur {selectedRangeLabel.toLowerCase()}</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <p className="text-xs text-text-secondary">Total généré</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{totalCommission > 0 ? formatFCFA(totalCommission) : '—'}</p>
            </div>
            <div className="rounded-lg border border-noya-green/20 bg-noya-green/10 p-3">
              <p className="text-xs text-noya-green">Déjà versé</p>
              <p className="mt-1 text-lg font-bold text-noya-green">{paidCommission > 0 ? formatFCFA(paidCommission) : '—'}</p>
            </div>
            <div className="rounded-lg border border-noya-orange/20 bg-noya-orange/10 p-3">
              <p className="text-xs text-noya-orange">À verser</p>
              <p className="mt-1 text-lg font-bold text-noya-orange">{pendingCommission > 0 ? formatFCFA(pendingCommission) : '—'}</p>
            </div>
          </div>
        </article>
      </section>

      <section id="partner-dashboard-activity" className="scroll-mt-24 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Activité récente</h2>
              <p className="text-sm text-text-secondary">Derniers mouvements sur vos contacts</p>
            </div>
            <Clock3 size={18} className="text-text-secondary" />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-noya-blue" />
            </div>
          ) : sortedLeads.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-white/5 p-6 text-sm text-text-secondary">
              Aucun lead pour le moment. Commencez par soumettre un premier contact.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedLeads.slice(0, 6).map((lead) => (
                <div key={lead.id} className="flex items-start justify-between gap-4 rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text-primary">{lead.companyName}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {lead.firstName || 'Contact'} {lead.lastName || ''} · {STATUS_LABELS[lead.status]}
                    </p>
                    {lead.commandoNote ? (
                      <p className="mt-1 truncate text-xs italic text-noya-blue">"{lead.commandoNote}"</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {format(new Date(lead.updatedAt || lead.createdAt), 'dd MMM', { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-white/5 bg-noya-sidebar p-5">
          <h2 className="text-lg font-bold text-text-primary">Actions rapides</h2>
          <p className="mt-1 text-sm text-text-secondary">Accédez directement aux sections clés</p>
          <div className="mt-4 space-y-2">
            <Link
              to="/partenaire/clients"
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
            >
              Mes contacts
              <ArrowRight size={15} className="text-text-secondary" />
            </Link>
            <Link
              to="/partenaire/commissions"
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
            >
              Commissions
              <ArrowRight size={15} className="text-text-secondary" />
            </Link>
            <Link
              to="/partenaire/ressources"
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
            >
              Ressources vente
              <BookOpen size={15} className="text-text-secondary" />
            </Link>
            <Link
              to="/partenaire/profil"
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
            >
              Mon profil / RIB
              <Bell size={15} className="text-text-secondary" />
            </Link>
          </div>
          {referralCode ? (
            <div className="mt-4 rounded-lg border border-noya-green/30 bg-noya-green/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-noya-green">Code partenaire</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-semibold text-text-primary">
                  {referralCode}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyReferralLink()}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/5"
                >
                  <Copy size={13} />
                  {copiedReferral ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
