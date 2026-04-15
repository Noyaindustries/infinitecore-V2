import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, DollarSign, Clock, CheckCircle, TrendingUp, Building2 } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { leadService, Lead, LeadStatus } from '../../services/leadService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<LeadStatus, string> = {
  soumis: 'Soumis',
  contacte: 'Contacté',
  en_demo: 'En démo',
  proposition: 'Proposition',
  signe: 'Signé',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

export default function PartnerCommissions() {
  const { user, userData } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const partnerUid = String(userData?.uid || user?.uid || '');

  useEffect(() => {
    if (!partnerUid) return;
    const unsub = leadService.subscribeToPartnerLeads(partnerUid, (data) => {
      setLeads(data);
      setLoading(false);
    });
    return () => unsub();
  }, [partnerUid]);

  const signedLeads = leads.filter(l => l.status === 'signe' || l.status === 'gagne');
  const gainedLeads = leads.filter(l => l.status === 'gagne');
  const paidLeads = leads.filter(l => l.commissionPaid);
  const totalCommissions = signedLeads.reduce((sum, l) => sum + (l.commissionAmount || 0), 0);
  const paidCommissions = paidLeads.reduce((sum, l) => sum + (l.commissionAmount || 0), 0);
  const pendingCommissions = totalCommissions - paidCommissions;
  const activeLeads = leads.filter(l => l.status !== 'gagne' && l.status !== 'perdu' && l.status !== 'signe').length;
  const filteredSignedLeads = useMemo(
    () =>
      signedLeads.filter((lead) => {
        const haystack = `${lead.companyName} ${lead.whatsapp} ${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [signedLeads, search]
  );
  const payoutRate = totalCommissions > 0 ? Math.round((paidCommissions / totalCommissions) * 100) : 0;

  const handleExport = () => {
    if (signedLeads.length === 0) return;
    const rows = signedLeads.map(l =>
      `"${l.companyName}","${l.whatsapp}","${STATUS_LABELS[l.status]}","${l.commissionAmount ? formatFCFA(l.commissionAmount) : '—'}","${l.commissionPaid ? 'Versée' : 'En attente'}","${format(new Date(l.createdAt), 'dd/MM/yyyy')}"`
    );
    const csv = `Entreprise,WhatsApp,Statut,Commission,Versement,Date soumission\n${rows.join('\n')}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions_partenaire_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mes Commissions</h1>
          <p className="text-text-secondary mt-0.5">Gains générés via vos contacts soumis à l'équipe Commando</p>
        </div>
        <button
          onClick={handleExport}
          disabled={signedLeads.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-noya-blue text-noya-black rounded-xl text-sm font-bold hover:scale-[1.02] transition-all disabled:opacity-40 shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
        >
          <Download size={16} /> Exporter CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/partenaire" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Tableau de bord
          <TrendingUp size={14} className="text-noya-blue" />
        </Link>
        <Link to="/partenaire/clients" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Mes contacts
          <Building2 size={14} className="text-noya-green" />
        </Link>
        <Link to="/partenaire/profil" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Profil / RIB
          <CheckCircle size={14} className="text-noya-orange" />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Contacts en cours', value: activeLeads.toString(),
            icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50',
            sub: 'traitement par le Commando',
          },
          {
            label: 'Contrats signés', value: signedLeads.length.toString(),
            icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50',
            sub: `${gainedLeads.length} deal${gainedLeads.length !== 1 ? 's' : ''} gagnés`,
          },
          {
            label: 'Commissions versées', value: paidCommissions > 0 ? formatFCFA(paidCommissions) : '—',
            icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50',
            sub: `${paidLeads.length} paiement${paidLeads.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'En attente de versement', value: pendingCommissions > 0 ? formatFCFA(pendingCommissions) : '—',
            icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50',
            sub: `${signedLeads.length - paidLeads.length} à verser`,
          },
        ].map((card) => (
          <div key={card.label} className="bg-noya-sidebar rounded-xl border border-white/5 p-5 shadow-sm hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-text-secondary font-medium">{card.label}</p>
              <div className={`p-2 rounded-xl ${card.bg}`}>
                <card.icon size={18} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
            <p className="text-xs text-text-secondary/50 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Total banner */}
      {totalCommissions > 0 && (
        <div className="bg-gradient-to-r from-noya-green/30 to-noya-green/10 border border-noya-green/20 rounded-2xl p-6 text-text-primary flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
          <div>
            <p className="text-noya-green text-sm font-bold uppercase tracking-wider">Total commissions générées</p>
            <p className="text-4xl font-black mt-1">{formatFCFA(totalCommissions)}</p>
          </div>
          <div className="flex gap-8 md:text-right">
            <div>
              <p className="text-text-secondary text-xs uppercase font-bold">Versées</p>
              <p className="text-xl font-bold text-noya-green">{formatFCFA(paidCommissions)}</p>
            </div>
            <div className="border-l border-white/10 pl-8">
              <p className="text-text-secondary text-xs uppercase font-bold">En attente</p>
              <p className="text-xl font-bold text-noya-orange">{formatFCFA(pendingCommissions)}</p>
            </div>
          </div>
          <div className="w-full md:w-56">
            <p className="text-xs text-text-secondary uppercase font-bold">Taux de versement</p>
            <div className="mt-2 h-2 rounded-full bg-black/20 overflow-hidden">
              <div className="h-full bg-noya-green rounded-full" style={{ width: `${payoutRate}%` }} />
            </div>
            <p className="mt-1 text-sm font-bold text-text-primary">{payoutRate}% versé</p>
          </div>
        </div>
      )}

      {/* Commission table */}
      <div className="bg-noya-sidebar rounded-xl border border-white/5 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-bold text-text-primary">Historique des commissions</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            Uniquement les contacts ayant atteint la signature ou mieux. Les commissions sont définies par l'équipe Commando.
          </p>
          <div className="mt-3 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une entreprise ou un contact..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 outline-none focus:ring-2 focus:ring-noya-blue"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-b-2 border-noya-blue rounded-full animate-spin" />
          </div>
        ) : filteredSignedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary/50 gap-3">
            <DollarSign size={40} className="opacity-20" />
            <p className="font-medium text-text-secondary">{signedLeads.length === 0 ? 'Aucune commission pour le moment.' : 'Aucun résultat pour cette recherche.'}</p>
            <p className="text-sm text-center max-w-xs text-text-secondary/70">
              Vos commissions apparaîtront ici dès qu'un de vos contacts aura signé un contrat avec Noya Industries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-text-secondary/50 text-xs uppercase tracking-wide border-b border-white/5">
                  <th className="px-5 py-3 font-medium">Entreprise</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Commission</th>
                  <th className="px-5 py-3 font-medium">Versement</th>
                  <th className="px-5 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {filteredSignedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-noya-blue/20 flex items-center justify-center text-noya-blue font-bold text-xs uppercase">
                          {lead.companyName.substring(0, 2)}
                        </div>
                        <p className="font-bold text-text-primary">{lead.companyName}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-text-secondary">{lead.whatsapp}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        lead.status === 'gagne' ? 'bg-noya-green/20 text-noya-green' : 'bg-noya-blue/20 text-noya-blue'
                      }`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {lead.commissionAmount ? (
                        <span className="font-black text-noya-green">{formatFCFA(lead.commissionAmount)}</span>
                      ) : (
                        <span className="text-text-secondary/50 text-xs italic">À définir</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {lead.commissionPaid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-noya-green/10 text-noya-green px-3 py-1.5 rounded-full border border-noya-green/20">
                          <CheckCircle size={12} /> Versée
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-noya-orange/10 text-noya-orange px-3 py-1.5 rounded-full border border-noya-orange/20">
                          <Clock size={12} /> En attente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-text-secondary text-right font-medium">
                      {format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All contacts summary */}
      <div className="bg-noya-sidebar rounded-xl border border-white/5 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-bold text-text-primary">Tous mes contacts soumis</h3>
        </div>
        {loading ? null : leads.length === 0 ? (
          <div className="px-5 py-8 text-center text-text-secondary/50 text-sm italic">Aucun contact soumis.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-white/5 text-text-secondary/50 text-xs uppercase tracking-wide border-b border-white/5">
                  <th className="px-5 py-3 font-medium">Entreprise</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Avancement</th>
                  <th className="px-5 py-3 font-medium">Note Commando</th>
                  <th className="px-5 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                    <td className="px-5 py-3 font-bold text-text-primary">{lead.companyName}</td>
                    <td className="px-5 py-3 text-text-secondary">{lead.whatsapp}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        lead.status === 'gagne' ? 'bg-noya-green/20 text-noya-green' :
                        lead.status === 'signe' ? 'bg-noya-green/20 text-noya-green' :
                        lead.status === 'perdu' ? 'bg-text-secondary/10 text-text-secondary' :
                        lead.status === 'soumis' ? 'bg-noya-orange/20 text-noya-orange' :
                        'bg-noya-blue/20 text-noya-blue'
                      }`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-text-secondary italic max-w-[200px] truncate">
                      {lead.commandoNote || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-text-secondary text-right font-medium">
                      {format(new Date(lead.createdAt), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
