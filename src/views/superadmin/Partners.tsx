import React, { useMemo, useState, useEffect, Fragment } from 'react';
import { Search, Filter, Edit2, Save, X, Plus, Mail, Phone, CheckCircle, Clock, Copy, Briefcase, Trash2, Users, ExternalLink, Package, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, setDoc, doc, updateDoc, deleteDoc, orderBy } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { createUserAsAdmin } from '../../utils/adminAuth';

interface PartnerMember {
  id: string;
  uid: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  clients: number;
  commissionRate: number;
  status: string;
  partnerCode: string;
  referralCode?: string;
  generatedPassword?: string;
}

type ReferredSignup = {
  id: string;
  uid?: string;
  role?: string;
  referredBy?: string;
  referredByPartnerId?: string;
  referredByPartnerName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  company?: string;
  industry?: string;
  createdAt?: string;
};

type PartnerLead = {
  id: string;
  partnerId?: string;
  partnerName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  companyName?: string;
  sector?: string;
  status?: string;
  commissionAmount?: number;
  commandoNote?: string;
  createdAt?: string;
};

type FilleulRow = {
  id: string;
  source: 'lead' | 'signup';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  sector: string;
  status: string;
  commissionAmount: number;
  commandoNote: string;
  createdAt: string;
  leadId?: string;
  signupId?: string;
};

