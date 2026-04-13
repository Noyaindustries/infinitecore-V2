import React, { useState, useEffect, Fragment } from 'react';
import { Search, Filter, Edit2, Save, X, Plus, Mail, Phone, CheckCircle, Clock, Copy, Briefcase, Trash2, Users, ExternalLink, Package, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, setDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { createUserAsAdmin } from '../../utils/adminAuth';

interface PartnerMember {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  clients: number;
  commissionRate: number;
  status: string;
  partnerCode: string;
  generatedPassword?: string;
}

export default function SuperAdminPartners() {
  const [partners, setPartners] = useState<PartnerMember[]>([]);
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
  const [leads, setLeads] = useState<any[]>([]);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isUpdatingLead, setIsUpdatingLead] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'partner'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partnersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          company: data.companyName || 'Indépendant',
          email: data.email,
          phone: data.phone || 'Non renseigné',
          clients: data.referredClientsCount || 0,
          commissionRate: data.commissionRate || 10,
          status: 'Actif',
          partnerCode: data.partnerCode || `PART-${doc.id.substring(0, 5).toUpperCase()}`,
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

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.email) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const authResult = await createUserAsAdmin(newPartner.email);
      
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
        generatedPassword: authResult.password,
        createdAt: new Date().toISOString()
      });

      setGeneratedPassword(authResult.password);
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
    const q = query(collection(db, 'leads'), where('partnerId', '==', partner.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingLeads(false);
    }, (error) => {
      console.error(error);
      toast.error('Erreur lors du chargement des leads.');
      setIsLoadingLeads(false);
    });

    return unsubscribe;
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

  const resetModal = () => {
    setNewPartner({ name: '', company: '', email: '', phone: '' });
    setGeneratedPassword(null);
    setIsModalOpen(false);
  };

  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast.success('Mot de passe copié !');
    }
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                onClick={resetModal}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
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
                    <p className="text-sm mt-1">Veuillez transmettre ces informations de connexion au partenaire.</p>
                  </div>
                </div>
                
                <div className="space-y-4 bg-surface-primary p-4 rounded-lg border border-border-subtle">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Email de connexion</p>
                    <p className="font-bold text-text-primary">{newPartner.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Mot de passe généré</p>
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
                  onClick={resetModal}
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
                    onClick={resetModal}
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
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPartner(null);
                }}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
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
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Entreprise</label>
                <input 
                  type="text"
                  value={editingPartner.company}
                  onChange={(e) => setEditingPartner({...editingPartner, company: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
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
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Commission (%)</label>
                  <input 
                    type="number"
                    value={editingPartner.commissionRate}
                    onChange={(e) => setEditingPartner({...editingPartner, commissionRate: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-noya-orange font-bold"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
                <p className="text-xs text-text-secondary font-medium italic opacity-60">{leads.length} contacts parrainés identifiés</p>
              </div>
              <button 
                onClick={() => {
                  setIsLeadsModalOpen(false);
                  setSelectedPartner(null);
                  setLeads([]);
                }}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
              {isLoadingLeads ? (
                <div className="flex justify-center py-24">
                  <div className="w-12 h-12 border-b-2 border-noya-blue rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
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
                      {leads && leads.map((lead) => {
                        return (
                          <Fragment key={lead.id}>
                            <tr className="border-b border-border-subtle hover:bg-surface-primary transition-all">
                              <td className="px-4 py-4">
                                <div className="font-bold text-text-primary">{lead.firstName} {lead.lastName}</div>
                                <div className="text-[10px] text-text-muted font-medium italic mt-1">{lead.email} • {lead.phone}</div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-text-primary font-bold text-xs uppercase tracking-tight">{lead.companyName || '—'}</div>
                                <div className="text-[10px] text-text-secondary font-medium opacity-50 mt-1">{lead.sector || 'Secteur non défini'}</div>
                              </td>
                              <td className="px-4 py-4 text-[10px] text-text-secondary font-mono">
                                {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-inner ${
                                  lead.status === 'Signed' ? 'bg-noya-green/10 text-noya-green' : 
                                  lead.status === 'In Progress' ? 'bg-noya-blue/10 text-noya-blue' :
                                  lead.status === 'Lost' ? 'bg-noya-red/10 text-noya-red' : 'bg-surface-tertiary text-text-secondary'
                                }`}>
                                  {lead.status === 'Signed' ? 'Converti' : 
                                   lead.status === 'In Progress' ? 'En Phase' :
                                   lead.status === 'Lost' ? 'Terminé' : 'Potentiel'}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex flex-col gap-2">
                                  <select
                                    value={lead.status || 'soumis'}
                                    disabled={isUpdatingLead === lead.id}
                                    onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                    className="text-[10px] font-black uppercase tracking-widest bg-surface-primary border border-border-subtle rounded-lg px-3 py-2 focus:ring-1 focus:ring-noya-blue outline-none text-text-primary transition-all cursor-pointer hover:bg-surface-tertiary"
                                  >
                                    <option value="soumis">Soumis</option>
                                    <option value="contacte">Contacté</option>
                                    <option value="en_demo">En démo</option>
                                    <option value="proposition">Proposition</option>
                                    <option value="signe">Signé</option>
                                    <option value="gagne">Gagné 💰</option>
                                    <option value="perdu">Perdu</option>
                                  </select>
                                  <div className="flex gap-2">
                                    <input 
                                      type="number"
                                      placeholder="Commission (FCFA)"
                                      value={lead.commissionAmount || ''}
                                      onChange={(e) => updateDoc(doc(db, 'leads', lead.id), { commissionAmount: Number(e.target.value) })}
                                      className="w-full text-[9px] bg-surface-primary border border-border-subtle rounded px-2 py-1 text-noya-green font-bold focus:border-noya-green/50 outline-none"
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr className="border-b border-border-subtle">
                              <td colSpan={5} className="px-4 pb-4">
                                <div className="flex items-start gap-4 bg-noya-blue/5 p-3 rounded-xl border border-noya-blue/10">
                                  <div className="shrink-0 p-1.5 bg-noya-blue/20 rounded-lg">
                                    <MessageSquare size={14} className="text-noya-blue" />
                                  </div>
                                  <textarea 
                                    placeholder="Note du Commando pour le partenaire (évolution du dossier)..."
                                    value={lead.commandoNote || ''}
                                    onChange={(e) => updateDoc(doc(db, 'leads', lead.id), { commandoNote: e.target.value })}
                                    className="flex-1 bg-transparent text-xs text-text-secondary outline-none resize-none h-12 custom-scrollbar placeholder:text-text-muted"
                                  />
                                </div>
                              </td>
                            </tr>
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
