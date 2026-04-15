import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Mail, Phone, CheckCircle, Clock, X, Copy, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, setDoc, doc, deleteDoc, updateDoc } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { createUserAsAdmin } from '../../utils/adminAuth';

interface CommandoMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  generatedPassword?: string;
}

export default function SuperAdminCommando() {
  const [team, setTeam] = useState<CommandoMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', role: '', email: '', phone: '' });
  const [editingMember, setEditingMember] = useState<CommandoMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'commando'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          role: data.jobTitle || 'Commando',
          email: data.email,
          phone: data.phone || 'Non renseigné',
          status: 'Actif',
          generatedPassword: data.generatedPassword
        };
      });
      setTeam(membersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching commando team:", error);
      toast.error("Erreur lors du chargement de l'équipe.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // 1. Création du compte via l’API admin
      const authResult = await createUserAsAdmin(newMember.email, undefined, 'commando');
      
      if (!authResult.success || !authResult.uid) {
        throw new Error(authResult.error || "Erreur lors de la création du compte.");
      }

      const nameParts = newMember.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // 2. Profil utilisateur (documents MongoDB)
      await setDoc(doc(db, 'users', authResult.uid), {
        uid: authResult.uid,
        email: newMember.email,
        firstName: firstName,
        lastName: lastName,
        phone: newMember.phone || null,
        role: 'commando',
        jobTitle: newMember.role || 'Commando',
        createdAt: new Date().toISOString()
      });

      setGeneratedPassword(authResult.invitationSent ? "Invitation envoyée par email" : "Invitation non envoyée");
      toast.success('Membre ajouté avec succès.');
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast.error(error.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    
    setIsSubmitting(true);
    try {
      const nameParts = editingMember.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      await updateDoc(doc(db, 'users', editingMember.id), {
        firstName: firstName,
        lastName: lastName,
        phone: editingMember.phone || null,
        jobTitle: editingMember.role || 'Commando',
      });

      toast.success('Membre mis à jour.');
      setIsEditModalOpen(false);
      setEditingMember(null);
    } catch (error: any) {
      console.error("Error updating member:", error);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Supprimer le membre ${name} ? Cette action supprimera son profil de la base de données.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Membre supprimé.');
    } catch (error) {
      console.error("Error deleting member:", error);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const resetModal = () => {
    setNewMember({ name: '', role: '', email: '', phone: '' });
    setGeneratedPassword(null);
    setIsModalOpen(false);
  };

  const closeAddModal = (force = false) => {
    if (isSubmitting) return;
    const hasDraft =
      !generatedPassword &&
      (newMember.name.trim().length > 0 ||
        newMember.role.trim().length > 0 ||
        newMember.email.trim().length > 0 ||
        newMember.phone.trim().length > 0);
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
    if (editingMember) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les modifications non enregistrées seront perdues.'
      );
      if (!confirmed) return;
    }
    setIsEditModalOpen(false);
    setEditingMember(null);
  };

  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast.success('Mot de passe copié !');
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Équipe Commando</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Forces spéciales de gestion et exécution opérationnelle</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
        >
          <Plus size={18} />
          Nouveau Commando
        </button>
      </div>

      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-3">
          <div className="p-2 bg-noya-blue/20 text-noya-blue rounded-lg">
            <ShieldAlert size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">État Major Actif</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">Identité</th>
                <th className="p-4">Rang / Fonction</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Accès Système</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {team.map((member) => (
                <tr key={member.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                  <td className="p-4">
                    <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors leading-tight">{member.name}</div>
                    <div className="text-[10px] text-text-secondary opacity-50 mt-1 font-mono">{member.id.slice(0, 8)}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-surface-primary rounded text-[10px] font-black uppercase text-text-secondary border border-border-subtle">
                      {member.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Mail size={12} className="text-noya-blue/50" /> {member.email}
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Phone size={12} className="text-noya-blue/50" /> {member.phone}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {member.generatedPassword ? (
                      <div className="flex items-center gap-2 bg-surface-primary w-fit px-3 py-1.5 rounded-lg border border-border-subtle">
                        <code className="text-[10px] text-noya-blue font-bold tracking-widest">
                          {member.generatedPassword}
                        </code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(member.generatedPassword || '');
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
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner ${
                      member.status === 'Actif' ? 'bg-noya-green/10 text-noya-green' : 'bg-surface-tertiary text-text-secondary'
                    }`}>
                      {member.status === 'Actif' ? <CheckCircle size={10} /> : <Clock size={10} />}
                      {member.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingMember(member);
                          setIsEditModalOpen(true);
                        }} 
                        className="p-2 transition-all text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                        title="Modifier"
                      >
                        <Edit2 size={16} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                      <button 
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        className="p-2 transition-all text-text-muted hover:text-noya-red hover:bg-noya-red/10 rounded-xl group/btn"
                        title="Supprimer"
                      >
                        <Trash2 size={16} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajouter un membre */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Recrutement Commando</h2>
              <button 
                onClick={() => closeAddModal()}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            
            {generatedPassword ? (
              <div className="p-8 space-y-6">
                <div className="bg-noya-green/10 text-noya-green p-6 rounded-2xl flex items-start gap-4 border border-noya-green/20">
                  <CheckCircle className="shrink-0 mt-0.5" size={24} />
                  <div>
                    <p className="font-black uppercase tracking-tight text-sm">Action Accomplie</p>
                    <p className="text-xs mt-1 opacity-80 leading-relaxed italic">Nouveau profil opérationnel. Le compte est activable via email de réinitialisation.</p>
                  </div>
                </div>
                
                <div className="space-y-4 bg-surface-primary p-6 rounded-2xl border border-border-subtle">
                  <div>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-2">Canal de connexion (Email)</p>
                    <p className="font-bold text-text-primary px-4 py-3 bg-surface-secondary rounded-xl border border-border-subtle">{newMember.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-2">Statut de l’invitation</p>
                    <div className="flex items-center justify-between bg-surface-secondary px-4 py-3 rounded-xl border border-border-subtle">
                      <code className="font-mono text-noya-blue text-sm font-bold tracking-widest">{generatedPassword}</code>
                      <button 
                        onClick={copyPassword}
                        className="p-2 text-text-muted hover:text-noya-blue transition-all"
                        title="Copier"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => closeAddModal(true)}
                  className="w-full px-8 py-4 bg-noya-blue text-noya-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Confirmer le déploiement
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Identité Complète *</label>
                  <input 
                    type="text" 
                    required
                    value={newMember.name}
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Alice Martin"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Grade / Fonction</label>
                  <input 
                    type="text" 
                    value={newMember.role}
                    onChange={(e) => setNewMember({...newMember, role: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Chef de Projet Senior"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Email Opérationnel *</label>
                  <input 
                    type="email" 
                    required
                    value={newMember.email}
                    onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: ops@infinite.com"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Contact Chiffré</label>
                  <input 
                    type="tel" 
                    value={newMember.phone}
                    onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: +225 00 00 00 00 00"
                  />
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => closeAddModal()}
                    className="flex-1 px-6 py-3 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-all"
                  >
                    Avorter
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting ? 'Pulsation...' : 'Déployer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Modal Modifier un membre */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Édition Accréditation</h2>
              <button 
                onClick={closeEditModal}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateMember} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Identité Complète *</label>
                <input 
                  type="text" 
                  required
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({...editingMember, name: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Rang / Fonction</label>
                <input 
                  type="text" 
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({...editingMember, role: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Contact</label>
                <input 
                  type="tel" 
                  value={editingMember.phone}
                  onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-6 py-3 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Pulsation...' : 'Actualiser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
