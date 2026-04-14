import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';

type LeadRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  companyName?: string;
  sector?: string;
  city?: string;
  status?: string;
  partnerId?: string;
  partnerName?: string;
  source?: string;
  createdAt?: string;
};

type UserRow = {
  id: string;
  uid?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const leadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubLeads = onSnapshot(leadsQuery, (snapshot) => {
      setLeads(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as LeadRow) })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserRow) })));
    });
    return () => {
      unsubLeads();
      unsubUsers();
    };
  }, []);

  const partnerNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users) {
      if (String(user.role || '').toLowerCase() !== 'partner') continue;
      const uid = String(user.uid || user.id);
      const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      map[uid] = full || user.email || `Partenaire ${uid}`;
    }
    return map;
  }, [users]);

  const statuses = useMemo(
    () => Array.from(new Set(leads.map((lead) => String(lead.status || 'soumis').toLowerCase()))).sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const status = String(lead.status || 'soumis').toLowerCase();
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      const partnerLabel =
        lead.partnerName || (lead.partnerId ? partnerNameById[lead.partnerId] || '' : '');
      const blob = `${lead.companyName || ''} ${lead.firstName || ''} ${lead.lastName || ''} ${lead.email || ''} ${partnerLabel}`.toLowerCase();
      const matchSearch = !q || blob.includes(q);
      return matchStatus && matchSearch;
    });
  }, [leads, search, statusFilter, partnerNameById]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.28em] text-luxe-champagne-bright/85">Infinite Commando</p>
          <h1 className="mt-1 font-display text-3xl font-normal tracking-tight text-text-primary md:text-4xl">Leads partenaires</h1>
          <p className="mt-2 text-sm text-text-secondary">Vue consolidée des leads envoyés par les partenaires.</p>
        </div>
        <Link
          to="/admin/pipeline"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted transition-colors hover:border-luxe-champagne/30 hover:text-luxe-champagne-bright sm:self-auto"
        >
          Ouvrir pipeline
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Leads total</p>
          <p className="mt-2 font-display text-3xl text-luxe-champagne-bright">{leads.length}</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Leads affichés</p>
          <p className="mt-2 font-display text-3xl text-noya-blue">{filtered.length}</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Partenaires actifs</p>
          <p className="mt-2 font-display text-3xl text-noya-green">
            {new Set(leads.map((lead) => String(lead.partnerId || '')).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-noya-sidebar/35 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher entreprise, contact, email, partenaire..."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-dim focus:border-luxe-champagne/35 focus:ring-1 focus:ring-luxe-champagne/20"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-luxe-champagne/20"
            title="Filtrer par statut"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-noya-sidebar/35">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-text-dim">
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Entreprise</th>
                <th className="px-3 py-3 font-semibold">Partenaire</th>
                <th className="px-3 py-3 font-semibold">Téléphone</th>
                <th className="px-3 py-3 font-semibold">Secteur / Ville</th>
                <th className="px-3 py-3 font-semibold">Statut</th>
                <th className="px-3 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-text-muted">
                    Aucun lead partenaire trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const partnerLabel =
                    lead.partnerName ||
                    (lead.partnerId ? partnerNameById[lead.partnerId] || `Partenaire ${lead.partnerId}` : '—');
                  return (
                    <tr key={lead.id} className="hover:bg-white/5">
                      <td className="px-3 py-3 text-text-primary">
                        {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email || 'Contact'}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{lead.companyName || '—'}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-noya-blue">
                          Parrainé · {partnerLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{lead.phone || lead.whatsapp || '—'}</td>
                      <td className="px-3 py-3 text-text-secondary">
                        {[lead.sector, lead.city].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-3 uppercase text-[11px] text-text-primary">{lead.status || 'soumis'}</td>
                      <td className="px-3 py-3 text-text-secondary">{formatDate(lead.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

