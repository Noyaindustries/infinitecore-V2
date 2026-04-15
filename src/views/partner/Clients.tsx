import React, { useState, useEffect } from 'react';
import { Plus, User, X, Phone, Building2, Send, Search, Trash2, Clock, Briefcase, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../components/AuthProvider';
import { leadService, Lead, LeadStatus } from '../../services/leadService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, getDocs, onSnapshot, query, where } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';

type ReferredSignup = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  createdAt?: string;
  role?: string;
  referredBy?: string;
  referredByPartnerId?: string;
};

const normalizePartnerCode = (code: string) => code.toUpperCase().replace('PART-USR', 'PART-INF');
const buildPartnerCode = (uid?: string) => `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;

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
const SECTOR_OPTIONS = ['BTP', 'Commerce', 'Services', 'Consulting', 'ONG', 'Autre'] as const;
const EMPLOYEE_RANGE_OPTIONS = ['1-5', '6-20', '21-50', '51-200', '200+'] as const;
const URGENCY_OPTIONS = [
  { value: 'faible', label: 'Faible' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'haute', label: 'Haute' },
] as const;
const FORM_STEPS = [
  { id: 1, label: 'Contact' },
  { id: 2, label: 'Entreprise' },
  { id: 3, label: 'Priorite' },
] as const;

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
  const [referredSignups, setReferredSignups] = useState<ReferredSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [confirmLeadSubmission, setConfirmLeadSubmission] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    companyName: '',
    companyDescription: '',
    city: '',
    sector: '',
    employeesRange: '',
    urgency: 'moyenne' as 'faible' | 'moyenne' | 'haute',
    whatsapp: '',
    note: '',
  });

  const resetForm = () => {
    setCurrentStep(1);
    setConfirmLeadSubmission(false);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      companyName: '',
      companyDescription: '',
      city: '',
      sector: '',
      employeesRange: '',
      urgency: 'moyenne',
      whatsapp: '',
      note: '',
    });
  };

  const validateStep = (step: 1 | 2 | 3): boolean => {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.whatsapp.trim()) {
        toast.error('Renseignez prénom, nom et WhatsApp.');
        return false;
      }
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        toast.error('Le format de l’email est invalide.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!form.companyName.trim() || !form.city.trim() || !form.sector.trim() || !form.employeesRange.trim()) {
        toast.error('Complétez les informations entreprise.');
        return false;
      }
      return true;
    }
    if (!confirmLeadSubmission) {
      toast.error('Confirmez l’étape finale avant de soumettre.');
      return false;
    }
    return true;
  };

  const attemptCloseForm = () => {
    if (submitting) {
      toast.error('Soumission en cours, veuillez patienter.');
      return;
    }

    const hasDraft = Object.values(form).some((value) => String(value).trim().length > 0);
    const shouldConfirm = hasDraft || currentStep > 1 || confirmLeadSubmission;
    if (shouldConfirm) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    if (e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    if (currentStep < 3 && validateStep(currentStep)) {
      setCurrentStep((prev) => (prev === 1 ? 2 : 3));
    }
  };

  const partnerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Partenaire';
  const partnerUid = String(userData?.uid || user?.uid || '');
  const referralCode = normalizePartnerCode(String(userData?.referralCode || buildPartnerCode(partnerUid)));
  const partnerCodeLegacy = normalizePartnerCode(String(userData?.partnerCode || ''));

  useEffect(() => {
    if (!partnerUid) return;
    const unsub = leadService.subscribeToPartnerLeads(partnerUid, (data) => {
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
  }, [partnerUid]);

  useEffect(() => {
    if (!partnerUid) {
      setReferredSignups([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const referralKeys = new Set<string>([
        referralCode,
        normalizePartnerCode(String(userData?.referralCode || '')),
        normalizePartnerCode(buildPartnerCode(partnerUid)),
        partnerCodeLegacy,
        String(partnerUid || '').toUpperCase(),
      ].filter(Boolean));

      const signups = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ReferredSignup, "id">) }))
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
    return () => unsub();
  }, [partnerUid, referralCode, partnerCodeLegacy, userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      if (!validateStep(currentStep)) return;
      setCurrentStep((prev) => (prev === 1 ? 2 : 3));
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim() || !form.companyName.trim() || !form.sector.trim() || !form.city.trim() || !form.employeesRange.trim() || !form.whatsapp.trim()) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    if (!validateStep(3)) return;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Le format de l’email est invalide.');
      return;
    }
    if (!partnerUid) return;
    setSubmitting(true);
    try {
      const leadId = await leadService.createLead({
        partnerId: partnerUid,
        partnerName,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        companyName: form.companyName.trim(),
        companyDescription: form.companyDescription.trim() || undefined,
        city: form.city.trim(),
        sector: form.sector,
        employeesRange: form.employeesRange,
        urgency: form.urgency,
        whatsapp: form.whatsapp.trim(),
        phone: form.whatsapp.trim(),
        note: form.note.trim() || undefined,
        status: 'soumis',
      });

      const notificationTitle = 'Nouveau lead partenaire';
      const notificationMessage = `${partnerName} a soumis un contact : ${form.firstName.trim()} ${form.lastName.trim()} (${form.companyName.trim()}, ${form.city.trim()}) — Secteur: ${form.sector} — Taille: ${form.employeesRange} — Urgence: ${form.urgency} — WhatsApp: ${form.whatsapp.trim()}${form.email.trim() ? ` — Email: ${form.email.trim()}` : ''}${form.companyDescription.trim() ? ` — Description: ${form.companyDescription.trim()}` : ''}`;
      const notificationMetadata = { partnerId: partnerUid };

      // Diffuse au Commando/Admin pour que les formulaires partenaires arrivent bien dans leur espace.
      let relayToOtherSpacesOk = true;
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const recipients = new Set<string>();

        for (const d of usersSnap.docs) {
          const data = d.data() as { uid?: string; role?: string };
          const role = String(data.role || '').toLowerCase();
          if (role === 'commando' || role === 'admin') {
            recipients.add(data.uid || d.id);
          }
        }

        if (recipients.size > 0) {
          await Promise.all(
            Array.from(recipients).map((recipientId) =>
              notificationService.createNotification(
                recipientId,
                notificationTitle,
                notificationMessage,
                'order',
                notificationMetadata
              )
            )
          );
        } else {
          await notificationService.createNotification(
            'admin_general',
            notificationTitle,
            notificationMessage,
            'order',
            notificationMetadata
          );
        }

        // Pas d'écriture dans `tasks` ici : le rôle partner n'y est pas autorisé.
        // Le pipeline Commando reçoit déjà ces leads via la collection `leads`
        // et les notifications envoyées ci-dessus.
      } catch (notifyError) {
        relayToOtherSpacesOk = false;
        console.error('[PartnerClients] notify commando/admin failed:', notifyError);
      }

      if (relayToOtherSpacesOk) {
        toast.success('Contact soumis — transmis au Commando via le pipeline leads.');
      } else {
        toast.error('Contact enregistré, mais la transmission vers les autres espaces a échoué.');
      }
      setIsModalOpen(false);
      resetForm();
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
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
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
          title="Filtrer par statut"
          aria-label="Filtrer par statut"
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

      <div className="rounded-xl border border-white/5 bg-noya-sidebar p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary">Inscriptions via mon lien</h2>
          <span className="rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2.5 py-1 text-[11px] font-bold text-noya-blue">
            {referredSignups.length}
          </span>
        </div>
        {referredSignups.length === 0 ? (
          <p className="text-sm text-text-secondary">Aucune inscription rattachée à votre lien pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {referredSignups.map((signup) => (
              <div key={signup.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {`${signup.firstName || ''} ${signup.lastName || ''}`.trim() || signup.email || 'Nouveau client'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {signup.companyName || signup.company || 'Entreprise non renseignée'} · {signup.phone || 'Téléphone non renseigné'}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-noya-blue">
                    Parrainé · {partnerName}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-text-secondary">
                  {signup.createdAt ? format(new Date(signup.createdAt), 'dd MMM', { locale: fr }) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
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
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
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
                  <span className="mt-1 inline-flex items-center rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-noya-blue">
                    Parrainé · {lead.partnerName || partnerName}
                  </span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-1 backdrop-blur-[3px] sm:p-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-linear-to-br from-[#0D1320] via-[#0F1728] to-[#111C2F] shadow-[0_35px_90px_rgba(0,0,0,0.65)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-r from-noya-blue/25 via-noya-purple/15 to-noya-green/20" />
              <div className="pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-noya-blue/15 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 top-12 h-44 w-44 rounded-full bg-noya-green/10 blur-3xl" />
              <div className="relative border-b border-white/10 bg-black/20 px-4 py-3 pr-12">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-noya-blue/40 bg-noya-blue/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-noya-blue">
                    <Sparkles size={12} />
                    Lead Prestige
                  </span>
                  <h2 className="mt-1.5 text-lg font-black tracking-tight text-text-primary">Nouveau contact PME</h2>
                  <p className="mt-0.5 text-[10px] text-text-secondary">Formulaire qualifie pour prise en charge prioritaire Commando.</p>
                </div>
                <button
                  title="Fermer le formulaire"
                  aria-label="Fermer le formulaire"
                  onClick={attemptCloseForm}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="relative space-y-2.5 p-3">
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                  {FORM_STEPS.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      disabled={step.id > currentStep}
                      onClick={() => setCurrentStep(step.id as 1 | 2 | 3)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                        currentStep === step.id ? 'bg-noya-blue text-noya-black' : 'text-text-secondary'
                      } ${step.id > currentStep ? 'opacity-50' : 'hover:bg-white/10'}`}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>

                {currentStep === 1 ? (
                  <section className="space-y-2 rounded-2xl border border-white/10 bg-white/4 p-2.5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-noya-blue">Identite du contact</h3>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-primary">Prénom <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                          <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jean" className="w-full rounded-xl border border-white/10 bg-black/35 py-1.5 pl-9 pr-4 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">Nom <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                          <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Dupont" className="w-full rounded-xl border border-white/10 bg-black/35 py-1.5 pl-9 pr-4 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">Email (optionnel)</label>
                        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@entreprise.com" className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">WhatsApp <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                          <input type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="+225 07 00 00 00 00" className="w-full rounded-xl border border-white/10 bg-black/35 py-1.5 pl-9 pr-4 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required />
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {currentStep === 2 ? (
                  <section className="space-y-2 rounded-2xl border border-white/10 bg-white/4 p-2.5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-noya-blue">Entreprise</h3>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Nom de l'entreprise / PME <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                        <input type="text" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Ex: TechCorp SARL" className="w-full rounded-xl border border-white/10 bg-black/35 py-1.5 pl-9 pr-4 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Description de l'entreprise</label>
                      <textarea
                        rows={2}
                        value={form.companyDescription}
                        onChange={(e) => setForm((f) => ({ ...f, companyDescription: e.target.value }))}
                        placeholder="Activite principale, positionnement, clients cibles..."
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">Ville <span className="text-red-500">*</span></label>
                        <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Abidjan" className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">Secteur <span className="text-red-500">*</span></label>
                        <select title="Secteur d'activité" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required>
                          <option value="" disabled className="bg-noya-sidebar">Secteur</option>
                          {SECTOR_OPTIONS.map((option) => (<option key={option} value={option} className="bg-noya-sidebar">{option}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-secondary">Taille <span className="text-red-500">*</span></label>
                        <select title="Taille d'entreprise" value={form.employeesRange} onChange={(e) => setForm((f) => ({ ...f, employeesRange: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" required>
                          <option value="" disabled className="bg-noya-sidebar">Taille</option>
                          {EMPLOYEE_RANGE_OPTIONS.map((option) => (<option key={option} value={option} className="bg-noya-sidebar">{option}</option>))}
                        </select>
                      </div>
                    </div>
                  </section>
                ) : null}

                {currentStep === 3 ? (
                  <section className="space-y-2 rounded-2xl border border-white/10 bg-white/4 p-2.5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-noya-blue">Priorite et contexte</h3>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Fonction (optionnel)</label>
                      <input type="text" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="DG, Responsable RH..." className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Niveau d'urgence</label>
                      <div className="grid grid-cols-3 gap-2">
                        {URGENCY_OPTIONS.map((option) => (
                          <button key={option.value} type="button" onClick={() => setForm((f) => ({ ...f, urgency: option.value }))} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                            form.urgency === option.value ? 'border-noya-blue bg-noya-blue/25 text-noya-blue shadow-[0_0_12px_rgba(110,167,234,0.25)]' : 'border-white/10 text-text-secondary hover:bg-white/5'
                          }`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Contexte (optionnel)</label>
                      <textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ex: besoin de devis rapide, projet en cours de validation..." className="w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-1.5 text-sm text-text-primary shadow-inner outline-none transition-colors focus:border-noya-blue/60 focus:ring-2 focus:ring-noya-blue/30" />
                    </div>
                    <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={confirmLeadSubmission}
                        onChange={(e) => setConfirmLeadSubmission(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-noya-blue focus:ring-noya-blue/40"
                      />
                      <span>
                        Je confirme que les informations sont finalisées et prêtes à être transmises au Commando.
                      </span>
                    </label>
                  </section>
                ) : null}

                <div className="flex items-center gap-2 rounded-xl border border-noya-green/25 bg-noya-green/10 px-3 py-1 text-xs text-noya-green">
                  <ShieldCheck size={14} />
                  Vos donnees sont reservees au traitement commercial interne.
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={attemptCloseForm}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5"
                  >
                    Annuler
                  </button>
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((prev) => (prev === 3 ? 2 : 1))}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                    >
                      Précédent
                    </button>
                  ) : null}
                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!validateStep(currentStep)) return;
                        setCurrentStep((prev) => (prev === 1 ? 2 : 3));
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-noya-blue via-[#7cb7f1] to-[#9bd6ff] px-4 py-2 text-sm font-black text-noya-black shadow-[0_8px_24px_rgba(110,167,234,0.45)] transition-all hover:scale-[1.015]"
                    >
                      Continuer
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-noya-blue via-[#7cb7f1] to-[#9bd6ff] px-4 py-2 text-sm font-black text-noya-black shadow-[0_8px_24px_rgba(110,167,234,0.45)] transition-all hover:scale-[1.015] disabled:opacity-50"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <><Send size={16} /> Soumettre au Commando</>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
