import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Download, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { paymentService, Payment } from '../../services/paymentService';
import { db } from '../../firebase';
import { collection, onSnapshot, query, setDoc, doc, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';

export default function Finance() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ clientId: '', description: '', amount: '' });

  useEffect(() => {
    const unsubscribe = paymentService.subscribeToAllPayments((data) => {
      setPayments(data);
      setLoading(false);
    });
    
    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'client')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeClients();
    };
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.clientId || !newInvoice.description || !newInvoice.amount) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    setIsSubmitting(true);
    try {
      const client = clients.find(c => c.id === newInvoice.clientId);
      const amount = parseFloat(newInvoice.amount);

      // 1. Create Payment
      const paymentId = `PAY-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      await setDoc(doc(db, 'payments', paymentId), {
        id: paymentId,
        amount,
        currency: 'XOF',
        status: 'succeeded',
        description: newInvoice.description,
        clientId: client.id,
        clientEmail: client.email,
        createdAt: new Date().toISOString()
      });

      // 2. Create an Order so it unlocks the module/service for the client
      const orderId = `ORD-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        serviceId: newInvoice.description.toLowerCase().replace(/\s+/g, '-'),
        serviceName: newInvoice.description,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email,
        amount,
        status: 'Validé',
        createdAt: new Date().toISOString()
      });

      toast.success('Prestation ajoutée et disponible pour le client !');
      setIsModalOpen(false);
      setNewInvoice({ clientId: '', description: '', amount: '' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création de la prestation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInvoiced = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalCollected = payments.filter(p => p.status === 'succeeded').reduce((acc, p) => acc + p.amount, 0);
  const totalExpenses = 0; // Updated to 0 per requirements
  const treasury = totalCollected - totalExpenses;
  
  const stats = [
    { name: 'CA Facturé', value: `${totalInvoiced.toLocaleString('fr-FR')} FCFA`, change: '+12%', trend: 'up', icon: Wallet },
    { name: 'Encaissé', value: `${totalCollected.toLocaleString('fr-FR')} FCFA`, change: '+8%', trend: 'up', icon: DollarSign },
    { name: 'Dépenses', value: `${totalExpenses.toLocaleString('fr-FR')} FCFA`, change: '0%', trend: 'down', icon: TrendingDown },
    { name: 'Trésorerie', value: `${treasury.toLocaleString('fr-FR')} FCFA`, change: '+15%', trend: 'up', icon: TrendingUp },
  ];

  const handleFilter = () => {
    toast.success('Filtres appliqués !');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Rapport Financier Infinite Core', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

    const tableData = payments.map(p => [
      p.id.substring(0, 8),
      p.description || 'Service',
      'Paiement',
      new Date(p.createdAt).toLocaleDateString('fr-FR'),
      `${p.amount.toLocaleString('fr-FR')} FCFA`,
      p.status === 'succeeded' ? 'Payé' : p.status === 'failed' ? 'Échoué' : 'En attente'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Description', 'Type', 'Date', 'Montant', 'Statut']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [13, 71, 161] } // Noya blue
    });

    doc.save('rapport_financier_noyacore.pdf');
    toast.success('Rapport PDF exporté avec succès !');
  };

  return (
    <div className="space-y-8 px-2 py-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">Flux Financiers</h1>
          <p className="text-text-secondary mt-1 font-medium italic">Centre de surveillance de la trésorerie et facturation</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-noya-green text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-noya-green/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} /> Nouvelle Prestation
          </button>
          <button 
            onClick={handleFilter}
            className="hidden sm:flex items-center gap-3 px-6 py-3 bg-surface-secondary border border-border-subtle text-text-primary rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-surface-tertiary transition-all shadow-sm"
          >
            <Filter size={18} /> Filtrer
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-3 px-6 py-3 bg-noya-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-noya-blue/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Download size={18} /> Exporter Rapport
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-surface-secondary overflow-hidden rounded-3xl shadow-sm border border-border-subtle p-7 hover:border-noya-blue/20 transition-all group">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-2xl bg-surface-tertiary border border-border-subtle shadow-inner group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-text-muted" />
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-inner tracking-widest ${stat.trend === 'up' ? 'bg-noya-green/10 text-noya-green border-noya-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                  {stat.change}
                </span>
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{stat.name}</p>
                <p className="mt-2 text-2xl font-black text-text-primary tracking-tight">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface-secondary rounded-3xl shadow-lg border border-border-subtle overflow-hidden">
        <div className="p-8 border-b border-border-subtle bg-surface-primary/30">
          <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Journal des Opérations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-tertiary/50 text-text-muted text-[10px] font-black uppercase tracking-[0.1em] border-b border-border-subtle">
                <th className="p-4 md:p-6 font-black hidden sm:table-cell">ID Flux</th>
                <th className="p-4 md:p-6 font-black">Désignation</th>
                <th className="p-4 md:p-6 font-black hidden lg:table-cell">Vecteur</th>
                <th className="p-4 md:p-6 font-black hidden md:table-cell">Horodatage</th>
                <th className="p-4 md:p-6 font-black text-right">Montant</th>
                <th className="p-4 md:p-6 font-black">Statut</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-muted font-black uppercase tracking-widest opacity-50">
                    Synchronisation du journal...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-muted font-black uppercase tracking-widest opacity-50">
                    Néant opérationnel.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle hover:bg-surface-tertiary transition-all group/row">
                    <td className="p-4 md:p-6 font-black text-text-primary font-mono uppercase tracking-widest opacity-80 group-hover/row:text-noya-blue transition-colors hidden sm:table-cell">{p.id.substring(0, 8)}</td>
                    <td className="p-4 md:p-6 text-text-secondary uppercase font-bold tracking-tight">{p.description || 'Service'}</td>
                    <td className="p-4 md:p-6 text-text-muted uppercase font-black text-[9px] tracking-widest hidden lg:table-cell">Virement Entrant</td>
                    <td className="p-4 md:p-6 text-text-muted font-bold font-mono uppercase hidden md:table-cell">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className={`p-4 md:p-6 font-black text-right text-sm tracking-tighter ${p.status === 'succeeded' ? 'text-noya-green' : 'text-red-500'}`}>
                      {p.amount.toLocaleString('fr-FR')} <span className="text-[9px] opacity-60">FCFA</span>
                    </td>
                    <td className="p-4 md:p-6">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-inner
                        ${p.status === 'succeeded' ? 'bg-noya-green/10 text-noya-green border-noya-green/20' : 
                          p.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-noya-orange/10 text-noya-orange border-noya-orange/20'}`}
                      >
                        {p.status === 'succeeded' ? 'Synchronisé' : p.status === 'failed' ? 'Rejeté' : 'Vérification'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Injection Flux Client</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Unité Client Cible *</label>
                  <select
                    required
                    value={newInvoice.clientId}
                    onChange={(e) => setNewInvoice({ ...newInvoice, clientId: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    <option value="">SCANNER LES UNITÉS...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} | {c.company || 'PARTICULIER'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Nature de la Prestation *</label>
                  <input
                    type="text" required
                    value={newInvoice.description}
                    onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                    placeholder="Ex: AUDIT INFRASTRUCTURE V.1"
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-bold uppercase text-[10px] tracking-widest transition-all placeholder:opacity-30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Charge Financière (FCFA) *</label>
                  <input
                    type="number" required min="0"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    placeholder="Ex: 250000"
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-black text-lg tracking-widest transition-all placeholder:opacity-30"
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
                    className="px-8 py-4 bg-noya-green text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-green/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Injection...
                      </>
                    ) : (
                      'Injecter & Synchroniser'
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
