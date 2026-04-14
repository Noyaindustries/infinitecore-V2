import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  CreditCard, 
  Download, 
  FileText, 
  Send, 
  TrendingUp, 
  Search, 
  Filter, 
  MoreVertical,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { generateInvoicePDF, InvoiceData } from '../../utils/invoiceGenerator';

export default function SuperAdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, []);

  const handleValidate = async (orderId: string, userId: string, serviceName: string) => {
    setIsValidating(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'Validé',
        validatedAt: new Date().toISOString()
      });

      // Create a notification for the user
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId,
        title: 'Commande validée',
        message: `Votre commande pour "${serviceName}" a été validée par l'administrateur. Accès en cours de génération.`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Paiement confirmé et Commande validée !');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      toast.error('Erreur lors de la validation.');
    } finally {
      setIsValidating(null);
    }
  };

  const handleDownloadInvoice = async (order: any) => {
    try {
      // Fetch full client info from users collection if needed for address
      let clientAddress = '';
      let clientPhone = '';
      
      const userDoc = await getDoc(doc(db, 'users', order.userId));
      if (userDoc.exists()) {
        const profile = userDoc.data() as Record<string, unknown> | null | undefined;
        if (profile) {
          clientAddress = typeof profile.address === "string" ? profile.address : "";
          clientPhone = typeof profile.phone === "string" ? profile.phone : "";
        }
      }

      const invoiceData: InvoiceData = {
        id: order.id,
        clientName: order.clientName,
        clientEmail: order.clientEmail,
        clientPhone: clientPhone || order.clientPhone,
        clientAddress: clientAddress,
        serviceName: order.serviceName,
        amount: order.amount || 0,
        status: order.status || 'Payé',
        createdAt: order.createdAt
      };

      const success = generateInvoicePDF(invoiceData);
      if (success) {
        toast.success('Facture PDF générée !');
      } else {
        throw new Error('PDF generation failed');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération du document.');
    }
  };

  const handleSendInvoice = async (order: any) => {
    setIsSending(order.id);
    try {
      // Simulation of a backend process sending an email
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update order status/metadata if needed
      await updateDoc(doc(db, 'orders', order.id), {
        invoiceSentAt: new Date().toISOString()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: order.userId,
        title: 'Facture disponible',
        message: `Votre commande "${order.serviceName}" est validée. La facture officielle sera établie par l’équipe Infinite Core et transmise sur les canaux convenus (e-mail ou espace client).`,
        type: 'billing',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Facture envoyée au client et archivée pour le commando !');
    } catch (error) {
      toast.error('Erreur lors de la transmission.');
    } finally {
      setIsSending(null);
    }
  };

  const filtered = orders.filter(o => {
    const matchesSearch = (o.clientName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (o.serviceName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          o.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'valid' && o.status === 'Validé') ||
                         (filterStatus === 'pending' && o.status !== 'Validé');
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingCount = orders.filter(o => o.status !== 'Validé').length;

  return (
    <div className="space-y-8 min-h-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Poste de Facturation</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Contrôle des flux monétaires et gestion des pièces comptables</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-surface-secondary px-6 py-4 rounded-2xl border border-border-subtle shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-noya-green/10 rounded-xl flex items-center justify-center text-noya-green">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest leading-none mb-1">Total ARR</p>
              <p className="text-xl font-black text-text-primary">{totalRevenue.toLocaleString()} <span className="text-xs opacity-50">FCFA</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Indexer par ID, Client ou Service..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary focus:ring-2 focus:ring-noya-blue outline-none cursor-pointer"
            >
              <option value="all">Tout Statut</option>
              <option value="pending">En attente ({pendingCount})</option>
              <option value="valid">Validés</option>
            </select>
            <button className="px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-text-secondary hover:text-text-primary transition-all flex items-center gap-2">
              <Filter size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{filtered.length} Résultat(s)</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-secondary rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-primary/50 text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-6">Référence / Date</th>
                <th className="p-6">Client & Module</th>
                <th className="p-6 text-right">Montant Collecté</th>
                <th className="p-6">Badge Validité</th>
                <th className="p-6 text-right">Actions Comptables</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <AnimatePresence mode="popLayout">
                {filtered.map((order) => (
                  <motion.tr 
                    layout
                    key={order.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-border-subtle hover:bg-surface-primary transition-all group"
                  >
                    <td className="p-6">
                      <div className="font-mono text-[10px] text-noya-blue font-black tracking-widest bg-noya-blue/5 px-2 py-1 rounded inline-block mb-1.5 border border-noya-blue/10 uppercase">
                        {order.id.substring(0, 12)}
                      </div>
                      <div className="flex items-center gap-2 text-text-dim text-[10px] font-medium">
                        <Clock size={10} />
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : '-'}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors text-base">{order.clientName || 'Inconnu'}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="p-1 px-1.5 bg-surface-primary text-text-muted rounded text-[8px] font-black uppercase tracking-widest border border-border-subtle">Module:</span>
                        <span className="text-xs text-text-secondary font-medium">{order.serviceName}</span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-text-primary tracking-tighter">
                          {order.amount ? order.amount.toLocaleString() : '0'}
                          <span className="text-[10px] ml-1 opacity-50">FCFA</span>
                        </span>
                        <div className="flex items-center gap-1 text-[9px] text-noya-green font-black uppercase tracking-widest mt-1 opacity-80">
                          <ShieldCheck size={10} /> Sécurisé
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-inner ${
                        order.status === 'Validé' 
                          ? 'bg-noya-green/10 text-noya-green border border-noya-green/20' 
                          : 'bg-surface-tertiary text-text-muted border border-border-subtle animate-pulse'
                      }`}>
                        {order.status === 'Validé' ? <CheckCircle size={12} /> : <Zap size={12} />}
                        {order.status || 'En attente'}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-end gap-3">
                        {order.status !== 'Validé' ? (
                          <button
                            onClick={() => handleValidate(order.id, order.userId, order.serviceName)}
                            disabled={isValidating === order.id}
                            className="bg-noya-blue text-noya-black px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                          >
                            {isValidating === order.id ? (
                              <div className="w-3 h-3 border-2 border-noya-black/30 border-t-noya-black rounded-full animate-spin" />
                            ) : (
                              <>Confirmer Paiement</>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadInvoice(order)}
                              className="p-2.5 bg-surface-primary text-text-secondary hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl transition-all border border-border-subtle group/btn"
                              title="Générer Facture PDF"
                            >
                              <FileText size={18} className="group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => handleSendInvoice(order)}
                              disabled={isSending === order.id}
                              className="p-2.5 bg-surface-primary text-text-secondary hover:text-noya-orange hover:bg-noya-orange/10 rounded-xl transition-all border border-border-subtle group/btn"
                              title="Expédier au Client"
                            >
                              {isSending === order.id ? (
                                <div className="w-4 h-4 border-2 border-noya-orange/30 border-t-noya-orange rounded-full animate-spin" />
                              ) : (
                                <Send size={18} className="group-hover/btn:scale-110 transition-transform" />
                              )}
                            </button>
                            <div className="h-6 w-px bg-border-subtle mx-1" />
                            <button className="p-2.5 text-text-dim hover:text-text-primary transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-text-dim">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 bg-surface-tertiary rounded-full">
                        <AlertCircle size={48} className="opacity-20" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-widest italic">Aucun flux financier détecté</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
