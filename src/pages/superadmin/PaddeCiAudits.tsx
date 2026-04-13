import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Eye, 
  X, 
  Phone, 
  Building, 
  User, 
  Search, 
  Filter,
  ArrowRight,
  ClipboardCheck,
  Globe,
  MessageSquare
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface PaddeAudit {
  id: string;
  clientName: string;
  serviceName: string;
  status: string;
  createdAt: string;
  amount?: string;
  details?: Record<string, any>;
}

export default function PaddeCiAudits() {
  const [audits, setAudits] = useState<PaddeAudit[]>([]);
  const [selected, setSelected] = useState<PaddeAudit | null>(null);
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('source', '==', 'padde-ci'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAudits(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaddeAudit)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    return () => unsubscribe();
  }, []);

  const handleValidate = async (audit: PaddeAudit) => {
    setIsValidating(audit.id);
    try {
      await updateDoc(doc(db, 'orders', audit.id), {
        status: 'Validé',
        validatedAt: new Date().toISOString()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: 'system',
        title: 'Audit PADDE-CI pris en charge',
        message: `L'audit pour "${audit.clientName}" a été validé et pris en charge par le SuperAdmin.`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Audit validé — Dossier transmis au commando.');
      setSelected(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      toast.error('Erreur lors de la validation.');
    } finally {
      setIsValidating(null);
    }
  };

  const auditTypeLabel = (serviceName: string) => {
    if (serviceName.includes('audit-rapide') || serviceName.includes('Rapide')) return 'Rapide';
    if (serviceName.includes('audit-business') || serviceName.includes('Business')) return 'Business';
    if (serviceName.includes('audit-institutionnel') || serviceName.includes('Institutionnel')) return 'Institutionnel';
    return serviceName.replace('Audit PADDE-CI: ', '');
  };

  const auditTypeBadge = (type: string) => {
    if (type === 'Rapide') return 'bg-noya-blue/10 text-noya-blue border-noya-blue/20';
    if (type === 'Business') return 'bg-noya-accent/10 text-noya-accent border-noya-accent/20';
    if (type === 'Institutionnel') return 'bg-noya-orange/10 text-noya-orange border-noya-orange/20';
    return 'bg-white/5 text-text-secondary border-white/10';
  };

  const filtered = audits.filter(a => 
    a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Audits PADDE-CI</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Extraction des flux de données provenant de padde-ci.com</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-noya-sidebar px-4 py-2 rounded-xl border border-white/5 shadow-sm flex items-center gap-3">
            <div className="w-2 h-2 bg-noya-green rounded-full shadow-[0_0_8px_rgba(43,198,115,0.8)]"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              {audits.filter(a => a.status === 'Validé').length} Intégrés
            </span>
          </div>
          <div className="bg-noya-sidebar px-4 py-2 rounded-xl border border-white/5 shadow-sm flex items-center gap-3">
            <div className="w-2 h-2 bg-noya-orange rounded-full shadow-[0_0_8px_rgba(255,179,50,0.8)]"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              {audits.filter(a => a.status !== 'Validé').length} En attente
            </span>
          </div>
        </div>
      </div>

      <div className="bg-noya-sidebar rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/50" size={18} />
            <input 
              type="text" 
              placeholder="Indexer par nom de client ou ID..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-noya-black/50 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-noya-blue opacity-50" />
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary italic">Source: padde-ci.com</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-noya-black/20 text-text-secondary/70 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                <th className="p-6">Index ID</th>
                <th className="p-6">Promoteur</th>
                <th className="p-6">Architecture d'Audit</th>
                <th className="p-6">Canal Contact</th>
                <th className="p-6">Date Transmission</th>
                <th className="p-6">Statut Flux</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <AnimatePresence mode="popLayout">
                {filtered.map((audit) => {
                  const type = auditTypeLabel(audit.serviceName);
                  return (
                    <motion.tr 
                      layout
                      key={audit.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-all group"
                    >
                      <td className="p-6">
                        <span className="font-mono text-[10px] font-black text-text-secondary/40 bg-noya-black/30 px-2 py-0.5 rounded border border-white/5 uppercase">
                          {audit.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors">{audit.clientName}</div>
                        <div className="text-[10px] text-text-secondary/40 mt-1 uppercase font-black tracking-tighter italic">Compte PADDE Origin</div>
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-inner ${auditTypeBadge(type)}`}>
                          {type}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2 text-text-secondary font-medium">
                          <MessageSquare size={12} className="text-noya-blue/50" />
                          {audit.details?.whatsapp || audit.details?.telephone || '—'}
                        </div>
                      </td>
                      <td className="p-6 text-[10px] text-text-secondary/60 font-mono">
                        {audit.createdAt ? new Date(audit.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        }) : '—'}
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-inner ${
                          audit.status === 'Validé' ? 'bg-noya-green/10 text-noya-green' : 'bg-noya-orange/10 text-noya-orange animate-pulse'
                        }`}>
                          {audit.status === 'Validé' ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {audit.status}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelected(audit)}
                            className="p-2.5 text-text-secondary/50 hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl transition-all group/btn"
                            title="Analyser les détails"
                          >
                            <Eye size={18} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                          {audit.status !== 'Validé' && (
                            <button
                              onClick={() => handleValidate(audit)}
                              disabled={isValidating === audit.id}
                              className="px-4 py-2 bg-white/5 text-text-primary border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-noya-blue hover:text-noya-black hover:border-noya-blue transition-all disabled:opacity-50"
                            >
                              {isValidating === audit.id ? (
                                <div className="w-3 h-3 border-2 border-noya-blue rounded-full animate-spin" />
                              ) : (
                                'Indexer'
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-text-secondary/20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 bg-white/5 rounded-full">
                        <AlertCircle size={48} className="opacity-20" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-widest italic leading-relaxed">
                        Aucun flux PADDE-CI détecté<br/>
                        <span className="text-[10px] lowercase font-medium opacity-50 italic">Les audits du site apparaîtront ici</span>
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-noya-sidebar rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-white/10 flex flex-col"
            >
              <div className="flex justify-between items-center p-8 border-b border-white/5 bg-white/5 shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">Analyse de Dossier Audit</h2>
                  <p className="text-[10px] text-text-secondary/50 font-mono tracking-widest mt-1">REF: {selected.id}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-noya-black/30 p-5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-text-secondary/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <User size={12} className="text-noya-blue" /> Promoteur Client
                    </p>
                    <p className="font-bold text-text-primary text-lg leading-none">{selected.clientName}</p>
                  </div>
                  <div className="bg-noya-black/30 p-5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-text-secondary/50 uppercase tracking-widest mb-3">Architecture Audit</p>
                    <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${auditTypeBadge(auditTypeLabel(selected.serviceName))}`}>
                      {auditTypeLabel(selected.serviceName)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {selected.details?.whatsapp && (
                    <div className="bg-noya-black/30 p-5 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-text-secondary/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Phone size={12} className="text-noya-green" /> Canal WhatsApp
                      </p>
                      <p className="font-bold text-text-primary">{selected.details.whatsapp}</p>
                    </div>
                  )}
                  {selected.details?.secteur && (
                    <div className="bg-noya-black/30 p-5 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-text-secondary/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Building size={12} className="text-noya-orange" /> Secteur d'Activité
                      </p>
                      <p className="font-bold text-text-primary uppercase text-sm tracking-tight">{selected.details.secteur}</p>
                    </div>
                  )}
                </div>

                {selected.details && Object.keys(selected.details).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] flex items-center gap-3">
                      Données Brutes du Formulaire <div className="h-px bg-white/5 flex-1" />
                    </h3>
                    <div className="bg-noya-black/20 rounded-2xl p-6 space-y-4 border border-white/5 max-h-60 overflow-y-auto shadow-inner">
                      {Object.entries(selected.details)
                        .filter(([, v]) => v !== null && v !== undefined && v !== '')
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between items-start text-xs border-b border-white/5 pb-3">
                            <span className="text-text-secondary/60 capitalize font-medium">{key.replace(/_/g, ' ')}</span>
                            <span className="text-text-primary font-bold text-right max-w-[60%] break-words">{String(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {selected.status !== 'Validé' && (
                  <button
                    onClick={() => handleValidate(selected)}
                    disabled={isValidating === selected.id}
                    className="w-full py-4 bg-noya-blue text-noya-black font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isValidating === selected.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-noya-black/30 border-t-noya-black rounded-full animate-spin" />
                        Indexation...
                      </>
                    ) : (
                      <>
                        <ClipboardCheck size={20} />
                        Valider et Transférer au Commando
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
