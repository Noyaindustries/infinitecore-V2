import React, { useState, useEffect } from 'react';
import { Plus, User, X, Phone, Building2, Send, Search, Trash2, Clock, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../components/FirebaseProvider';
import { leadService, Lead, LeadStatus } from '../../services/leadService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<LeadStatus, string> = {
  soumis: 'Soumis',
  contacte: 'Contacté',
  en_demo: 'En démo',
  proposition: 'Proposition',
  signe: 'Contrat signé',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

const STATUS_ORDER: LeadStatus[] = ['soumis', 'contacte', 'en_demo', 'proposition', 'signe', 'gagne'];

function ProgressBar({ status }: { status: LeadStatus }) {
  if (status === 'perdu') {
    return <div className="flex items-center gap-1.5 text-xs text-text-secondary opacity-50"><span className="w-2 h-2 rounded-full bg-border inline-block"></span>Perdu</div>;
  }
  const idx = STATUS_ORDER.indexOf(status);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-noya-black/50 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full transition-all ${status === 'gagne' ? 'bg-noya-green' : 'bg-noya-blue'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-text-secondary w-8 text-right">{pct}%</span>
    </div>
  );
}

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

export default function PartnerClients() {
  const { user, userData } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', companyName: '', sector: '', whatsapp: '' });

  const partnerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Partenaire';

  useEffect(() => {
    if (!user) return;
    const unsub = leadService.subscribeToPartnerLeads(user.uid, (data) => {
      // Client-side sort: newest first
      const sorted = [...data].sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setLeads(sorted);
      setLoading(false);
    });
    
    // Safety timeout: if no data after 5s, stop spinner
    const timer = setTimeout(() => setLoading(false), 5000);
    
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.whatsapp.trim()) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      await leadService.createLead({
        partnerId: user.uid,
        partnerName,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        companyName: form.companyName.trim(),
        sector: form.sector,
        whatsapp: form.whatsapp.trim(),
        status: 'soumis',
      });
      await notificationService.createNotification(
        'admin_general',
        'Nouveau lead partenaire',
        `${partnerName} a soumis un contact : ${form.firstName.trim()} ${form.lastName.trim()} (${form.companyName.trim()}) — Secteur: ${form.sector} — WhatsApp: ${form.whatsapp.trim()}`,
        'order',
        { partnerId: user.uid }
      );
      toast.success('Contact soumis — l\'équipe Commando prend le relais !');
      setIsModalOpen(false);
      setForm({ firstName: '', lastName: '', companyName: '', sector: '', whatsapp: '' });
    } catch (err) {
      console.error('[PartnerClients] submit:', err);
      toast.error('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (lead.status !== 'soumis') {
      toast.error('Impossible de supprimer un lead déjà en traitement.');
      return;
    }
    if (!confirm(`Supprimer le contact "${lead.companyName}" ?`)) return;
    try {
      await leadService.deleteLead(lead.id);
      toast.success('Contact supprimé.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const filtered = leads.filter((l) => {
    const matchSearch = l.companyName.toLowerCase().includes(search.toLowerCase()) ||
      l.whatsapp.includes(search);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = leads.filter(l => l.status !== 'gagne' && l.status !== 'perdu').length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mes Contacts soumis</h1>
          <p className="text-text-secondary mt-0.5">
            {leads.length} contact{leads.length !== 1 ? 's' : ''} soumis · {activeCount} en cours de traitement
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-noya-blue text-noya-black rounded-xl font-bold hover:scale-[1.02] transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
        >
          <Plus size={18} /> Nouveau contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une entreprise, un numéro..."
            className="w-full pl-9 pr-4 py-2 border border-white/10 bg-noya-black text-text-primary rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-border bg-noya-sidebar rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-noya-blue outline-none"
        >
          <option value="all">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-b-2 border-noya-blue rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-noya-sidebar rounded-xl border border-white/5 flex flex-col items-center justify-center py-16 text-text-secondary gap-3">
          <Building2 size={40} className="opacity-20 text-text-primary" />
          <p className="font-medium text-text-secondary">
            {leads.length === 0 ? 'Aucun contact soumis pour le moment.' : 'Aucun résultat.'}
          </p>
          {leads.length === 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 px-6 py-2 bg-noya-blue text-noya-black rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg"
            >
              Soumettre mon premier contact
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-noya-sidebar rounded-xl border border-white/5 p-4 hover:shadow-md transition-shadow relative"
            >
              {/* Status badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  lead.status === 'gagne' ? 'bg-noya-green/20 text-noya-green' :
                  lead.status === 'perdu' ? 'bg-text-secondary/10 text-text-secondary' :
                  lead.status === 'soumis' ? 'bg-noya-orange/20 text-noya-orange' :
                  'bg-noya-blue/20 text-noya-blue'
                }`}>
                  {STATUS_LABELS[lead.status]}
                </span>
                {lead.status === 'soumis' && (
                  <button
                    onClick={() => handleDelete(lead)}
                    className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Company & Name */}
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 shrink-0 rounded-full bg-noya-blue/20 flex items-center justify-center text-noya-blue font-bold text-xs uppercase">
                  {lead.companyName.substring(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-text-primary text-sm leading-tight">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-xs text-text-secondary font-medium">{lead.companyName}</p>
                </div>
              </div>

              {/* Info grid */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase size={12} className="text-gray-400" />
                  <span className="text-[11px] text-text-secondary font-medium">{lead.sector || 'Secteur non défini'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-text-secondary/50" />
                  <p className="text-[11px] text-text-secondary font-medium">{lead.whatsapp}</p>
                </div>
              </div>

              {/* Progress bar */}
              <ProgressBar status={lead.status} />

              {/* Commando note */}
              {lead.commandoNote && (
                <div className="mt-3 bg-noya-blue/10 rounded-lg p-2.5">
                  <p className="text-xs text-noya-blue italic">"{lead.commandoNote}"</p>
                </div>
              )}

              {/* Commission */}
              {lead.commissionAmount && lead.status === 'gagne' && (
                <div className="mt-3 flex items-center justify-between bg-noya-green/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-noya-green font-medium">Commission</span>
                  <span className="text-sm font-bold text-noya-green">{formatFCFA(lead.commissionAmount)}</span>
                </div>
              )}

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                <Clock size={11} className="text-text-secondary/30" />
                <p className="text-[11px] text-text-secondary/50">
                  Soumis le {format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr })}
                </p>
                {lead.updatedAt && lead.updatedAt !== lead.createdAt && (
                  <p className="text-[11px] text-text-secondary/50 ml-auto">
                    màj {format(new Date(lead.updatedAt), 'dd MMM', { locale: fr })}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Submit modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-noya-black/20">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Nouveau contact PME</h2>
                  <p className="text-xs text-text-secondary mt-1">Le Commando Noya contactera ce prospect en votre nom.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="Jean"
                        className="w-full pl-9 pr-4 py-2.5 bg-noya-black border border-white/10 rounded-xl text-text-primary focus:ring-2 focus:ring-noya-blue outline-none text-sm shadow-inner"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Dupont"
                        className="w-full pl-9 pr-4 py-2.5 border border-border bg-noya-black text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Nom de l'entreprise / PME <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))}
                      placeholder="Ex: TechCorp SARL"
                      className="w-full pl-9 pr-4 py-2.5 border border-border bg-noya-black text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Secteur d'activité <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                    <select
                      value={form.sector}
                      onChange={(e) => setForm(f => ({ ...f, sector: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 border border-border bg-noya-black text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-sm appearance-none cursor-pointer"
                      required
                    >
                      <option value="" disabled className="bg-noya-sidebar">Sélectionnez un secteur</option>
                      <option value="BTP" className="bg-noya-sidebar">BTP</option>
                      <option value="Commerce" className="bg-noya-sidebar">Commerce</option>
                      <option value="Services" className="bg-noya-sidebar">Services</option>
                      <option value="Consulting" className="bg-noya-sidebar">Consulting</option>
                      <option value="ONG" className="bg-noya-sidebar">ONG</option>
                      <option value="Autre" className="bg-noya-sidebar">Autre</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Numéro WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={(e) => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full pl-9 pr-4 py-2.5 border border-white/10 bg-noya-black text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-sm shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-white/10 text-text-secondary rounded-xl font-medium text-sm hover:bg-white/5 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-noya-blue text-noya-black rounded-xl font-bold text-sm hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <><Send size={16} /> Soumettre au Commando</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
