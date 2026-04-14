import React, { useState, useEffect } from 'react';
import { Code, Plus, Mail, Phone, CheckCircle, Clock, X, Copy, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { createUserAsAdmin } from '../../utils/adminAuth';

interface DeveloperMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
}

export default function SuperAdminDevelopers() {
  const [developers, setDevelopers] = useState<DeveloperMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDev, setEditingDev] = useState<DeveloperMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newDev, setNewDev] = useState({ name: '', role: '', email: '', phone: '' });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'developer'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          role: data.jobTitle || 'Développeur',
          email: data.email,
          phone: data.phone || 'Non renseigné',
          status: 'Actif'
        };
      });
      setDevelopers(membersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching developers:", error);
      toast.error("Erreur lors du chargement des développeurs.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDev.name || !newDev.email) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // 1. Create user in Firebase Auth using secondary app
      const authResult = await createUserAsAdmin(newDev.email, undefined, 'developer');
      
      if (!authResult.success || !authResult.uid) {
        throw new Error(authResult.error || "Erreur lors de la création du compte.");
      }

      const nameParts = newDev.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // 2. Save user profile in Firestore (le mot de passe n'est jamais stocké)
      await setDoc(doc(db, 'users', authResult.uid), {
        uid: authResult.uid,
        email: newDev.email,
        firstName: firstName,
        lastName: lastName,
        phone: newDev.phone || null,
        role: 'developer',
        jobTitle: newDev.role || 'Développeur',
        createdAt: new Date().toISOString()
      });

      setGeneratedPassword(authResult.password);
      toast.success('Développeur ajouté avec succès.');
    } catch (error: any) {
      console.error("Error adding developer:", error);
      toast.error(error.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDev) return;
    
    setIsSubmitting(true);
    try {
      const nameParts = editingDev.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      await updateDoc(doc(db, 'users', editingDev.id), {
        firstName: firstName,
        lastName: lastName,
        phone: editingDev.phone || null,
        jobTitle: editingDev.role || 'Développeur',
      });

      toast.success('Développeur mis à jour.');
      setIsEditModalOpen(false);
      setEditingDev(null);
    } catch (error: any) {
      console.error("Error updating developer:", error);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDeveloper = async (devId: string, devName: string) => {
    if (!confirm(`Supprimer le développeur ${devName} ? Cette action supprimera son profil de la base de données.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', devId));
      toast.success('Développeur supprimé.');
    } catch (error) {
      console.error("Error deleting developer:", error);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const resetModal = () => {
    setNewDev({ name: '', role: '', email: '', phone: '' });
    setGeneratedPassword(null);
    setIsModalOpen(false);
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
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Équipe Développeurs</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Gestion des talents techniques et accès plateforme</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
        >
          <Plus size={18} />
          Nouveau Développeur
        </button>
      </div>

      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-3">
          <div className="p-2 bg-noya-blue/20 text-noya-blue rounded-lg">
            <Code size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Membres Actifs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">Développeur</th>
                <th className="p-4">Spécialité</th>
                <th className="p-4">Contact & Support</th>
                <th className="p-4">Badge</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {developers.map((dev) => (
                <tr key={dev.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                  <td className="p-4">
                    <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors leading-tight">{dev.name}</div>
                    <div className="text-[10px] text-text-secondary opacity-50 mt-1 font-mono">{dev.id.slice(0, 8)}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-surface-primary rounded text-[10px] font-black uppercase text-text-secondary border border-border-subtle">
                      {dev.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Mail size={12} className="text-noya-blue/50" /> {dev.email}
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary italic opacity-80 text-xs">
                        <Phone size={12} className="text-noya-blue/50" /> {dev.phone}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner ${
                      dev.status === 'Actif' ? 'bg-noya-green/10 text-noya-green' : 'bg-surface-tertiary text-text-secondary'
                    }`}>
                      {dev.status === 'Actif' ? <CheckCircle size={10} /> : <Clock size={10} />}
                      {dev.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingDev(dev);
                          setIsEditModalOpen(true);
                        }} 
                        className="p-2 transition-all text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                        title="Modifier"
                      >
                        <Edit2 size={16} className="group-hover/btn:scale-110 transition-all" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDeveloper(dev.id, dev.name)}
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

      {/* Modal Ajouter un développeur */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Nouveau Staff Technique</h2>
              <button 
                onClick={resetModal}
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
                    <p className="font-black uppercase tracking-tight text-sm">Accès créé avec succès</p>
                    <p className="text-xs mt-1 opacity-80 leading-relaxed italic">Transmettez ces codes de manière sécurisée au nouveau membre de l'équipe.</p>
                  </div>
                </div>
                
                <div className="space-y-4 bg-surface-primary p-6 rounded-2xl border border-border-subtle">
                  <div>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-2">Identifiant de connexion</p>
                    <p className="font-bold text-text-primary px-4 py-3 bg-surface-secondary rounded-xl border border-border-subtle">{newDev.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-2">Mot de passe temporaire</p>
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
                  onClick={resetModal}
                  className="w-full px-8 py-4 bg-noya-blue text-noya-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Terminer la configuration
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddDeveloper} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Prénom et Nom *</label>
                  <input 
                    type="text" 
                    required
                    value={newDev.name}
                    onChange={(e) => setNewDev({...newDev, name: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Expertise / Job Title</label>
                  <input 
                    type="text" 
                    value={newDev.role}
                    onChange={(e) => setNewDev({...newDev, role: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: Architecte Cloud"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Email Professionnel *</label>
                  <input 
                    type="email" 
                    required
                    value={newDev.email}
                    onChange={(e) => setNewDev({...newDev, email: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: technical.staff@infinite.com"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Contact Téléphonique</label>
                  <input 
                    type="tel" 
                    value={newDev.phone}
                    onChange={(e) => setNewDev({...newDev, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    placeholder="Ex: +225 00 00 00 00 00"
                  />
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={resetModal}
                    className="flex-1 px-6 py-3 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-all"
                  >
                    Annuler
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
      {/* Modal Modifier un développeur */}
      {isEditModalOpen && editingDev && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Édition Profil</h2>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingDev(null);
                }}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateDeveloper} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Prénom et Nom *</label>
                <input 
                  type="text" 
                  required
                  value={editingDev.name}
                  onChange={(e) => setEditingDev({...editingDev, name: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Spécialité</label>
                <input 
                  type="text" 
                  value={editingDev.role}
                  onChange={(e) => setEditingDev({...editingDev, role: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Téléphone</label>
                <input 
                  type="tel" 
                  value={editingDev.phone}
                  onChange={(e) => setEditingDev({...editingDev, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
