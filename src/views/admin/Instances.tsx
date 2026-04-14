import React, { useState, useEffect } from 'react';
import { Copy, Plus, Play, Pause, Settings, ExternalLink, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

interface Instance {
  id: string;
  name: string;
  type: string;
  url: string;
  status: string;
  clients: number;
  version: string;
  createdAt: string;
}

export default function Instances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInstance, setNewInstance] = useState({ name: '', type: '' });
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'instances'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setInstances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Instance)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstance.name || !newInstance.type) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = `INST-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const instance: Instance = {
        id,
        name: newInstance.name,
        type: newInstance.type,
        url: `${newInstance.name.toLowerCase().replace(/\s+/g, '')}.infinite-core.com`,
        status: 'Actif',
        clients: 0,
        version: 'v2.1.0',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'instances', id), instance);
      toast.success('Instance déployée avec succès !');
      setIsModalOpen(false);
      setNewInstance({ name: '', type: '' });
    } catch {
      toast.error('Erreur lors du déploiement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async (instance: Instance) => {
    setIsSubmitting(true);
    try {
      const id = `INST-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const duplicated: Instance = {
        ...instance,
        id,
        name: `${instance.name} (Copie)`,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'instances', id), duplicated);
      toast.success('Instance dupliquée avec succès !');
    } catch {
      toast.error('Erreur lors de la duplication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInstance) return;

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'instances', editingInstance.id), editingInstance);
      toast.success('Instance mise à jour !');
      setIsEditModalOpen(false);
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer l'instance "${name}" ?`)) return;
    try {
      await deleteDoc(doc(db, 'instances', id));
      toast.success('Instance supprimée.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const openModal = (type?: string) => {
    setNewInstance({ name: '', type: type || '' });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 px-2 py-4">
      <div className="flex justify-between items-center px-2">
        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">Vecteurs Multi-Secteurs</h1>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-3 px-6 py-3 bg-noya-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-noya-blue/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={18} /> Déployer Vecteur
        </button>
      </div>

      <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden p-8 mb-8">
        <h2 className="text-lg font-black text-text-primary uppercase tracking-tight mb-4">Déploiement Automatisé</h2>
        <p className="text-text-secondary font-medium italic mb-6 leading-relaxed">Les structures opérationnelles et les modules PADDE-CI sont instanciés de manière autonome dès la validation des protocoles de paiement.</p>
        <div className="bg-noya-blue/5 border border-noya-blue/20 p-4 rounded-2xl flex items-center gap-4 transition-all hover:bg-noya-blue/10 shadow-inner">
          <div className="p-2 bg-noya-blue/10 rounded-xl text-noya-blue">
            <Copy size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-noya-blue">Architecture Zero-Touch : Aucune intervention manuelle requise sur le noyau.</p>
        </div>
      </div>

      <div className="bg-surface-secondary rounded-3xl shadow-lg border border-border-subtle overflow-hidden">
        <div className="p-8 border-b border-border-subtle bg-surface-primary/30">
          <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Infrastructures Déployées</h2>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-noya-blue/30 border-t-noya-blue rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim">Scan des vecteurs...</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="p-20 text-center text-text-muted font-black uppercase tracking-[0.3em] opacity-30">
            Néant opérationnel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-tertiary/50 text-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-border-subtle">
                  <th className="p-6 font-black">Identité / Version</th>
                  <th className="p-6 font-black">Secteur Stratégique</th>
                  <th className="p-6 font-black">Coordonnées (URL)</th>
                  <th className="p-6 font-black">État</th>
                  <th className="p-6 font-black">Cohorte (Clients)</th>
                  <th className="p-6 font-black text-right">Commandes</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {instances.map((instance) => (
                  <tr key={instance.id} className="border-b border-border-subtle hover:bg-surface-tertiary transition-all group/row">
                    <td className="p-6">
                      <div className="font-black text-text-primary uppercase tracking-tight group-hover/row:text-noya-blue transition-colors">{instance.name}</div>
                      <div className="text-text-dim text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">{instance.id} · {instance.version}</div>
                    </td>
                    <td className="p-6">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-surface-tertiary rounded-lg border border-border-subtle shadow-inner text-text-secondary">
                        {instance.type}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-noya-blue font-bold tracking-tight flex items-center gap-2 hover:underline cursor-pointer group/link">
                        {instance.url} <ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center w-fit gap-2 border shadow-inner
                        ${instance.status === 'Actif' ? 'bg-noya-green/10 text-noya-green border-noya-green/20' : 'bg-noya-orange/10 text-noya-orange border-noya-orange/20'}`}
                      >
                        {instance.status === 'Actif' ? <Play size={10} className="fill-current" /> : <Pause size={10} className="fill-current" />}
                        {instance.status}
                      </span>
                    </td>
                    <td className="p-6 font-black font-mono text-text-secondary text-sm opacity-80">{instance.clients}</td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDuplicate(instance)}
                          className="p-3 bg-surface-tertiary border border-border-subtle text-text-muted rounded-xl hover:text-noya-blue hover:border-noya-blue/30 transition-all shadow-sm"
                          title="Dupliquer"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingInstance(instance);
                            setIsEditModalOpen(true);
                          }}
                          className="p-3 bg-surface-tertiary border border-border-subtle text-text-muted rounded-xl hover:text-text-primary hover:border-text-primary/30 transition-all shadow-sm"
                          title="Paramètres"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id, instance.name)}
                          className="p-3 bg-surface-tertiary border border-border-subtle text-text-muted rounded-xl hover:text-red-500 hover:border-red-500/30 transition-all shadow-sm"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Déploiement Vecteur</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateInstance} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Dénomination du Vecteur *</label>
                  <input
                    type="text" required
                    value={newInstance.name}
                    onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })}
                    placeholder="Ex: NOYA-SANTÉ"
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Pôle Stratégique *</label>
                  <select
                    required
                    value={newInstance.type}
                    onChange={(e) => setNewInstance({ ...newInstance, type: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    <option value="">SCANNER LES PÔLES...</option>
                    <option value="Immobilier">Immobilier</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Santé">Santé</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-4 bg-noya-blue text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-blue/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Compilation...
                      </>
                    ) : (
                      'Lancer Déploiement'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && editingInstance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Paramètres Vecteur</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateInstance} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Libellé d'Instance *</label>
                  <input
                    type="text" required
                    value={editingInstance.name}
                    onChange={(e) => setEditingInstance({ ...editingInstance, name: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Pôle Stratégique *</label>
                  <select
                    required
                    value={editingInstance.type}
                    onChange={(e) => setEditingInstance({ ...editingInstance, type: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    <option value="Immobilier">Immobilier</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Santé">Santé</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">État Opérationnel *</label>
                  <select
                    required
                    value={editingInstance.status}
                    onChange={(e) => setEditingInstance({ ...editingInstance, status: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    <option value="Actif">Actif</option>
                    <option value="Inactif">Inactif</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-4 bg-noya-blue text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-blue/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isSubmitting ? 'Synchronisation...' : 'Enregistrer'}
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