const normalizePartnerCode = (code: string) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .replace('PART-USR', 'PART-INF');
const buildPartnerCode = (uid?: string) => `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;
const buildPartnerCodeShort = (uid?: string) => `PART-${(uid || '').substring(0, 5).toUpperCase().replace('USR', 'INF')}`;

const LEAD_STATUS_OPTIONS = ['soumis', 'contacte', 'en_demo', 'proposition', 'signe', 'gagne', 'perdu'] as const;

function safeIso(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toStatusLabel(status: string) {
  switch (status) {
    case 'signe':
    case 'gagne':
      return 'Converti';
    case 'contacte':
    case 'en_demo':
    case 'proposition':
      return 'En phase';
    case 'perdu':
      return 'Perdu';
    default:
      return 'Inscrit';
  }
}

function isSignupLinkedToPartner(signup: ReferredSignup, partner: PartnerMember) {
  const partnerUid = String(partner.uid || partner.id || '');
  const referralKeys = new Set<string>(
    [
      normalizePartnerCode(String(partner.referralCode || '')),
      normalizePartnerCode(String(partner.partnerCode || '')),
      normalizePartnerCode(buildPartnerCode(partnerUid)),
      normalizePartnerCode(buildPartnerCodeShort(partnerUid)),
      partnerUid.toUpperCase(),
    ].filter(Boolean)
  );

  const byPartnerId = String(signup.referredByPartnerId || '') === partnerUid;
  const referredByRaw = String(signup.referredBy || '').trim();
  const byReferralCode = referralKeys.has(normalizePartnerCode(referredByRaw));
  const byLegacyUid = referredByRaw === partnerUid;
  const byPartnerName =
    String(signup.referredByPartnerName || '').trim().toLowerCase() === String(partner.name || '').trim().toLowerCase();
  return byPartnerId || byReferralCode || byLegacyUid || byPartnerName;
}

export default function SuperAdminPartners() {
  const [partners, setPartners] = useState<PartnerMember[]>([]);
  const [referredSignups, setReferredSignups] = useState<ReferredSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', company: '', email: '', phone: '' });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<PartnerMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRate, setEditRate] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedPartner, setSelectedPartner] = useState<PartnerMember | null>(null);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [referralUsers, setReferralUsers] = useState<ReferredSignup[]>([]);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isUpdatingLead, setIsUpdatingLead] = useState<string | null>(null);
  const [filleulSearch, setFilleulSearch] = useState('');
  const [filleulFilter, setFilleulFilter] = useState<'all' | 'lead' | 'signup'>('all');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'partner'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partnersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: String(data.uid || doc.id),
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          company: data.companyName || 'Indépendant',
          email: data.email,
          phone: data.phone || 'Non renseigné',
          clients: data.referredClientsCount || 0,
          commissionRate: data.commissionRate || 10,
          status: 'Actif',
          partnerCode: data.partnerCode || `PART-${doc.id.substring(0, 5).toUpperCase()}`,
          referralCode: data.referralCode,
          generatedPassword: data.generatedPassword
        };
      });
      setPartners(partnersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching partners:", error);
      toast.error("Erreur lors du chargement des partenaires.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'client'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setReferredSignups(snapshot.docs.map((row) => ({ id: row.id, ...(row.data() as Omit<ReferredSignup, 'id'>) })));
      },
      (error) => {
        console.error('Error fetching referred signups:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.email) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const authResult = await createUserAsAdmin(newPartner.email, undefined, 'partner');
      
      if (!authResult.success || !authResult.uid) {
        throw new Error(authResult.error || "Erreur lors de la création du compte.");
      }

      const nameParts = newPartner.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      await setDoc(doc(db, 'users', authResult.uid), {
        uid: authResult.uid,
        email: newPartner.email,
        firstName: firstName,
        lastName: lastName,
        companyName: newPartner.company || null,
        phone: newPartner.phone || null,
        role: 'partner',
        commissionRate: 10,
        referredClientsCount: 0,
        partnerCode: `PART-${authResult.uid.substring(0, 5).toUpperCase()}`,
        createdAt: new Date().toISOString()
      });

      setGeneratedPassword(authResult.invitationSent ? "Invitation envoyée par email" : "Invitation non envoyée");
      toast.success('Partenaire ajouté avec succès.');
    } catch (error: any) {
      console.error("Error adding partner:", error);
      toast.error(error.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setIsSubmitting(true);
    try {
      const nameParts = editingPartner.name.split(' ');
      await updateDoc(doc(db, 'users', editingPartner.id), {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        companyName: editingPartner.company || null,
        phone: editingPartner.phone || null,
        commissionRate: editingPartner.commissionRate
      });
      toast.success('Partenaire mis à jour.');
      setIsEditModalOpen(false);
      setEditingPartner(null);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!confirm(`Supprimer le partenaire ${name} ?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Partenaire supprimé.');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const openLeadsModal = (partner: PartnerMember) => {
    setSelectedPartner(partner);
    setIsLeadsModalOpen(true);
    setIsLoadingLeads(true);
    
    // Subscribe to leads for this partner
    const q = query(collection(db, 'leads'), where('partnerId', '==', partner.uid), orderBy('createdAt', 'desc'));
    const unsubscribeLeads = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingLeads(false);
    }, (error) => {
      console.error(error);
      toast.error('Erreur lors du chargement des leads.');
      setIsLoadingLeads(false);
    });

    const qUsers = query(collection(db, 'users'), where('role', '==', 'client'));
    const unsubscribeUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        const linkedUsers = snapshot.docs
          .map((row) => ({ id: row.id, ...(row.data() as Omit<ReferredSignup, 'id'>) }))
          .filter((signup) => isSignupLinkedToPartner(signup, partner));
        setReferralUsers(linkedUsers);
      },
      (error) => {
        console.error(error);
      }
    );

    return () => {
      unsubscribeLeads();
      unsubscribeUsers();
    };
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setIsUpdatingLead(leadId);
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success('Statut du lead mis à jour !');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsUpdatingLead(null);
    }
  };

  const handleUpdateLeadCommission = async (leadId: string, commissionAmount: number) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        commissionAmount: Number.isFinite(commissionAmount) ? Math.max(0, commissionAmount) : 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour de la commission.');
    }
  };

  const handleUpdateLeadNote = async (leadId: string, commandoNote: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        commandoNote,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour de la note.');
    }
  };

  const resetModal = () => {
    setNewPartner({ name: '', company: '', email: '', phone: '' });
    setGeneratedPassword(null);
    setIsModalOpen(false);
  };

  const closeAddModal = (force = false) => {
    if (isSubmitting) return;
    const hasDraft =
      !generatedPassword &&
      (newPartner.name.trim().length > 0 ||
        newPartner.company.trim().length > 0 ||
        newPartner.email.trim().length > 0 ||
        newPartner.phone.trim().length > 0);
    if (!force && hasDraft) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }
    resetModal();
  };

  const closeEditModal = () => {
    if (isSubmitting) return;
    if (editingPartner) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les modifications non enregistrées seront perdues.'
      );
      if (!confirmed) return;
    }
    setIsEditModalOpen(false);
    setEditingPartner(null);
  };

  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast.success('Mot de passe copié !');
    }
  };

  const partnersWithComputedReferrals = useMemo(
    () =>
      partners.map((partner) => ({
        ...partner,
        clients: referredSignups.filter((signup) => isSignupLinkedToPartner(signup, partner)).length,
      })),
    [partners, referredSignups]
  );

  const filteredPartners = partnersWithComputedReferrals.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filleulsRows = useMemo<FilleulRow[]>(() => {
    const signupByEmail = new Map<string, ReferredSignup>();
    for (const signup of referralUsers) {
      const emailKey = String(signup.email || '').trim().toLowerCase();
      if (!emailKey || signupByEmail.has(emailKey)) continue;
      signupByEmail.set(emailKey, signup);
    }

    const mergedLeads: FilleulRow[] = leads.map((lead) => {
      const emailKey = String(lead.email || '').trim().toLowerCase();
      const signup = emailKey ? signupByEmail.get(emailKey) : undefined;
      if (emailKey && signup) signupByEmail.delete(emailKey);
      return {
        id: `lead-${lead.id}`,
        source: 'lead',
        firstName: String(lead.firstName || signup?.firstName || ''),
        lastName: String(lead.lastName || signup?.lastName || ''),
        email: String(lead.email || signup?.email || ''),
        phone: String(lead.phone || lead.whatsapp || signup?.phone || ''),
        companyName: String(lead.companyName || signup?.companyName || signup?.company || '—'),
        sector: String(lead.sector || signup?.industry || 'Non spécifié'),
        status: String(lead.status || 'soumis'),
        commissionAmount: Number(lead.commissionAmount || 0),
        commandoNote: String(lead.commandoNote || ''),
        createdAt: safeIso(String(lead.createdAt || signup?.createdAt)),
        leadId: lead.id,
        signupId: signup?.id,
      };
    });

    const signupOnlyRows: FilleulRow[] = Array.from(signupByEmail.values()).map((signup) => ({
      id: `signup-${signup.id}`,
      source: 'signup',
      firstName: String(signup.firstName || ''),
      lastName: String(signup.lastName || ''),
      email: String(signup.email || ''),
      phone: String(signup.phone || ''),
      companyName: String(signup.companyName || signup.company || '—'),
      sector: String(signup.industry || 'Non spécifié'),
      status: 'soumis',
      commissionAmount: 0,
      commandoNote: '',
      createdAt: safeIso(String(signup.createdAt || '')),
      signupId: signup.id,
    }));

    return [...mergedLeads, ...signupOnlyRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [leads, referralUsers]);

  const filteredFilleulsRows = useMemo(() => {
    const q = filleulSearch.trim().toLowerCase();
    return filleulsRows.filter((row) => {
      if (filleulFilter !== 'all' && row.source !== filleulFilter) return false;
      if (!q) return true;
      const blob = `${row.firstName} ${row.lastName} ${row.email} ${row.companyName} ${row.phone}`.toLowerCase();
      return blob.includes(q);
    });
  }, [filleulsRows, filleulSearch, filleulFilter]);

  const filleulStats = useMemo(() => {
    const total = filleulsRows.length;
    const leadsCount = filleulsRows.filter((row) => row.source === 'lead').length;
    const signupsOnly = filleulsRows.filter((row) => row.source === 'signup').length;
    const converted = filleulsRows.filter((row) => row.status === 'signe' || row.status === 'gagne').length;
    const commissionTotal = filleulsRows.reduce((sum, row) => sum + (Number.isFinite(row.commissionAmount) ? row.commissionAmount : 0), 0);
    return { total, leadsCount, signupsOnly, converted, commissionTotal };
  }, [filleulsRows]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Réseau Partenaires</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Pilotage des affiliations, commissions et génération de leads</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
        >
          <Plus size={18} />
          Nouveau Partenaire
        </button>
      </div>

      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Indexer un partenaire par nom ou email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-surface-tertiary transition-all">
            <Filter size={14} /> Affiner la sélection
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">Partenaire / Entité</th>
                <th className="p-4">Code Infinite</th>
                <th className="p-4">Accès & Contact</th>
                <th className="p-4 text-center">Réseau</th>
                <th className="p-4">Commission</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text-secondary">
                    <div className="w-8 h-8 border-b-2 border-noya-blue rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text-dim italic">Aucun partenaire répertorié</td>
                </tr>
              ) : filteredPartners.map((partner) => (
                <tr key={partner.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                  <td className="p-4">
                    <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors">{partner.name}</div>
                    <div className="text-[10px] text-text-secondary opacity-50 flex items-center gap-1 mt-1 font-black uppercase tracking-tighter">
                      <Briefcase size={10} /> {partner.company}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-[10px] font-black bg-surface-primary px-2 py-1 rounded border border-border-subtle text-noya-blue shadow-inner tracking-widest uppercase">
                      {partner.partnerCode}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Mail size={12} className="text-noya-blue/50" /> {partner.email}
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Phone size={12} className="text-noya-blue/50" /> {partner.phone}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {partner.generatedPassword ? (
                      <div className="flex items-center gap-2 bg-surface-primary w-fit px-3 py-1.5 rounded-lg border border-border-subtle">
                        <code className="text-[10px] text-noya-blue font-bold tracking-widest">
                          {partner.generatedPassword}
                        </code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(partner.generatedPassword || '');
                            toast.success('Mot de passe copié !');
                          }}
                          className="text-text-secondary/30 hover:text-noya-blue transition-all"
                          title="Copier"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-dim uppercase font-black tracking-widest italic">Sécurisé</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-black text-lg text-text-primary leading-none">{partner.clients}</span>
                      <span className="text-[8px] uppercase tracking-widest text-text-secondary opacity-50 font-black mt-1">Filleuls</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 bg-noya-orange/10 px-3 py-1.5 rounded-lg border border-noya-orange/20 w-fit">
                      <span className="font-black text-noya-orange text-xs">{partner.commissionRate}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openLeadsModal(partner)}
                        className="p-2 transition-all text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                        title="Dossiers Filleuls"
                      >
                        <Users size={18} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingPartner(partner);
                          setIsEditModalOpen(true);
                        }} 
                        className="p-2 transition-all text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                        title="Modifier"
                      >
                        <Edit2 size={18} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                      <button 
                        onClick={() => handleDeletePartner(partner.id, partner.name)}
                        className="p-2 transition-all text-text-muted hover:text-noya-red hover:bg-noya-red/10 rounded-xl group/btn"
                        title="Supprimer"
                      >
                        <Trash2 size={18} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajouter un partenaire */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Nouveau Partenaire</h2>
              <button 
                onClick={() => closeAddModal()}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            {generatedPassword ? (
              <div className="p-6 space-y-6">
                <div className="bg-noya-green/10 text-noya-green p-4 rounded-lg flex items-start gap-3 border border-noya-green/20">
                  <CheckCircle className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-bold">Partenaire créé avec succès !</p>
                    <p className="text-sm mt-1">Le partenaire reçoit un email pour définir son mot de passe.</p>
                  </div>
                </div>
                
                <div className="space-y-4 bg-surface-primary p-4 rounded-lg border border-border-subtle">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Email de connexion</p>
                    <p className="font-bold text-text-primary">{newPartner.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Statut de l’invitation</p>
                    <div className="flex items-center justify-between bg-surface-secondary px-3 py-2 rounded border border-border-subtle">
                      <code className="font-mono text-noya-blue font-bold">{generatedPassword}</code>
                      <button 
                        onClick={copyPassword}
                        className="p-1.5 text-text-muted hover:text-noya-blue transition-colors"
                        title="Copier le mot de passe"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => closeAddModal(true)}
                  className="w-full px-4 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg"
                >
                  Fermer la session
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddPartner} className="p-8 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Nom complet *</label>
                  <input 
                    type="text" 
                    required
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({...newPartner, name: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Entreprise</label>
                  <input 
                    type="text" 
                    value={newPartner.company}
                    onChange={(e) => setNewPartner({...newPartner, company: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Alex Consulting"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Email *</label>
                  <input 
                    type="email" 
                    required
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({...newPartner, email: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: jean.dupont@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Téléphone</label>
                  <input 
                    type="tel" 
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: +33 6 12 34 56 78"
                  />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => closeAddModal()}
                    className="flex-1 px-4 py-3 bg-surface-tertiary text-text-secondary rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-surface-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all disabled:opacity-50 shadow-lg"
                  >
                    {isSubmitting ? 'Création...' : 'Valider'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Modal Modifier un partenaire */}
      {isEditModalOpen && editingPartner && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Ajustement Profil</h2>
              <button 
                onClick={closeEditModal}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
                title="Fermer"
              >
                <X size={24} />
              </button>
            </div>
             <form onSubmit={handleUpdatePartner} className="p-8 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Nom complet *</label>
                <input 
                  type="text" required
                  value={editingPartner.name}
                  onChange={(e) => setEditingPartner({...editingPartner, name: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  title="Nom complet du partenaire"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Entreprise</label>
                <input 
                  type="text"
                  value={editingPartner.company}
                  onChange={(e) => setEditingPartner({...editingPartner, company: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  title="Entreprise du partenaire"
                />
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Téléphone</label>
                  <input 
                    type="tel"
                    value={editingPartner.phone}
                    onChange={(e) => setEditingPartner({...editingPartner, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-text-primary"
                    title="Téléphone du partenaire"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Commission (%)</label>
                  <input 
                    type="number"
                    value={editingPartner.commissionRate}
                    onChange={(e) => setEditingPartner({...editingPartner, commissionRate: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-noya-orange font-bold"
                    title="Commission du partenaire"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-3 bg-surface-tertiary text-text-secondary rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all disabled:opacity-50 shadow-lg"
                >
                  {isSubmitting ? 'Mise à jour...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Voir les leads */}
      {isLeadsModalOpen && selectedPartner && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-border-medium animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-border-subtle shrink-0 bg-surface-primary/50">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">Filleuls de {selectedPartner.name}</h2>
                  <span className="font-mono text-[10px] font-black bg-noya-blue/20 text-noya-blue px-3 py-1 rounded-lg border border-noya-blue/20 tracking-widest uppercase">
                    {selectedPartner.partnerCode}
                  </span>
                </div>
                <p className="text-xs text-text-secondary font-medium italic opacity-60">{filleulStats.total} contacts parrainés identifiés</p>
              </div>
              <button 
                onClick={() => {
                  setIsLeadsModalOpen(false);
                  setSelectedPartner(null);
                  setLeads([]);
                  setReferralUsers([]);
                  setFilleulFilter('all');
                  setFilleulSearch('');
                }}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
                title="Fermer"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg border border-border-subtle bg-surface-primary px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Total</p>
                  <p className="mt-1 text-lg font-black text-text-primary">{filleulStats.total}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-primary px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Leads</p>
                  <p className="mt-1 text-lg font-black text-noya-blue">{filleulStats.leadsCount}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-primary px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Inscriptions</p>
                  <p className="mt-1 text-lg font-black text-text-primary">{filleulStats.signupsOnly}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-primary px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Convertis</p>
                  <p className="mt-1 text-lg font-black text-noya-green">{filleulStats.converted}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-primary px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Commissions</p>
                  <p className="mt-1 text-lg font-black text-noya-orange">
                    {new Intl.NumberFormat('fr-FR').format(filleulStats.commissionTotal)} FCFA
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="text"
                  value={filleulSearch}
                  onChange={(e) => setFilleulSearch(e.target.value)}
                  placeholder="Rechercher par nom, e-mail, entreprise, téléphone..."
                  className="w-full rounded-xl border border-border-subtle bg-surface-primary px-4 py-2.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-noya-blue"
                  aria-label="Rechercher un filleul"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilleulFilter('all')}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filleulFilter === 'all' ? 'border-noya-blue/40 bg-noya-blue/10 text-noya-blue' : 'border-border-subtle text-text-secondary'}`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilleulFilter('lead')}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filleulFilter === 'lead' ? 'border-noya-blue/40 bg-noya-blue/10 text-noya-blue' : 'border-border-subtle text-text-secondary'}`}
                  >
                    Leads
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilleulFilter('signup')}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filleulFilter === 'signup' ? 'border-noya-blue/40 bg-noya-blue/10 text-noya-blue' : 'border-border-subtle text-text-secondary'}`}
                  >
                    Inscriptions
                  </button>
                </div>
              </div>

              {isLoadingLeads ? (
                <div className="flex justify-center py-24">
                  <div className="w-12 h-12 border-b-2 border-noya-blue rounded-full animate-spin" />
                </div>
              ) : filteredFilleulsRows.length === 0 ? (
                <div className="text-center py-24 bg-surface-primary rounded-3xl border border-border-subtle">
                  <Package size={48} className="mx-auto mb-4 text-text-dim opacity-20" />
                  <p className="text-text-secondary italic font-medium">Aucun contact parrainé pour le moment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="text-text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border-subtle pb-4">
                        <th className="px-4 py-4">Contact</th>
                        <th className="px-4 py-4">Structure / Domaine</th>
                        <th className="px-4 py-4">Date Intégration</th>
                        <th className="px-4 py-4 text-center">Badges</th>
                        <th className="px-4 py-4 text-right">Progression Dossier</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredFilleulsRows.map((row) => {
                        const isSignupOnly = row.source === 'signup';
                        return (
                          <Fragment key={row.id}>
                            <tr className="border-b border-border-subtle hover:bg-surface-primary transition-all">
                              <td className="px-4 py-4">
                                <div className="font-bold text-text-primary">{row.firstName} {row.lastName}</div>
                                <div className="text-[10px] text-text-muted font-medium italic mt-1">
                                  {row.email} • {row.phone}
                                  {isSignupOnly ? ' • inscrit via lien' : ''}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-text-primary font-bold text-xs uppercase tracking-tight">{row.companyName || '—'}</div>
                                <div className="text-[10px] text-text-secondary font-medium opacity-50 mt-1">{row.sector || 'Secteur non défini'}</div>
                              </td>
                              <td className="px-4 py-4 text-[10px] text-text-secondary font-mono">
                                {new Date(row.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-inner ${
                                  row.status === 'signe' || row.status === 'gagne'
                                    ? 'bg-noya-green/10 text-noya-green'
                                    : row.status === 'contacte' || row.status === 'en_demo' || row.status === 'proposition'
                                      ? 'bg-noya-blue/10 text-noya-blue'
                                      : row.status === 'perdu'
                                        ? 'bg-noya-red/10 text-noya-red'
                                        : 'bg-surface-tertiary text-text-secondary'
                                }`}>
                                  {toStatusLabel(row.status)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                {isSignupOnly ? (
                                  <span className="inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-noya-blue/10 text-noya-blue border border-noya-blue/20">
                                    Inscription détectée
                                  </span>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <select
                                      value={row.status || 'soumis'}
                                      disabled={isUpdatingLead === row.leadId}
                                      onChange={(e) => {
                                        if (!row.leadId) return;
                                        void handleUpdateLeadStatus(row.leadId, e.target.value);
                                      }}
                                      className="text-[10px] font-black uppercase tracking-widest bg-surface-primary border border-border-subtle rounded-lg px-3 py-2 focus:ring-1 focus:ring-noya-blue outline-none text-text-primary transition-all cursor-pointer hover:bg-surface-tertiary"
                                      title="Statut du lead"
                                    >
                                      {LEAD_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                      ))}
                                    </select>
                                    <div className="flex gap-2">
                                      <input 
                                        type="number"
                                        placeholder="Commission (FCFA)"
                                        value={row.commissionAmount || ''}
                                        onChange={(e) => {
                                          if (!row.leadId) return;
                                          void handleUpdateLeadCommission(row.leadId, Number(e.target.value));
                                        }}
                                        className="w-full text-[9px] bg-surface-primary border border-border-subtle rounded px-2 py-1 text-noya-green font-bold focus:border-noya-green/50 outline-none"
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {!isSignupOnly ? (
                              <tr className="border-b border-border-subtle">
                                <td colSpan={5} className="px-4 pb-4">
                                  <div className="flex items-start gap-4 bg-noya-blue/5 p-3 rounded-xl border border-noya-blue/10">
                                    <div className="shrink-0 p-1.5 bg-noya-blue/20 rounded-lg">
                                      <MessageSquare size={14} className="text-noya-blue" />
                                    </div>
                                    <textarea 
                                      placeholder="Note du Commando pour le partenaire (évolution du dossier)..."
                                      value={row.commandoNote || ''}
                                      onChange={(e) => {
                                        if (!row.leadId) return;
                                        void handleUpdateLeadNote(row.leadId, e.target.value);
                                      }}
                                      className="flex-1 bg-transparent text-xs text-text-secondary outline-none resize-none h-12 custom-scrollbar placeholder:text-text-muted"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
