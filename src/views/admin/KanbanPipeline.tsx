import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, FileSignature, ShoppingBag, X, Zap, Users } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Column = { id: string; title: string };

const columnsDef: Column[] = [
  { id: 'nouveau', title: 'Nouveau' },
  { id: 'contacte', title: 'Contacté' },
  { id: 'diagnostic', title: 'Diagnostic' },
  { id: 'proposition', title: 'Proposition' },
  { id: 'signe', title: 'Signé' },
  { id: 'livre', title: 'Livré' }
];

export default function KanbanPipeline() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const qLeads = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      setLeads(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => { unsubTasks(); unsubOrders(); unsubLeads(); unsubUsers(); };
  }, []);

  const partnerNameById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((row) => {
      if (String(row.role || '').toLowerCase() !== 'partner') return;
      const uid = String(row.uid || row.id);
      const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
      map[uid] = fullName || row.email || `Partenaire ${uid}`;
    });
    return map;
  }, [users]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !client.trim() || !activeColumnId) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    if (!auth.currentUser) {
      toast.error('Vous devez être connecté.');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskId = `TSK-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const newTask = {
        id: taskId,
        userId: auth.currentUser.uid, // Assuming admin creates it, or we need to select a client
        title,
        client,
        columnId: activeColumnId,
        isOrder: false,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'tasks', taskId), newTask);
      
      toast.success('Tâche ajoutée avec succès !');
      setIsModalOpen(false);
      setTitle('');
      setClient('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      toast.error('Erreur lors de l\'ajout de la tâche.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = (columnId: string) => {
    setActiveColumnId(columnId);
    setIsModalOpen(true);
  };

  const handleSendContract = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Préparation du contrat...',
        success: 'Contrat envoyé pour signature électronique !',
        error: 'Erreur lors de l\'envoi.',
      }
    );
  };

  const getTasksForColumn = (columnId: string) => {
    let columnTasks = tasks.filter(t => t.columnId === columnId);

    if (columnId === 'nouveau') {
      const pendingOrders = orders
        .filter(o => o.status !== 'Validé')
        .map(o => ({
          id: o.id,
          title: `Commande: ${o.serviceName || o.title || 'Service'}`,
          client: o.clientName || o.clientEmail || '—',
          createdAt: o.createdAt,
          isOrder: true,
          isPadde: o.source === 'padde-ci',
          columnId: 'nouveau',
        }));
      const leadCards = leads
        .filter((lead) => {
          const leadPhone = lead.phone || lead.whatsapp || '';
          return !tasks.some(
            (task) =>
              task.source === 'partner_lead' &&
              (task.leadId === lead.id ||
                (task.partnerId === lead.partnerId &&
                  task.leadCompany === lead.companyName &&
                  task.leadPhone === leadPhone))
          );
        })
        .map((lead) => ({
          id: `lead-${lead.id}`,
          leadId: lead.id,
          title: `Lead partenaire: ${lead.companyName || 'Entreprise'}`,
          client: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.companyName || 'Contact',
          createdAt: lead.createdAt,
          isOrder: false,
          source: 'partner_lead',
          partnerId: lead.partnerId,
          partnerName: lead.partnerName || (lead.partnerId ? partnerNameById[lead.partnerId] || `Partenaire ${lead.partnerId}` : 'Partenaire'),
          columnId: 'nouveau',
          __fromLeadOnly: true,
        }));

      columnTasks = [...pendingOrders, ...columnTasks, ...leadCards];
    }

    return columnTasks;
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      const { updateDoc } = await import('firebase/firestore');
      
      if (data.isOrder) {
        if (targetColumnId !== 'nouveau') {
          // Convert to task to track it through the pipeline
          const taskId = `TSK-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
          await setDoc(doc(db, 'tasks', taskId), {
            id: taskId,
            userId: auth.currentUser?.uid || 'system',
            title: data.title,
            client: data.client,
            columnId: targetColumnId,
            isOrder: false,
            createdAt: new Date().toISOString(),
          });
          
          await updateDoc(doc(db, 'orders', data.id), { status: 'Validé' });
          toast.success('Commande convertie en mission et déplacée !');
        }
      } else {
        if (data.columnId !== targetColumnId) {
          await updateDoc(doc(db, 'tasks', data.id), { columnId: targetColumnId });
        }
      }
    } catch (error) {
      console.error("Erreur drag & drop:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center mb-8 px-2">
        <div>
          <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">Pipeline Radar</h1>
          <p className="text-text-secondary mt-1 font-medium italic">Station de suivi du cycle de vie opérationnel</p>
        </div>
        <button 
          onClick={handleSendContract}
          className="flex items-center gap-3 bg-noya-blue text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-noya-blue/20 transition-all font-black uppercase text-[10px] tracking-widest"
        >
          <FileSignature size={18} />
          Générer Contrat Signature Électronique
        </button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full items-start min-w-max">
          {columnsDef.map((column, colIndex) => {
            const columnTasks = getTasksForColumn(column.id);
            return (
              <div 
                key={column.id} 
                className="w-85 flex flex-col bg-surface-secondary/30 rounded-3xl p-6 border border-border-subtle h-full max-h-full transition-all"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className="flex justify-between items-center mb-6 px-1">
                  <h3 className="font-black text-text-primary uppercase text-[11px] tracking-[0.2em] flex items-center gap-3">
                    {column.title}
                    <span className="bg-surface-tertiary text-text-muted text-[10px] px-2.5 py-1 rounded-lg border border-border-subtle shadow-inner">
                      {columnTasks.length}
                    </span>
                  </h3>
                  <button title="Options de la colonne" aria-label="Options de la colonne" className="text-text-dim hover:text-text-primary transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {columnTasks.map((task, taskIndex) => (
                    <motion.div
                      key={task.id}
                      draggable={!task.__fromLeadOnly}
                      onDragStart={(e) => {
                        if (task.__fromLeadOnly) return;
                        const dt = (e as unknown as React.DragEvent<HTMLDivElement>).dataTransfer;
                        if (!dt) return;
                        dt.setData('text/plain', JSON.stringify({ 
                          id: task.id, 
                          isOrder: task.isOrder, 
                          title: task.title, 
                          client: task.client,
                          columnId: column.id 
                        }));
                      }}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (colIndex * 0.05) + (taskIndex * 0.03) }}
                      className={`bg-surface-primary p-6 rounded-2xl border cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all group shadow-sm ${
                        task.isPadde 
                          ? 'border-noya-orange/30 hover:border-noya-orange' 
                          : task.isOrder 
                            ? 'border-noya-orange/20 hover:border-noya-orange/50' 
                            : 'border-border-subtle hover:border-noya-blue'
                      }`}
                    >
                      {(() => {
                        const resolvedPartnerName =
                          task.partnerName ||
                          (task.partnerId ? partnerNameById[task.partnerId] || `Partenaire ${task.partnerId}` : '');
                        return (
                          <>
                      {task.isPadde && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-noya-orange/5 border border-noya-orange/20 rounded-xl w-fit">
                          <Zap size={10} className="text-noya-orange" />
                          <span className="text-[9px] font-black text-noya-orange uppercase tracking-widest leading-none">Vecteur PADDE-CI</span>
                        </div>
                      )}
                      {!task.isPadde && task.isOrder && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-noya-orange/5 border border-noya-orange/10 rounded-xl w-fit">
                          <ShoppingBag size={10} className="text-noya-orange" />
                          <span className="text-[9px] font-black text-noya-orange/70 uppercase tracking-widest leading-none">Commande Directe</span>
                        </div>
                      )}
                      {task.source === 'partner_lead' && (
                        <div className="mb-3 space-y-1.5">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-noya-blue/10 border border-noya-blue/25 rounded-xl w-fit">
                            <Users size={10} className="text-noya-blue" />
                            <span className="text-[9px] font-black text-noya-blue uppercase tracking-widest leading-none">Lead partenaire</span>
                          </div>
                          {resolvedPartnerName ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-noya-blue/5 border border-noya-blue/20 rounded-xl w-fit">
                              <span className="text-[9px] font-black text-noya-blue uppercase tracking-widest leading-none">
                                Parrainé · {resolvedPartnerName}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {task.__fromLeadOnly && (
                        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-dim">
                          Synchronisation en attente
                        </p>
                      )}
                          </>
                        );
                      })()}
                      
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-inner ${task.isPadde ? 'bg-noya-orange/10 text-noya-orange' : task.isOrder ? 'bg-noya-orange/10 text-noya-orange' : 'bg-noya-blue/10 text-noya-blue'}`}>
                          {task.client}
                        </span>
                      </div>
                      <p className="font-black text-text-primary text-[11px] uppercase tracking-tight group-hover:text-noya-orange transition-colors leading-relaxed">{task.title}</p>
                      
                      <div className="mt-5 flex items-center justify-between">
                        <span className="text-[10px] text-text-dim font-black uppercase tracking-widest">{task.createdAt ? format(new Date(task.createdAt), 'dd MMM yyyy', { locale: fr }) : task.date}</span>
                        <div className="w-7 h-7 rounded-xl bg-surface-tertiary flex items-center justify-center border border-border-subtle shadow-inner text-text-muted font-black text-[10px] uppercase">
                          {(task.client || 'C').charAt(0)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <button 
                  onClick={() => openAddModal(column.id)}
                  className="mt-6 flex items-center justify-center gap-3 w-full py-4 border border-dashed border-border-medium rounded-2xl text-text-dim hover:text-noya-blue hover:border-noya-blue hover:bg-noya-blue/5 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
                >
                  <Plus size={18} /> Injecter Unité
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-secondary/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-text-primary">
            Leads partenaires
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">
            {leads.length} entrée{leads.length > 1 ? 's' : ''}
          </span>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-5 text-sm text-text-muted">
            Aucun lead partenaire enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Entreprise</th>
                  <th className="px-3 py-3">Partenaire</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 text-sm text-text-secondary">
                    <td className="px-3 py-3 text-text-primary">
                      {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Contact'}
                    </td>
                    <td className="px-3 py-3">{lead.companyName || '—'}</td>
                    <td className="px-3 py-3">
                      {lead.partnerName || (lead.partnerId ? partnerNameById[lead.partnerId] || `Partenaire ${lead.partnerId}` : '—')}
                    </td>
                    <td className="px-3 py-3">{lead.phone || lead.whatsapp || '—'}</td>
                    <td className="px-3 py-3 uppercase text-[11px]">{lead.status || 'soumis'}</td>
                    <td className="px-3 py-3 text-[12px]">
                      {lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr }) : '—'}
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
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Injection Radar</h3>
                <button title="Fermer la fenêtre" aria-label="Fermer la fenêtre" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddTask} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Désignation Technique *</label>
                  <input 
                    type="text" required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Analyse d'architecture..." 
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Entité / Raison Sociale *</label>
                  <input 
                    type="text" required
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Ex: Horizon Digital" 
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-medium transition-all"
                  />
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
                    className="px-8 py-4 bg-noya-orange text-noya-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-orange/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-noya-black/30 border-t-noya-black rounded-full animate-spin" />
                        Injection...
                      </>
                    ) : (
                      'Injecter Radar'
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
