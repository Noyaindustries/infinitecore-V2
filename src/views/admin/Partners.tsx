import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, Handshake, Link2, Users } from 'lucide-react';
import { collection, onSnapshot } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';

type UserRow = {
  id: string;
  uid?: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string;
  partnerCode?: string;
  referredByPartnerId?: string;
  createdAt?: string;
};

type LeadRow = {
  id: string;
  partnerId?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  whatsapp?: string;
  status?: string;
  createdAt?: string;
};

type PartnerSummary = {
  id: string;
  uid: string;
  name: string;
  email: string;
  referralCode: string;
  leadsCount: number;
  signupsCount: number;
  lastLeadAt?: string;
};

function normalizePartnerCode(code: string) {
  return code.toUpperCase().replace('PART-USR', 'PART-INF');
}

function buildPartnerCode(uid?: string) {
  return `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function AdminPartners() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPartnerUid, setSelectedPartnerUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
    });
    const unsubLeads = onSnapshot(collection(db, 'leads'), (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeadRow, "id">) })));
    });
    return () => {
      unsubUsers();
      unsubLeads();
    };
  }, []);

  const partnerRows = useMemo<PartnerSummary[]>(() => {
    const partners = users.filter((u) => String(u.role || '').toLowerCase() === 'partner');
    const clients = users.filter((u) => String(u.role || '').toLowerCase() === 'client');
    return partners.map((partner) => {
      const uid = String(partner.uid || partner.id);
      const leadsForPartner = leads.filter((l) => String(l.partnerId || '') === uid);
      const signupsForPartner = clients.filter((c) => String(c.referredByPartnerId || '') === uid);
      const lastLeadAt = leadsForPartner
        .map((l) => l.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime())[0];

      return {
        id: partner.id,
        uid,
        name: `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email || 'Partenaire',
        email: partner.email || '—',
        referralCode: normalizePartnerCode(String(partner.referralCode || partner.partnerCode || buildPartnerCode(uid))),
        leadsCount: leadsForPartner.length,
        signupsCount: signupsForPartner.length,
        lastLeadAt,
      };
    });
  }, [users, leads]);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partnerRows;
    return partnerRows.filter((p) => `${p.name} ${p.email} ${p.referralCode}`.toLowerCase().includes(q));
  }, [partnerRows, search]);

  const totalLeads = useMemo(() => partnerRows.reduce((acc, p) => acc + p.leadsCount, 0), [partnerRows]);
  const totalSignups = useMemo(() => partnerRows.reduce((acc, p) => acc + p.signupsCount, 0), [partnerRows]);
  const selectedPartner = useMemo(
    () => partnerRows.find((partner) => partner.uid === selectedPartnerUid) || null,
    [partnerRows, selectedPartnerUid]
  );
  const selectedPartnerLeads = useMemo(() => {
    if (!selectedPartnerUid) return [];
    return leads
      .filter((lead) => String(lead.partnerId || '') === selectedPartnerUid)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [leads, selectedPartnerUid]);

  const exportPartnerLeads = (partnerUid: string) => {
    const partner = partnerRows.find((p) => p.uid === partnerUid);
    const partnerLeads = leads
      .filter((lead) => String(lead.partnerId || '') === partnerUid)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (partnerLeads.length === 0) return;
    const rows = partnerLeads.map((lead) =>
      `"${lead.companyName || ''}","${lead.firstName || ''} ${lead.lastName || ''}".trim(),"${lead.email || ''}","${lead.whatsapp || ''}","${lead.status || ''}","${formatDate(lead.createdAt)}"`
    );
    const csv = `Partenaire,Entreprise,Contact,Email,WhatsApp,Statut,Date\n"${partner?.name || partnerUid}",${rows.join('\n')}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner_leads_${(partner?.name || partnerUid).replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-luxe-champagne-bright/85">Infinite Commando</p>
          <h1 className="mt-1 font-display text-3xl font-normal tracking-tight text-text-primary md:text-4xl">Partenaires</h1>
          <p className="mt-2 text-sm text-text-secondary">Suivi des partenaires, de leurs leads et des inscriptions parrainées.</p>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted transition-colors hover:border-luxe-champagne/30 hover:text-luxe-champagne-bright sm:self-auto"
        >
          Retour dashboard
        </Link>
        <Link
          to="/admin/leads"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-noya-blue/30 bg-noya-blue/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-noya-blue transition-colors hover:bg-noya-blue/20 sm:self-auto"
        >
          Voir leads commando
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Partenaires</p>
          <p className="mt-2 font-display text-3xl text-luxe-champagne-bright">{partnerRows.length}</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Leads partenaires</p>
          <p className="mt-2 font-display text-3xl text-noya-blue">{totalLeads}</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Inscriptions parrainées</p>
          <p className="mt-2 font-display text-3xl text-noya-green">{totalSignups}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/8 bg-noya-sidebar/35 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="partner-search" className="sr-only">Rechercher un partenaire</label>
          <input
            id="partner-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, e-mail, code..."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-dim focus:border-luxe-champagne/35 focus:ring-1 focus:ring-luxe-champagne/20"
          />
          {selectedPartner ? (
            <button
              type="button"
              onClick={() => exportPartnerLeads(selectedPartner.uid)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary transition-colors hover:bg-white/5"
            >
              <Download size={14} />
              Export leads
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-noya-sidebar/35">
        <div className="hidden grid-cols-[1.2fr_1.2fr_1fr_0.8fr_0.8fr_0.9fr_1fr] gap-4 border-b border-white/6 bg-black/15 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-text-dim lg:grid">
          <span>Partenaire</span>
          <span>Code</span>
          <span>UID</span>
          <span>Leads</span>
          <span>Signups</span>
          <span>Dernier lead</span>
          <span>Actions</span>
        </div>
        <ul className="divide-y divide-white/6">
          {filteredPartners.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-text-muted">Aucun partenaire trouvé.</li>
          ) : (
            filteredPartners.map((partner) => (
              <li key={partner.id} className="px-5 py-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1fr_0.8fr_0.8fr_0.9fr_1fr] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{partner.name}</p>
                    <p className="truncate text-xs text-text-secondary">{partner.email}</p>
                  </div>
                  <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-noya-blue/25 bg-noya-blue/10 px-2.5 py-1 text-xs font-semibold text-noya-blue">
                    <Link2 size={13} />
                    {partner.referralCode}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{partner.uid}</p>
                  <p className="inline-flex w-fit items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-text-primary">
                    <Handshake size={13} />
                    {partner.leadsCount}
                  </p>
                  <p className="inline-flex w-fit items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-text-primary">
                    <Users size={13} />
                    {partner.signupsCount}
                  </p>
                  <p className="text-xs text-text-secondary">{formatDate(partner.lastLeadAt)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerUid((current) => (current === partner.uid ? null : partner.uid))}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/5"
                    >
                      <Eye size={12} />
                      {selectedPartnerUid === partner.uid ? 'Masquer' : 'Voir leads'}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPartnerLeads(partner.uid)}
                      disabled={partner.leadsCount === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={12} />
                      Export CSV
                    </button>
                    <Link
                      to={`/admin/clients?partnerId=${encodeURIComponent(partner.uid)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-noya-blue/30 bg-noya-blue/10 px-2.5 py-1 text-[11px] font-semibold text-noya-blue transition-colors hover:bg-noya-blue/20"
                    >
                      <Users size={12} />
                      Ouvrir CRM
                    </Link>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {selectedPartner ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-noya-sidebar/35">
          <div className="border-b border-white/6 bg-black/15 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">
              Leads de {selectedPartner.name} ({selectedPartnerLeads.length})
            </p>
          </div>
          {selectedPartnerLeads.length === 0 ? (
            <div className="px-5 py-8 text-sm text-text-muted">Aucun lead pour ce partenaire.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/6 text-[10px] uppercase tracking-[0.12em] text-text-dim">
                    <th className="px-5 py-3 font-semibold">Entreprise</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">WhatsApp</th>
                    <th className="px-5 py-3 font-semibold">Statut</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {selectedPartnerLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-white/5">
                      <td className="px-5 py-3 text-text-primary">{lead.companyName || '—'}</td>
                      <td className="px-5 py-3 text-text-secondary">{`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}</td>
                      <td className="px-5 py-3 text-text-secondary">{lead.email || '—'}</td>
                      <td className="px-5 py-3 text-text-secondary">{lead.whatsapp || '—'}</td>
                      <td className="px-5 py-3 text-text-primary">{lead.status || 'soumis'}</td>
                      <td className="px-5 py-3 text-text-secondary">{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

