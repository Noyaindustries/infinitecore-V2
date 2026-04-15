import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Filter,
  FileText,
  Settings,
  Eye,
  Plus,
  X,
  Pencil,
  ChevronLeft,
  User,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentService, Payment, resolveFactureEtape, type FactureEtape } from '../../services/paymentService';
import { db } from '@/lib/clientSdk';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  query,
  where,
  limit,
  getDocs,
  deleteField,
} from '@/lib/mongoFirestore';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type InvoicePdfSettings,
  type InvoicePaymentInput,
  loadInvoiceSettings,
  saveInvoiceSettings,
  downloadInvoicePdf,
  openInvoicePdfPreview,
  DEFAULT_INVOICE_SETTINGS,
} from '../../lib/invoicePdf';
import {
  subscribeRemoteInvoiceSettings,
  persistRemoteInvoiceSettings,
  ensurePaymentInvoiceNumber,
} from '../../services/invoiceAdminConfig';

const emptyPrestationForm = () => ({ clientId: '', title: '', amount: '' });

function parseAmountFcfa(raw: string): number {
  const n = Number.parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
}

function toServiceSlug(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s.slice(0, 80) || 'prestation';
}

export default function Finance() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prestationEdit, setPrestationEdit] = useState<Payment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prestationForm, setPrestationForm] = useState(emptyPrestationForm);
  const [prestationCreateStep, setPrestationCreateStep] = useState<1 | 2>(1);
  const [clientFilter, setClientFilter] = useState('');
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [mergedInvoiceSettings, setMergedInvoiceSettings] = useState<InvoicePdfSettings>(() => loadInvoiceSettings());
  const [invoiceDraft, setInvoiceDraft] = useState<InvoicePdfSettings>(() => loadInvoiceSettings());
  const [addressText, setAddressText] = useState(() => loadInvoiceSettings().companyAddressLines.join('\n'));
  const [generatingPaymentId, setGeneratingPaymentId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [updatingFactureCycleId, setUpdatingFactureCycleId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeRemoteInvoiceSettings((s) => {
      setMergedInvoiceSettings(s);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = paymentService.subscribeToAllPayments((data) => {
      setPayments(data);
      setLoading(false);
    });
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    });
    
    const unsubscribeClients = onSnapshot(collection(db, 'users'), (snapshot) => {
      type ClientRow = {
        id: string;
        role?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        company?: string;
      };
      setClients(
        snapshot.docs
          .map((d) => {
            const data = d.data() as Omit<ClientRow, 'id'>;
            return { id: d.id, ...data };
          })
          .filter((u) => String(u.role || '').toLowerCase() === 'client')
      );
    });

    return () => {
      unsubscribe();
      unsubscribeOrders();
      unsubscribeClients();
    };
  }, []);

  const clientById = useMemo(() => {
    const m = new Map<string, (typeof clients)[number]>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const filteredClients = useMemo(() => {
    const t = clientFilter.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter((c) => {
      const blob = [c.firstName, c.lastName, c.email, c.company].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(t);
    });
  }, [clients, clientFilter]);

  const selectedClientForPrestation = useMemo(
    () => clients.find((c) => c.id === prestationForm.clientId),
    [clients, prestationForm.clientId]
  );

  const ordersById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const order of orders) {
      map.set(String(order.id), order as Record<string, unknown>);
    }
    return map;
  }, [orders]);

  const ordersByPaymentId = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const order of orders) {
      const paymentId = String(order.paymentId || '').trim();
      if (paymentId) map.set(paymentId, order as Record<string, unknown>);
    }
    return map;
  }, [orders]);

  const resolveOrderForPayment = (p: Payment): Record<string, unknown> | null => {
    if (p.linkedOrderId) {
      const byLinked = ordersById.get(p.linkedOrderId);
      if (byLinked) return byLinked;
    }
    const byPaymentId = ordersByPaymentId.get(p.id);
    return byPaymentId || null;
  };

  const resolveClientName = (p: Payment): string => {
    const cid = p.clientId ?? p.userId;
    if (cid) {
      const c = clientById.get(cid);
      if (c) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
        if (name) return name;
        if (typeof c.email === 'string' && c.email) return c.email;
        if (typeof c.company === 'string' && c.company) return c.company;
      }
    }
    if (p.clientEmail) return p.clientEmail;
    return 'Client';
  };

  const paymentToPdfInput = (p: Payment): InvoicePaymentInput => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    createdAt: p.createdAt,
    clientId: p.clientId,
    clientEmail: p.clientEmail,
    userId: p.userId,
    status: p.status,
  });

  /** Seule l’équipe Finance attribue un numéro officiel et enregistre l’émission sur le paiement. */
  const handleGenerateOfficialInvoice = async (p: Payment) => {
    setGeneratingPaymentId(p.id);
    try {
      const { invoiceNumber, invoiceIssuedAt } = await ensurePaymentInvoiceNumber(
        p.id,
        mergedInvoiceSettings.invoiceNumberPrefix
      );
      await downloadInvoicePdf(paymentToPdfInput(p), resolveClientName(p), mergedInvoiceSettings, {
        invoiceNumber,
        documentDate: invoiceIssuedAt,
      });
      toast.success('Facture émise : passage à « en cours de paiement ». Encaissez depuis le journal une fois payé.');
    } catch (err) {
      console.error(err);
      toast.error('Impossible d’émettre la facture (réseau ou droits Firestore).');
    } finally {
      setGeneratingPaymentId(null);
    }
  };

  const handleMarkInvoicePaid = async (p: Payment) => {
    const step = resolveFactureEtape(p);
    if (step !== 'paiement_en_cours') {
      toast.error('L’encaissement se valide uniquement lorsque la facture est « en cours de paiement ».');
      return;
    }
    if (!p.invoiceNumber) {
      toast.error('Émettez d’abord la facture officielle (PDF + numéro).');
      return;
    }
    setMarkingPaidId(p.id);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'payments', p.id), {
        status: 'succeeded',
        factureEtape: 'paye',
        invoicePaidAt: now,
        updatedAt: now,
      });
      toast.success('Ligne marquée comme payée (facture soldée).');
    } catch (err) {
      console.error(err);
      toast.error('Impossible d’enregistrer le paiement.');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleChangeFactureCycle = async (p: Payment, next: FactureEtape) => {
    const current = resolveFactureEtape(p);
    if (current === null) return;
    if (next === current) return;

    if (next === 'paye' && !String(p.invoiceNumber || '').trim()) {
      toast.error('Un numéro de facture est requis avant l’étape « Payé ». Émettez d’abord le PDF officiel.');
      return;
    }

    setUpdatingFactureCycleId(p.id);
    try {
      const now = new Date().toISOString();
      if (next === 'paye') {
        await updateDoc(doc(db, 'payments', p.id), {
          factureEtape: 'paye',
          status: 'succeeded',
          invoicePaidAt: now,
          updatedAt: now,
        });
        toast.success('Cycle facture : payé.');
      } else {
        await updateDoc(doc(db, 'payments', p.id), {
          factureEtape: next,
          status: 'pending',
          invoicePaidAt: deleteField(),
          updatedAt: now,
        });
        toast.success(
          next === 'paiement_en_cours'
            ? 'Cycle facture : en cours de paiement.'
            : 'Cycle facture : génération.',
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Impossible de mettre à jour le cycle facture.');
    } finally {
      setUpdatingFactureCycleId(null);
    }
  };

  const openInvoiceSettingsModal = () => {
    setInvoiceDraft(mergedInvoiceSettings);
    setAddressText(mergedInvoiceSettings.companyAddressLines.join('\n'));
    setInvoiceSettingsOpen(true);
  };

  const handlePreviewDraftPdf = async () => {
    const lines = addressText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const previewSettings: InvoicePdfSettings = {
      ...invoiceDraft,
      companyAddressLines: lines.length ? lines : [...DEFAULT_INVOICE_SETTINGS.companyAddressLines],
    };
    const sample: InvoicePaymentInput = {
      id: 'MOUVEMENT-DEMO',
      amount: 125_000,
      currency: 'XOF',
      description: 'Prestation de démonstration',
      createdAt: new Date().toISOString(),
      clientEmail: 'client@exemple.com',
    };
    const opened = await openInvoicePdfPreview(sample, 'Client démonstration', previewSettings, {
      invoiceNumber: 'APERÇU',
      isDraft: true,
    });
    if (!opened) {
      toast.error('Autorisez les pop-ups pour afficher l’aperçu.');
    }
  };

  const handleSaveInvoiceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = addressText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const next: InvoicePdfSettings = {
      ...invoiceDraft,
      companyAddressLines: lines.length ? lines : [...DEFAULT_INVOICE_SETTINGS.companyAddressLines],
    };
    try {
      saveInvoiceSettings(next);
      await persistRemoteInvoiceSettings(next);
      setMergedInvoiceSettings(next);
      setInvoiceDraft(next);
      toast.success('Paramètres des factures enregistrés (équipe + appareil local).');
      setInvoiceSettingsOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Enregistrement distant impossible. Paramètres locaux conservés.');
    }
  };

  const closePrestationModal = () => {
    setIsModalOpen(false);
    setPrestationEdit(null);
    setPrestationForm(emptyPrestationForm());
    setPrestationCreateStep(1);
    setClientFilter('');
  };

  const openCreatePrestationModal = () => {
    setPrestationEdit(null);
    setPrestationForm(emptyPrestationForm());
    setPrestationCreateStep(1);
    setClientFilter('');
    setIsModalOpen(true);
  };

  const openEditPrestationModal = (p: Payment) => {
    const cid = p.clientId ?? p.userId ?? '';
    setPrestationEdit(p);
    setPrestationForm({
      clientId: cid,
      title: p.description ?? '',
      amount: Number.isFinite(p.amount) ? String(p.amount) : '',
    });
    setPrestationCreateStep(1);
    setClientFilter('');
    setIsModalOpen(true);
  };

  const resolveLinkedOrderId = async (p: Payment): Promise<string | null> => {
    if (p.linkedOrderId) return p.linkedOrderId;
    const q = query(collection(db, 'orders'), where('paymentId', '==', p.id), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  };

  const validatePrestationFields = (): { client: (typeof clients)[number]; title: string; amount: number } | null => {
    const title = prestationForm.title.trim();
    if (title.length < 2) {
      toast.error('Indiquez un intitulé de prestation (au moins 2 caractères).');
      return null;
    }
    const amount = parseAmountFcfa(prestationForm.amount);
    if (!(amount > 0)) {
      toast.error('Indiquez un montant valide supérieur à 0 FCFA.');
      return null;
    }
    const client = clients.find((c) => c.id === prestationForm.clientId);
    if (!client) {
      toast.error('Sélectionnez un client valide.');
      return null;
    }
    return { client, title, amount };
  };

  const resolvePartnerCommissionForClient = async (
    client: (typeof clients)[number],
    amount: number
  ): Promise<{ partnerId: string; ratePercent: number; commissionAmount: number } | null> => {
    const partnerId = String(client.referredByPartnerId || '').trim();
    if (!partnerId) return null;

    let ratePercent = 10;
    try {
      const partnerSnap = await getDoc(doc(db, 'users', partnerId));
      if (partnerSnap.exists()) {
        const partnerData = (partnerSnap.data() || {}) as Record<string, unknown>;
        const parsedRate = Number(partnerData.commissionRate);
        if (Number.isFinite(parsedRate) && parsedRate > 0) {
          ratePercent = parsedRate;
        }
      }
    } catch (error) {
      console.warn('[Finance] impossible de lire commissionRate partenaire:', error);
    }

    const commissionAmount = Math.max(0, Math.round((amount * ratePercent) / 100));
    if (!(commissionAmount > 0)) return null;
    return { partnerId, ratePercent, commissionAmount };
  };

  const syncPartnerCommissionForOrder = async (params: {
    orderId: string;
    paymentId: string;
    client: (typeof clients)[number];
    serviceName: string;
    amount: number;
    now: string;
  }) => {
    const { orderId, paymentId, client, serviceName, amount, now } = params;

    const commission = await resolvePartnerCommissionForClient(client, amount);
    const existingCommissionSnap = await getDocs(
      query(collection(db, 'partner_commissions'), where('orderId', '==', orderId), limit(1))
    );
    const existingCommissionDoc = existingCommissionSnap.empty ? null : existingCommissionSnap.docs[0];
    const existingCommissionData = existingCommissionDoc
      ? (existingCommissionDoc.data() as Record<string, unknown>)
      : null;

    if (!commission) {
      await updateDoc(doc(db, 'orders', orderId), {
        partnerCommissionPaid: false,
        partnerCommissionPaidAt: null,
        partnerCommissionPartnerId: null,
        partnerCommissionAmount: null,
        partnerCommissionRate: null,
      });

      if (existingCommissionDoc) {
        await updateDoc(doc(db, 'partner_commissions', existingCommissionDoc.id), {
          status: 'cancelled',
          amount: 0,
          ratePercent: null,
          updatedAt: now,
        });
      }
      return;
    }

    await updateDoc(doc(db, 'orders', orderId), {
      partnerCommissionPaid: true,
      partnerCommissionPaidAt: now,
      partnerCommissionPartnerId: commission.partnerId,
      partnerCommissionAmount: commission.commissionAmount,
      partnerCommissionRate: commission.ratePercent,
    });

    if (existingCommissionDoc) {
      await updateDoc(doc(db, 'partner_commissions', existingCommissionDoc.id), {
        partnerId: commission.partnerId,
        userId: client.id,
        serviceName,
        amount: commission.commissionAmount,
        ratePercent: commission.ratePercent,
        status: 'paid',
        source: 'prestation_finance',
        updatedAt: now,
      });
    } else {
      await addDoc(collection(db, 'partner_commissions'), {
        partnerId: commission.partnerId,
        orderId,
        userId: client.id,
        serviceName,
        amount: commission.commissionAmount,
        ratePercent: commission.ratePercent,
        status: 'paid',
        source: 'prestation_finance',
        createdAt: now,
      });
    }

    const previousPartnerId = String(existingCommissionData?.partnerId || '').trim();
    const previousAmount = Number(existingCommissionData?.amount || 0);
    const shouldNotify =
      !existingCommissionData ||
      previousPartnerId !== commission.partnerId ||
      previousAmount !== commission.commissionAmount;

    if (shouldNotify) {
      await addDoc(collection(db, 'notifications'), {
        userId: commission.partnerId,
        title: 'Commission versée',
        message: `Une commission de ${commission.commissionAmount.toLocaleString('fr-FR')} FCFA (${commission.ratePercent}%) a été versée suite à la prestation « ${serviceName} » pour ${client.email || 'votre filleul'}.`,
        type: 'billing',
        read: false,
        createdAt: now,
        metadata: {
          orderId,
          paymentId,
          amount: commission.commissionAmount,
          ratePercent: commission.ratePercent,
        },
      });
    }
  };

  const handleCreateInvoice = async () => {
    const v = validatePrestationFields();
    if (!v) return;
    setIsSubmitting(true);
    try {
      const { client, title, amount } = v;
      const paymentId = `PAY-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const orderId = `ORD-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const slug = toServiceSlug(title);
      const now = new Date().toISOString();

      await setDoc(doc(db, 'payments', paymentId), {
        id: paymentId,
        amount,
        currency: 'XOF',
        status: 'pending',
        factureEtape: 'generation',
        description: title,
        clientId: client.id,
        clientEmail: client.email,
        userId: client.id,
        linkedOrderId: orderId,
        createdAt: now,
      });

      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        paymentId,
        userId: client.id,
        serviceId: slug,
        serviceName: title,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`.trim() || client.email || 'Client',
        clientEmail: client.email,
        amount,
        status: 'Validé',
        createdAt: now,
      });

      await syncPartnerCommissionForOrder({
        orderId,
        paymentId,
        client,
        serviceName: title,
        amount,
        now,
      });

      toast.success(
        'Prestation créée : cycle facture « génération » — émettez la facture PDF, puis encaissez quand le client a payé.'
      );
      closePrestationModal();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création de la prestation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePrestation = async () => {
    if (!prestationEdit) return;
    const v = validatePrestationFields();
    if (!v) return;
    setIsSubmitting(true);
    try {
      const { client, title, amount } = v;
      const now = new Date().toISOString();
      const slug = toServiceSlug(title);

      await updateDoc(doc(db, 'payments', prestationEdit.id), {
        amount,
        description: title,
        clientId: client.id,
        clientEmail: client.email,
        userId: client.id,
        updatedAt: now,
      });

      const orderId = await resolveLinkedOrderId(prestationEdit);
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          serviceId: slug,
          serviceName: title,
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`.trim() || client.email || 'Client',
          clientEmail: client.email,
          amount,
          userId: client.id,
          paymentId: prestationEdit.id,
          updatedAt: now,
        });
        await syncPartnerCommissionForOrder({
          orderId,
          paymentId: prestationEdit.id,
          client,
          serviceName: title,
          amount,
          now,
        });
        if (!prestationEdit.linkedOrderId) {
          await updateDoc(doc(db, 'payments', prestationEdit.id), { linkedOrderId: orderId });
        }
      }

      toast.success('Prestation mise à jour.');
      closePrestationModal();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrestationFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prestationEdit) void handleUpdatePrestation();
    else void handleCreateInvoice();
  };

  const goToPrestationCreateStep2 = () => {
    if (!prestationForm.clientId) {
      toast.error('Choisissez un client pour continuer.');
      return;
    }
    setPrestationCreateStep(2);
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

  const handleExportPDF = async () => {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new JsPdf();
    
    doc.setFontSize(18);
    doc.text('Rapport Financier Infinite Core', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

    const tableData = payments.map((p) => {
      const fs = resolveFactureEtape(p);
      const cycle =
        fs === null ? '—' : fs === 'paye' ? 'Payé' : fs === 'paiement_en_cours' ? 'En cours de paiement' : 'Génération';
      return [
        p.id.substring(0, 8),
        p.description || 'Service',
        'Paiement',
        new Date(p.createdAt).toLocaleDateString('fr-FR'),
        `${p.amount.toLocaleString('fr-FR')} FCFA`,
        cycle,
        p.status === 'succeeded' ? 'Encaissé' : p.status === 'failed' ? 'Échoué' : 'En attente',
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Description', 'Type', 'Date', 'Montant', 'Facturation', 'Statut']],
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
            type="button"
            onClick={openCreatePrestationModal}
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
            type="button"
            onClick={openInvoiceSettingsModal}
            className="flex items-center gap-3 px-6 py-3 bg-surface-secondary border border-border-subtle text-text-primary rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-surface-tertiary transition-all shadow-sm"
          >
            <Settings size={18} /> Factures PDF
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
        <div className="p-8 border-b border-border-subtle bg-surface-primary/30 space-y-2">
          <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Journal des Opérations</h2>
          <p className="text-[11px] text-text-secondary font-medium leading-relaxed max-w-3xl">
            Cycle facture : <strong className="text-text-primary font-bold">Génération</strong> (ligne créée, facture à émettre) →{' '}
            <strong className="text-text-primary font-bold">En cours de paiement</strong> (après émission du PDF / numéro) →{' '}
            <strong className="text-text-primary font-bold">Payé</strong> (encaissement confirmé). Vous pouvez corriger l’étape
            depuis la colonne « Cycle facture » (liste déroulante) ; « Payé » exige un numéro de facture. Les indicateurs
            « encaissés » ne comptent qu’en étape payée.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-tertiary/50 text-text-muted text-[10px] font-black uppercase tracking-widest border-b border-border-subtle">
                <th className="p-4 md:p-6 font-black hidden sm:table-cell">ID Flux</th>
                <th className="p-4 md:p-6 font-black">Désignation</th>
                <th className="p-4 md:p-6 font-black hidden lg:table-cell">Vecteur</th>
                <th className="p-4 md:p-6 font-black hidden md:table-cell">Horodatage</th>
                <th className="p-4 md:p-6 font-black text-right">Montant</th>
                <th className="p-4 md:p-6 font-black min-w-34">Cycle facture</th>
                <th className="p-4 md:p-6 font-black w-px whitespace-nowrap">Actions</th>
                <th className="p-4 md:p-6 font-black w-px whitespace-nowrap">Émission</th>
                <th className="p-4 md:p-6 font-black">Statut</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-text-muted font-black uppercase tracking-widest opacity-50">
                    Synchronisation du journal...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-text-muted font-black uppercase tracking-widest opacity-50">
                    Néant opérationnel.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const factureStep = resolveFactureEtape(p);
                  const linkedOrder = resolveOrderForPayment(p);
                  const partnerCommissionAmount = Number(linkedOrder?.partnerCommissionAmount || 0);
                  const partnerCommissionRate = Number(linkedOrder?.partnerCommissionRate || 0);
                  const partnerCommissionPartnerId = String(linkedOrder?.partnerCommissionPartnerId || '').trim();
                  const montantTone =
                    factureStep === 'paye'
                      ? 'text-noya-green'
                      : factureStep === 'paiement_en_cours'
                        ? 'text-noya-blue'
                        : factureStep === 'generation'
                          ? 'text-noya-orange'
                          : p.status === 'failed'
                            ? 'text-red-500'
                            : 'text-text-primary';
                  return (
                  <tr key={p.id} className="border-b border-border-subtle hover:bg-surface-tertiary transition-all group/row">
                    <td className="p-4 md:p-6 font-black text-text-primary font-mono uppercase tracking-widest opacity-80 group-hover/row:text-noya-blue transition-colors hidden sm:table-cell">{p.id.substring(0, 8)}</td>
                    <td className="p-4 md:p-6 text-text-secondary uppercase font-bold tracking-tight">
                      <div className="space-y-1.5">
                        <p className="text-text-secondary uppercase font-bold tracking-tight">{p.description || 'Service'}</p>
                        {partnerCommissionAmount > 0 && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-noya-green/30 bg-noya-green/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-noya-green">
                            Commission partenaire
                            <span className="text-text-primary">{partnerCommissionAmount.toLocaleString('fr-FR')} FCFA</span>
                            {partnerCommissionRate > 0 && (
                              <span className="text-noya-green/80">({partnerCommissionRate}%)</span>
                            )}
                            {partnerCommissionPartnerId && (
                              <span className="text-text-muted">· {partnerCommissionPartnerId.slice(0, 8)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-6 text-text-muted uppercase font-black text-[9px] tracking-widest hidden lg:table-cell">Virement Entrant</td>
                    <td className="p-4 md:p-6 text-text-muted font-bold font-mono uppercase hidden md:table-cell">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className={`p-4 md:p-6 font-black text-right text-sm tracking-tighter ${montantTone}`}>
                      {p.amount.toLocaleString('fr-FR')} <span className="text-[9px] opacity-60">FCFA</span>
                    </td>
                    <td className="p-4 md:p-6 align-top">
                      {factureStep === null ? (
                        <span className="text-[10px] font-medium text-text-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-2 max-w-50">
                          <label className="sr-only" htmlFor={`facture-cycle-${p.id}`}>
                            Cycle facture pour {p.description || p.id}
                          </label>
                          <select
                            id={`facture-cycle-${p.id}`}
                            disabled={
                              updatingFactureCycleId === p.id ||
                              markingPaidId === p.id ||
                              generatingPaymentId === p.id
                            }
                            value={factureStep}
                            onChange={(e) => {
                              const v = e.target.value as FactureEtape;
                              void handleChangeFactureCycle(p, v);
                            }}
                            className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface-primary px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-text-primary shadow-inner outline-none transition-colors hover:border-noya-blue/35 focus-visible:ring-2 focus-visible:ring-noya-blue/40 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="generation">Génération</option>
                            <option value="paiement_en_cours">En cours de paiement</option>
                            <option value="paye">Payé</option>
                          </select>
                          {factureStep === 'paiement_en_cours' && (
                            <button
                              type="button"
                              disabled={markingPaidId === p.id || updatingFactureCycleId === p.id}
                              onClick={() => handleMarkInvoicePaid(p)}
                              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-noya-green/40 bg-noya-green/10 text-noya-green font-black uppercase text-[8px] tracking-widest hover:bg-noya-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Raccourci : même effet que « Payé » dans la liste (avec numéro de facture)"
                              aria-label="Marquer comme payé"
                            >
                              {markingPaidId === p.id ? (
                                <span className="inline-block w-3 h-3 border-2 border-noya-green/30 border-t-noya-green rounded-full animate-spin" />
                              ) : (
                                <CheckCircle2 size={14} aria-hidden />
                              )}
                              Encaisser
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 md:p-6 align-top">
                      <button
                        type="button"
                        onClick={() => openEditPrestationModal(p)}
                        className="inline-flex items-center justify-center p-2.5 rounded-xl border border-border-subtle bg-surface-primary text-text-muted hover:text-noya-blue hover:border-noya-blue/30 transition-all"
                        title="Modifier la prestation"
                        aria-label="Modifier la prestation"
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                    <td className="p-4 md:p-6 align-top">
                      <div className="flex flex-col items-stretch gap-1.5 max-w-38">
                        <button
                          type="button"
                          disabled={generatingPaymentId === p.id}
                          onClick={() => handleGenerateOfficialInvoice(p)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border-subtle bg-surface-primary text-text-primary font-black uppercase text-[9px] tracking-widest hover:border-noya-blue/40 hover:text-noya-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Générer la facture officielle (numéro + PDF)"
                          aria-label="Générer la facture officielle PDF"
                        >
                          {generatingPaymentId === p.id ? (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-noya-blue/30 border-t-noya-blue rounded-full animate-spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                          <span className="hidden xl:inline">{p.invoiceNumber ? 'PDF' : 'Générer'}</span>
                          <span className="xl:hidden">{p.invoiceNumber ? 'PDF' : 'OK'}</span>
                        </button>
                        {p.invoiceNumber ? (
                          <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-tight break-all">
                            {p.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black text-text-muted/70 uppercase tracking-widest">Non émise</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-6">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-inner
                        ${p.status === 'succeeded' ? 'bg-noya-green/10 text-noya-green border-noya-green/20' : 
                          p.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-noya-orange/10 text-noya-orange border-noya-orange/20'}`}
                      >
                        {p.status === 'succeeded' ? 'Encaissé' : p.status === 'failed' ? 'Rejeté' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                  );
                })
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
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-2xl max-h-[min(92vh,800px)] flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-start gap-4 p-6 sm:p-8 border-b border-border-subtle bg-surface-primary/50 shrink-0">
                <div className="min-w-0 flex-1">
                  {!prestationEdit && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                          prestationCreateStep === 1
                            ? 'bg-noya-green/15 text-noya-green border-noya-green/25'
                            : 'bg-surface-tertiary text-text-muted border-border-subtle'
                        }`}
                      >
                        1 · Client
                      </span>
                      <span className="text-text-muted text-[10px]">→</span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                          prestationCreateStep === 2
                            ? 'bg-noya-green/15 text-noya-green border-noya-green/25'
                            : 'bg-surface-tertiary text-text-muted border-border-subtle'
                        }`}
                      >
                        2 · Prestation
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">
                    {prestationEdit ? 'Modifier la prestation' : 'Nouvelle prestation'}
                  </h3>
                  <p className="text-sm text-text-secondary mt-2 font-medium leading-snug">
                    {prestationEdit
                      ? 'Mettez à jour le client, l’intitulé ou le montant. Le journal et la commande portail sont synchronisés.'
                      : prestationCreateStep === 1
                        ? 'Choisissez le compte client auquel rattacher cette ligne de trésorerie.'
                        : 'Saisissez l’intitulé commercial et le montant en FCFA, puis validez pour créer le paiement et la commande.'}
                  </p>
                  {prestationEdit && (
                    <p
                      className="text-[10px] font-mono text-text-muted mt-2 uppercase tracking-widest truncate"
                      title={prestationEdit.id}
                    >
                      {prestationEdit.id}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closePrestationModal}
                  aria-label="Fermer"
                  className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary shrink-0"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {!prestationEdit && prestationCreateStep === 1 ? (
                  <div className="p-6 sm:p-8 flex flex-col gap-6 flex-1">
                    <div className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-primary/40 p-4">
                      <User className="w-5 h-5 text-noya-green shrink-0 mt-0.5" aria-hidden />
                      <p className="text-[12px] text-text-secondary leading-relaxed">
                        La prestation crée une entrée dans le journal des paiements et une commande « Validé » côté client
                        pour le suivi des modules achetés.
                      </p>
                    </div>
                    {clients.length === 0 ? (
                      <div className="rounded-2xl border border-border-subtle bg-surface-primary/30 p-6 text-center space-y-3">
                        <p className="text-sm font-medium text-text-secondary">Aucun client en base.</p>
                        <Link
                          to="/admin/clients"
                          className="inline-flex text-sm font-black uppercase tracking-widest text-noya-blue hover:underline"
                        >
                          Ouvrir la gestion clients
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label htmlFor="finance-client-filter" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                            Rechercher un client
                          </label>
                          <input
                            id="finance-client-filter"
                            type="search"
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            placeholder="Nom, e-mail ou société…"
                            className="w-full px-5 py-3.5 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none text-sm font-medium placeholder:opacity-40"
                          />
                        </div>
                        <div>
                          <label htmlFor="finance-prestation-client" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                            Client facturé *
                          </label>
                          <select
                            id="finance-prestation-client"
                            value={prestationForm.clientId}
                            onChange={(e) => setPrestationForm({ ...prestationForm, clientId: e.target.value })}
                            className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-bold text-[11px] sm:text-sm"
                          >
                            <option value="">— Sélectionner —</option>
                            {filteredClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {[c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || c.id}
                                {c.company ? ` · ${c.company}` : ''}
                              </option>
                            ))}
                          </select>
                          {clientFilter.trim() && filteredClients.length === 0 && (
                            <p className="mt-2 text-[11px] font-medium text-text-muted">Aucun client ne correspond à cette recherche.</p>
                          )}
                        </div>
                      </>
                    )}
                    <div className="mt-auto pt-4 flex flex-wrap justify-end gap-3 border-t border-border-subtle">
                      <button
                        type="button"
                        onClick={closePrestationModal}
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={clients.length === 0}
                        onClick={goToPrestationCreateStep2}
                        className="px-8 py-3.5 bg-noya-green text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-green/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Continuer
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePrestationFormSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 sm:p-8 space-y-6 flex-1">
                      {!prestationEdit && prestationCreateStep === 2 && (
                        <button
                          type="button"
                          onClick={() => setPrestationCreateStep(1)}
                          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-noya-green transition-colors"
                        >
                          <ChevronLeft size={16} aria-hidden />
                          Changer de client
                        </button>
                      )}

                      {prestationEdit?.invoiceNumber && (
                        <div className="rounded-2xl border border-noya-orange/30 bg-noya-orange/10 px-4 py-3 text-[11px] font-medium text-text-secondary leading-relaxed">
                          Une facture officielle ({prestationEdit.invoiceNumber}) est déjà associée à cette ligne. Après
                          modification, régénérez le PDF si les montants ou libellés doivent refléter le document comptable.
                        </div>
                      )}

                      {!prestationEdit && prestationCreateStep === 2 && selectedClientForPrestation && (
                        <div className="rounded-2xl border border-noya-green/25 bg-noya-green/10 px-4 py-3 flex items-center gap-3">
                          <User className="w-5 h-5 text-noya-green shrink-0" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-widest text-noya-green/90">Client</p>
                            <p className="text-sm font-black text-text-primary truncate">
                              {[selectedClientForPrestation.firstName, selectedClientForPrestation.lastName]
                                .filter(Boolean)
                                .join(' ')
                                .trim() || selectedClientForPrestation.email}
                            </p>
                            <p className="text-[11px] text-text-muted truncate">{selectedClientForPrestation.email}</p>
                          </div>
                        </div>
                      )}

                      {prestationEdit && (
                        <div>
                          <label htmlFor="finance-client-filter-edit" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                            Rechercher un client
                          </label>
                          <input
                            id="finance-client-filter-edit"
                            type="search"
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            placeholder="Nom, e-mail ou société…"
                            className="w-full px-5 py-3.5 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none text-sm font-medium placeholder:opacity-40 mb-3"
                          />
                          <label htmlFor="finance-prestation-client-edit" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                            Client facturé *
                          </label>
                          <select
                            id="finance-prestation-client-edit"
                            value={prestationForm.clientId}
                            onChange={(e) => setPrestationForm({ ...prestationForm, clientId: e.target.value })}
                            className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-bold text-[11px] sm:text-sm"
                          >
                            <option value="">— Sélectionner —</option>
                            {filteredClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {[c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || c.id}
                                {c.company ? ` · ${c.company}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="finance-prestation-title"
                          className="flex items-center gap-2 text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2"
                        >
                          <Briefcase size={14} className="text-text-muted shrink-0" aria-hidden />
                          Intitulé de la prestation *
                        </label>
                        <input
                          id="finance-prestation-title"
                          type="text"
                          required
                          value={prestationForm.title}
                          onChange={(e) => setPrestationForm({ ...prestationForm, title: e.target.value })}
                          placeholder="Ex. Audit infrastructure — phase 1"
                          className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-bold text-sm transition-all placeholder:opacity-35"
                        />
                        <p className="mt-1.5 text-[10px] text-text-muted font-medium">Libellé visible côté client et sur la facture PDF.</p>
                      </div>
                      <div>
                        <label htmlFor="finance-prestation-amount" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                          Montant (FCFA) *
                        </label>
                        <input
                          id="finance-prestation-amount"
                          type="text"
                          inputMode="decimal"
                          required
                          value={prestationForm.amount}
                          onChange={(e) => setPrestationForm({ ...prestationForm, amount: e.target.value })}
                          placeholder="250000 ou 250 000"
                          className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-green outline-none shadow-inner font-black text-lg tracking-tight transition-all placeholder:opacity-35"
                        />
                      </div>
                    </div>
                    <div className="p-6 sm:p-8 pt-4 border-t border-border-subtle bg-surface-primary/35 shrink-0 flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={closePrestationModal}
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3.5 bg-noya-green text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-green/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                            En cours…
                          </>
                        ) : prestationEdit ? (
                          'Enregistrer les modifications'
                        ) : (
                          'Créer la prestation'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {invoiceSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50 shrink-0 gap-4">
                <div>
                  <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Personnaliser les factures PDF</h3>
                  <p className="text-[10px] text-text-secondary font-medium mt-2 leading-relaxed">
                    Modèle partagé avec toute l’équipe (Firestore). Seul un membre Finance / admin peut émettre une facture
                    numérotée depuis le journal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceSettingsOpen(false)}
                  aria-label="Fermer"
                  className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary shrink-0"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveInvoiceSettings} className="p-8 space-y-5 overflow-y-auto flex-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewDraftPdf}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-primary text-text-primary font-black uppercase text-[9px] tracking-widest hover:border-noya-blue/40 transition-all"
                  >
                    <Eye size={16} aria-hidden />
                    Aperçu brouillon
                  </button>
                </div>
                <div>
                  <label htmlFor="inv-pdf-title" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Titre du document</label>
                  <input
                    id="inv-pdf-title"
                    type="text"
                    value={invoiceDraft.invoiceTitle}
                    onChange={(e) => setInvoiceDraft({ ...invoiceDraft, invoiceTitle: e.target.value })}
                    placeholder="FACTURE"
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-bold uppercase text-[10px] tracking-widest"
                  />
                </div>
                <div>
                  <label htmlFor="inv-pdf-company" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Raison sociale</label>
                  <input
                    id="inv-pdf-company"
                    type="text"
                    value={invoiceDraft.companyName}
                    onChange={(e) => setInvoiceDraft({ ...invoiceDraft, companyName: e.target.value })}
                    placeholder="Nom de l’entreprise"
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-bold text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="inv-pdf-address" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Adresse (une ligne par ligne)</label>
                  <textarea
                    id="inv-pdf-address"
                    value={addressText}
                    onChange={(e) => setAddressText(e.target.value)}
                    rows={3}
                    placeholder={'Ligne 1\nLigne 2'}
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-medium text-sm resize-y min-h-18"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-pdf-email" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">E-mail</label>
                    <input
                      id="inv-pdf-email"
                      type="email"
                      value={invoiceDraft.companyEmail}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, companyEmail: e.target.value })}
                      placeholder="contact@exemple.com"
                      className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-pdf-phone" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Téléphone</label>
                    <input
                      id="inv-pdf-phone"
                      type="text"
                      value={invoiceDraft.companyPhone}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, companyPhone: e.target.value })}
                      placeholder="+225 …"
                      className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-pdf-currency" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Libellé devise</label>
                    <input
                      id="inv-pdf-currency"
                      type="text"
                      value={invoiceDraft.currencyLabel}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, currencyLabel: e.target.value })}
                      placeholder="FCFA"
                      className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-bold uppercase text-[10px] tracking-widest"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-pdf-prefix" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Préfixe numéros</label>
                    <input
                      id="inv-pdf-prefix"
                      type="text"
                      value={invoiceDraft.invoiceNumberPrefix}
                      onChange={(e) =>
                        setInvoiceDraft({ ...invoiceDraft, invoiceNumberPrefix: e.target.value.toUpperCase().slice(0, 12) })
                      }
                      placeholder="FAC"
                      className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-mono font-black uppercase text-[10px] tracking-widest"
                    />
                    <p className="text-[9px] text-text-muted mt-1.5 font-medium">Ex. FAC → FAC-2026-00001</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label htmlFor="inv-pdf-vat-toggle" className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-text-secondary uppercase tracking-tight">
                    <input
                      id="inv-pdf-vat-toggle"
                      type="checkbox"
                      checked={invoiceDraft.showVat}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, showVat: e.target.checked })}
                      className="rounded border-border-subtle w-4 h-4 accent-noya-blue"
                    />
                    Afficher la TVA
                  </label>
                  {invoiceDraft.showVat && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="inv-pdf-vat-rate" className="text-[10px] font-black text-text-muted uppercase tracking-widest">Taux %</label>
                      <input
                        id="inv-pdf-vat-rate"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={invoiceDraft.vatRatePercent}
                        onChange={(e) =>
                          setInvoiceDraft({ ...invoiceDraft, vatRatePercent: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="w-20 px-3 py-2 bg-surface-primary border border-border-subtle rounded-xl text-sm font-black"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="inv-pdf-footer" className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Pied de page légal</label>
                  <textarea
                    id="inv-pdf-footer"
                    value={invoiceDraft.legalFooter}
                    onChange={(e) => setInvoiceDraft({ ...invoiceDraft, legalFooter: e.target.value })}
                    rows={3}
                    placeholder="Mentions légales, délais de paiement…"
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none text-xs leading-relaxed resize-y"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setInvoiceSettingsOpen(false)}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-4 bg-noya-blue text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-blue/20"
                  >
                    Enregistrer
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
