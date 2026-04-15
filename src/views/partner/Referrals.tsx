import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Link2, UserPlus, Users } from 'lucide-react';
import { collection, onSnapshot } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { useAuth } from '../../components/AuthProvider';
import { Lead, leadService } from '../../services/leadService';

type ReferredSignup = {
  id: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  referredBy?: string;
  referredByPartnerId?: string;
  createdAt?: string;
};

const normalizePartnerCode = (code: string) => code.toUpperCase().replace('PART-USR', 'PART-INF');
const buildPartnerCode = (uid?: string) => `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export default function PartnerReferrals() {
  const { user, userData } = useAuth();
  const partnerUid = String(userData?.uid || user?.uid || '');
  const [copied, setCopied] = useState(false);
  const [referredSignups, setReferredSignups] = useState<ReferredSignup[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

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
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ReferredSignup, "id">) }))
        .filter((row) => {
          const role = String(row.role || '').toLowerCase();
          if (role !== 'client') return false;
          const byPartnerId = row.referredByPartnerId === partnerUid;
          const byReferralCode = referralKeys.has(normalizePartnerCode(String(row.referredBy || '')));
          const byLegacyUid = String(row.referredBy || '') === String(partnerUid || '');
          return byPartnerId || byReferralCode || byLegacyUid;
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReferredSignups(signups);
    });
    return () => unsubscribe();
  }, [partnerUid, referralCode, partnerCodeLegacy, userData]);

  useEffect(() => {
    if (!partnerUid) {
      setLeads([]);
      return;
    }
    const unsubscribe = leadService.subscribeToPartnerLeads(partnerUid, setLeads);
    return () => unsubscribe();
  }, [partnerUid]);

  const signupWithLead = useMemo(() => {
    const leadsByEmail = new Map<string, Lead>();
    for (const lead of leads) {
      const key = String(lead.email || '').trim().toLowerCase();
      if (!key || leadsByEmail.has(key)) continue;
      leadsByEmail.set(key, lead);
    }
    return referredSignups.map((signup) => {
      const key = String(signup.email || '').trim().toLowerCase();
      return { signup, lead: key ? leadsByEmail.get(key) : undefined };
    });
  }, [referredSignups, leads]);

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // navigateur sans accès presse-papiers
    }
  };

  const exportCsv = () => {
    if (signupWithLead.length === 0) return;
    const rows = signupWithLead.map(({ signup, lead }) =>
      `"${`${signup.firstName || ''} ${signup.lastName || ''}`.trim()}","${signup.email || ''}","${signup.phone || ''}","${signup.companyName || signup.company || ''}","${formatDate(signup.createdAt)}","${lead?.status || 'Non converti'}","${lead?.id || ''}"`
    );
    const csv = `Nom,Email,Telephone,Entreprise,Date inscription,Statut lead,Lead ID\n${rows.join('\n')}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partenaire_filleuls_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border border-white/10 bg-noya-sidebar p-5">
        <h1 className="text-2xl font-bold text-text-primary">Clients apportés par mon lien</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Suivi des inscriptions générées par votre lien partenaire et de leur conversion en leads.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Inscriptions via lien</p>
            <p className="mt-1 text-2xl font-black text-text-primary">{referredSignups.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Leads créés</p>
            <p className="mt-1 text-2xl font-black text-noya-blue">{signupWithLead.filter((row) => Boolean(row.lead)).length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Taux conversion</p>
            <p className="mt-1 text-2xl font-black text-noya-green">
              {referredSignups.length > 0 ? Math.round((signupWithLead.filter((row) => Boolean(row.lead)).length / referredSignups.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-noya-green/25 bg-noya-green/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-noya-green">Lien attribué</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-text-primary break-all">
            {referralLink || 'Lien indisponible'}
          </code>
          <button
            type="button"
            onClick={() => void copyReferralLink()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/5"
          >
            <Copy size={14} />
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={signupWithLead.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-text-primary">Filleuls inscrits</h2>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <UserPlus size={14} />
            {signupWithLead.length}
          </div>
        </div>

        {signupWithLead.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-text-secondary">
            Aucun client inscrit via votre lien pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-text-dim">
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Entreprise</th>
                  <th className="px-3 py-2">Inscription</th>
                  <th className="px-3 py-2">Lead associé</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {signupWithLead.map(({ signup, lead }) => (
                  <tr key={signup.id} className="hover:bg-white/5">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-text-primary">{`${signup.firstName || ''} ${signup.lastName || ''}`.trim() || signup.email || 'Client'}</p>
                      <p className="text-xs text-text-secondary">{signup.email || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{signup.companyName || signup.company || '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{formatDate(signup.createdAt)}</td>
                    <td className="px-3 py-3 text-text-secondary">{lead?.id || '—'}</td>
                    <td className="px-3 py-3">
                      {lead ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-noya-blue/30 bg-noya-blue/15 px-2.5 py-1 text-xs font-semibold text-noya-blue">
                          <Users size={12} />
                          {lead.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-text-secondary">
                          <Link2 size={12} />
                          Non converti
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/partenaire/clients" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/10">
          Voir mes leads partenaires
        </Link>
        <Link to="/partenaire" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/10">
          Retour tableau de bord
        </Link>
      </div>
    </div>
  );
}

