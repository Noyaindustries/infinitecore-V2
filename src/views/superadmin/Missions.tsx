import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, Clock, X, Search, ExternalLink, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, doc, setDoc, updateDoc, deleteDoc } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { SERVICE_CATALOG } from '../../data/serviceCatalog';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'À faire',
  en_cours: 'En cours',
  en_revue: 'En revue',
  termine: 'Terminé',
  annule: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  en_attente: 'bg-noya-blue/10 text-noya-blue',
  en_cours: 'bg-noya-orange/10 text-noya-orange',
  en_revue: 'bg-noya-purple/10 text-noya-purple',
  termine: 'bg-noya-green/10 text-noya-green',
  annule: 'bg-surface-tertiary text-text-secondary',
};

export default function SuperAdminMissions() {
  const [missions, setMissions] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [form, setForm] = useState({
    title: '',
    assignedTo: '',
    clientId: '',
    deadline: '',
    description: '',
    priority: 'moyenne',
    services: [] as any[] // Array of { id, name, price, devCommission }
  });
  const [services, setServices] = useState<any[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    price: 0,
    devCommission: 0
  });

  useEffect(() => {
    const unsubMissions = onSnapshot(
      query(collection(db, 'missions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubDevs = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'developer')),
      (snap) => setDevelopers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubClients = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'client')),
      (snap) => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubServices = onSnapshot(
      query(collection(db, 'service_catalog'), orderBy('name', 'asc')),
      async (snap) => {
        if (snap.empty) {
          // Seed initial data if empty
          for (const s of SERVICE_CATALOG) {
            await setDoc(doc(db, 'service_catalog', s.id), s);
          }
        } else {
          setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }
    );

    return () => { unsubMissions(); unsubDevs(); unsubClients(); unsubServices(); };
  }, []);

  const closeCreateModal = () => {
    if (isSubmitting) return;
    const hasDraft =
      form.title.trim().length > 0 ||
      form.assignedTo.trim().length > 0 ||
      form.clientId.trim().length > 0 ||
      form.deadline.trim().length > 0 ||
      form.description.trim().length > 0 ||
      form.services.length > 0;
    if (hasDraft) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }
    setIsModalOpen(false);
  };

  const closeEditModal = () => {
    if (isSubmitting) return;
    if (editingMission) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les modifications non enregistrées seront perdues.'
      );
      if (!confirmed) return;
    }
    setIsEditModalOpen(false);
    setEditingMission(null);
  };

  const closeServiceModal = () => {
    if (isSubmitting) return;
    const hasDraft =
      serviceForm.name.trim().length > 0 ||
      Number(serviceForm.price) > 0 ||
      Number(serviceForm.devCommission) > 0;
    if (hasDraft) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }
    setIsServiceModalOpen(false);
    setEditingService(null);
    setServiceForm({ name: '', price: 0, devCommission: 0 });
  };

  const getDevName = (uid: string) => {
    const dev = developers.find(d => d.id === uid);
    return dev ? `${dev.firstName || ''} ${dev.lastName || ''}`.trim() || dev.email : '—';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.services.length === 0) {
      toast.error('Veuillez ajouter au moins un service à la mission.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const id = `MSN-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const dev = developers.find(d => d.id === form.assignedTo);
      const client = clients.find(c => c.id === form.clientId);

      const totalServicePrice = form.services.reduce((acc, s) => acc + Number(s.price), 0);
      const totalDevCommission = form.services.reduce((acc, s) => acc + Number(s.devCommission), 0);

      await setDoc(doc(db, 'missions', id), {
        id,
        title: form.title,
        description: form.description,
        services: form.services,
        // Mantain legacy fields for backward compatibility
        serviceType: form.services[0].id,
        serviceName: form.services.length > 1 ? `${form.services[0].name} +${form.services.length - 1} services` : form.services[0].name,
        servicePrice: totalServicePrice,
        devCommission: totalDevCommission,
        assignedTo: form.assignedTo,
        assignedToName: `${dev?.firstName || ''} ${dev?.lastName || ''}`.trim() || dev?.email || '',
        clientId: form.clientId,
        clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || client?.email || '',
        priority: form.priority,
        deadline: form.deadline,
        status: 'en_attente',
        createdAt: new Date().toISOString(),
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: form.assignedTo,
        title: 'Nouvelle mission assignée',
        message: `${form.title}. Services : ${form.services.length}. Commission totale : ${totalDevCommission.toLocaleString()} FCFA`,
        type: 'mission',
        read: false,
        createdAt: new Date().toISOString(),
      });

      toast.success('Mission créée !');
      setIsModalOpen(false);
      setForm({ title: '', assignedTo: '', clientId: '', deadline: '', description: '', priority: 'moyenne', services: [] });
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMission) return;
    
    const servicesArray = editingMission.services || [];
    const totalServicePrice = servicesArray.reduce((acc: number, s: any) => acc + Number(s.price), 0);
    const totalDevCommission = servicesArray.reduce((acc: number, s: any) => acc + Number(s.devCommission), 0);

    setIsSubmitting(true);
    try {
      const dev = developers.find(d => d.id === editingMission.assignedTo);
      const client = clients.find(c => c.id === editingMission.clientId);

      await updateDoc(doc(db, 'missions', editingMission.id), {
        title: editingMission.title,
        description: editingMission.description,
        services: servicesArray,
        assignedTo: editingMission.assignedTo,
        assignedToName: `${dev?.firstName || ''} ${dev?.lastName || ''}`.trim() || dev?.email || '',
        clientId: editingMission.clientId,
        clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || client?.email || '',
        priority: editingMission.priority,
        deadline: editingMission.deadline,
        // Update totals for legacy support
        servicePrice: totalServicePrice,
        devCommission: totalDevCommission,
        serviceName: servicesArray.length > 0 
          ? (servicesArray.length > 1 ? `${servicesArray[0].name} +${servicesArray.length - 1}` : servicesArray[0].name)
          : 'Service personnalisé'
      });

      toast.success('Mission mise à jour !');
      setIsEditModalOpen(false);
      setEditingMission(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer la mission "${title}" ?`)) return;
    try {
      await deleteDoc(doc(db, 'missions', id));
      toast.success('Mission supprimée.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const addServiceToMission = (serviceId: string, isEditing: boolean = false) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const newService = {
      id: service.id,
      name: service.name,
      price: service.price,
      devCommission: service.devCommission,
      instanceId: crypto.randomUUID() // To allow multiple instances of same service
    };

    if (isEditing) {
      setEditingMission({
        ...editingMission,
        services: [...(editingMission.services || []), newService]
      });
    } else {
      setForm({
        ...form,
        services: [...form.services, newService]
      });
    }
  };

  const removeServiceFromMission = (instanceId: string, isEditing: boolean = false) => {
    if (isEditing) {
      setEditingMission({
        ...editingMission,
        services: editingMission.services.filter((s: any) => s.instanceId !== instanceId)
      });
    } else {
      setForm({
        ...form,
        services: form.services.filter((s: any) => s.instanceId !== instanceId)
      });
    }
  };

  const updateServiceInMission = (instanceId: string, field: 'price' | 'devCommission', value: number, isEditing: boolean = false) => {
    if (isEditing) {
      setEditingMission({
        ...editingMission,
        services: editingMission.services.map((s: any) => 
          s.instanceId === instanceId ? { ...s, [field]: value } : s
        )
      });
    } else {
      setForm({
        ...form,
        services: form.services.map((s: any) => 
          s.instanceId === instanceId ? { ...s, [field]: value } : s
        )
      });
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const id = serviceForm.name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'service_catalog', id), {
        id,
        name: serviceForm.name,
        price: Number(serviceForm.price),
        devCommission: Number(serviceForm.devCommission),
        updatedAt: new Date().toISOString()
      });
      toast.success('Service ajouté au catalogue !');
      setIsServiceModalOpen(false);
      setServiceForm({ name: '', price: 0, devCommission: 0 });
    } catch (err) {
      toast.error('Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'service_catalog', editingService.id), {
        name: serviceForm.name,
        price: Number(serviceForm.price),
        devCommission: Number(serviceForm.devCommission),
        updatedAt: new Date().toISOString()
      });
      toast.success('Catalogue mis à jour !');
      setIsServiceModalOpen(false);
      setEditingService(null);
      setServiceForm({ name: '', price: 0, devCommission: 0 });
    } catch (err) {
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Supprimer le service "${name}" du catalogue ?`)) return;
    try {
      await deleteDoc(doc(db, 'service_catalog', id));
      toast.success('Service supprimé.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleValidate = async (mission: any) => {
    setValidating(mission.id);
    try {
      await updateDoc(doc(db, 'missions', mission.id), {
        status: 'termine',
        validatedAt: new Date().toISOString(),
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: mission.assignedTo,
        title: '✅ Mission validée — Commission créditée !',
        message: `"${mission.title}" (${mission.serviceName || ''}) validée. Votre commission de ${(mission.devCommission || 0).toLocaleString()} FCFA a été créditée.`,
        type: 'mission',
        read: false,
        createdAt: new Date().toISOString(),
      });

      toast.success('Mission validée ! Commission créditée au développeur.');
    } catch {
      toast.error('Erreur lors de la validation.');
    } finally {
      setValidating(null);
    }
  };

  const filtered = missions.filter(m => {
    const matchSearch = !search ||
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      (m.assignedToName || getDevName(m.assignedTo))?.toLowerCase().includes(search.toLowerCase()) ||
      m.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || m.status === filterStatus;
    const matchService = !filterService || m.serviceType === filterService;
    return matchSearch && matchStatus && matchService;
  });

  const statsPerService = services.map(s => ({
    ...s,
    total: missions.filter(m => m.serviceType === s.id).length,
    validated: missions.filter(m => m.serviceType === s.id && m.status === 'termine').length,
    totalCommissions: missions
      .filter(m => m.serviceType === s.id && m.status === 'termine')
      .reduce((acc, m) => acc + (m.devCommission || 0), 0),
  }));

  const totalPending = missions.filter(m => m.status === 'en_revue').length;
  const totalCommissions = missions
    .filter(m => m.status === 'termine')
    .reduce((acc, m) => acc + (m.devCommission || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Missions Développeurs</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">
            Orchestration technique, validation des livrables et gestion des commissions
          </p>
        </div>
        <div className="flex items-center gap-4">
          {totalPending > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-noya-purple/10 text-noya-purple border border-noya-purple/20 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
              <AlertCircle size={14} /> {totalPending} REVUE EN ATTENTE
            </div>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)]"
          >
            <Plus size={18} /> Nouvelle Mission
          </button>
        </div>
      </div>

      {/* Grille tarifaire */}
      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-noya-orange rounded-full"></div>
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">Grille Tarifaire & Commissions</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setEditingService(null);
                setServiceForm({ name: '', price: 0, devCommission: 0 });
                setIsServiceModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-primary hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-border-subtle"
            >
              <Plus size={14} /> Ajouter un service
            </button>
            <div className="bg-noya-green/10 border border-noya-green/20 rounded-xl px-4 py-2">
              <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest mr-2">Flux Total Commissions :</span>
              <span className="text-sm font-black text-noya-green">{totalCommissions.toLocaleString()} FCFA</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">Service Spécifié</th>
                <th className="p-4 text-right">Prix Catalogue</th>
                <th className="p-4 text-right">Rétribution Dev</th>
                <th className="p-4 text-right whitespace-nowrap">Volume / Conv.</th>
                <th className="p-4 text-right">Total Crédité</th>
                <th className="p-4 text-right">Gestion</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {statsPerService.map(s => (
                <tr key={s.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                  <td className="p-4 font-bold text-text-primary group-hover:text-noya-blue transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-noya-blue/30 group-hover:bg-noya-blue transition-colors"></div>
                      {s.name}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 group/price text-text-primary px-3 py-1 bg-surface-primary border border-border-subtle rounded-lg w-fit ml-auto">
                      <span className="font-black text-noya-blue text-xs">{s.price.toLocaleString()}</span>
                      <span className="text-[10px] text-text-muted font-bold">FCFA</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 group/price text-text-primary px-3 py-1 bg-surface-primary border border-border-subtle rounded-lg w-fit ml-auto">
                      <span className="font-black text-noya-green text-xs">{s.devCommission.toLocaleString()}</span>
                      <span className="text-[10px] text-text-muted font-bold">FCFA</span>
                    </div>
                  </td>
                  <td className="p-4 text-right text-text-secondary/60 font-mono">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-text-primary font-bold bg-surface-tertiary px-2 py-0.5 rounded text-[10px]">{s.total}</span>
                      <span className="opacity-30">→</span>
                      <span className="text-noya-green font-bold bg-noya-green/10 px-2 py-0.5 rounded text-[10px]">{s.validated}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-black text-noya-green text-sm flex flex-col items-end">
                      <span>{s.totalCommissions.toLocaleString()}</span>
                      <span className="text-[8px] uppercase tracking-widest opacity-50">Volume Total</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setEditingService(s);
                          setServiceForm({ name: s.name, price: s.price, devCommission: s.devCommission });
                          setIsServiceModalOpen(true);
                        }}
                        className="p-2 text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl transition-all"
                        title="Ajuster les tarifs"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteService(s.id, s.name)}
                        className="p-2 text-text-muted hover:text-noya-red hover:bg-noya-red/10 rounded-xl transition-all"
                        title="Révoquer le service"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liste des missions */}
      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Indexer par ID, client ou développeur..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary focus:ring-2 focus:ring-noya-blue outline-none cursor-pointer"
          >
            <option value="">Tout Statut</option>
            <option value="en_attente">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="en_revue">En revue</option>
            <option value="termine">Terminé</option>
            <option value="annule">Annulé</option>
          </select>
          <select
            value={filterService}
            onChange={e => setFilterService(e.target.value)}
            className="px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary focus:ring-2 focus:ring-noya-blue outline-none cursor-pointer"
          >
            <option value="">Tout Service</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{filtered.length} Résultat(s)</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune mission trouvée.</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">Désignation / ID</th>
                <th className="p-4">Expert Technique</th>
                <th className="p-4 text-right">Rémunération</th>
                <th className="p-4">Badge Statut</th>
                <th className="p-4">Livrable</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map(mission => (
                <tr key={mission.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                  <td className="p-4">
                    <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors leading-tight">{mission.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-text-muted bg-surface-primary px-2 py-0.5 rounded border border-border-subtle">{mission.id}</span>
                      <span className="text-[10px] text-text-dim font-medium italic">Client: {mission.clientName || '—'}</span>
                    </div>
                    {mission.progressNote && (
                      <div className="text-[10px] text-noya-blue mt-1.5 italic font-medium opacity-80 leading-relaxed">
                        <span className="p-1 px-2 bg-noya-blue/10 rounded mr-2 uppercase text-[8px] font-black tracking-widest">Note :</span>
                        "{mission.progressNote}"
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-text-primary text-xs tracking-tight">{mission.assignedToName || getDevName(mission.assignedTo)}</div>
                    <div className="text-[10px] text-text-secondary/50 font-black uppercase mt-1 tracking-tighter">{mission.serviceName || 'Service Custom'}</div>
                  </td>
                  <td className="p-4 text-right">
                    {mission.devCommission ? (
                      <div className="flex flex-col items-end">
                        <span className={`font-black tracking-tighter ${mission.status === 'termine' ? 'text-noya-green' : 'text-text-muted'}`}>
                          {mission.devCommission.toLocaleString()} <span className="text-[10px]">FCFA</span>
                        </span>
                        <div className="w-12 h-1 bg-surface-tertiary rounded-full mt-1 overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${mission.status === 'termine' ? 'w-full bg-noya-green' : 'w-1/3 bg-noya-orange'}`}></div>
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner ${STATUS_COLORS[mission.status] || 'bg-surface-tertiary text-text-secondary'}`}>
                      {STATUS_LABELS[mission.status] || mission.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {mission.deliveryUrl ? (
                      <a
                        href={mission.deliveryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-noya-blue/10 text-noya-blue rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-noya-blue hover:text-noya-black transition-all border border-noya-blue/20"
                      >
                        <ExternalLink size={12} /> Live Link
                      </a>
                    ) : (
                      <span className="text-[10px] text-text-dim uppercase font-black tracking-widest italic whitespace-nowrap">En production</span>
                    )}
                  </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {mission.status === 'en_revue' && (
                          <button
                            onClick={() => handleValidate(mission)}
                            disabled={validating === mission.id}
                            className="flex items-center gap-2 px-4 py-2 bg-noya-green text-noya-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            {validating === mission.id ? 'Indexing' : 'Valider'}
                          </button>
                        )}
                        {mission.status !== 'termine' && (
                          <button
                            onClick={() => {
                              setEditingMission(mission);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 transition-all text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                            title="Configurer"
                          >
                            <Edit2 size={16} className="group-hover/btn:scale-110 transition-all" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(mission.id, mission.title)}
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
        )}
      </div>

      {/* Modal création */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50 shrink-0">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Nouveau Dossier Technique</h2>
              <button onClick={closeCreateModal} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Libellé de la mission *</label>
                <input
                  type="text" required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Refonte Dashboard Multi-Tenancy"
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Classification Service *</label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">Stack de Services *</label>
                  <div className="flex items-center gap-2">
                    <select
                      className="px-3 py-1.5 bg-surface-primary border border-border-subtle rounded-lg text-[10px] font-bold outline-none cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) {
                          addServiceToMission(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">+ Ajouter un module</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {form.services.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-border-subtle rounded-2xl text-center text-[10px] font-black text-text-dim uppercase tracking-widest italic bg-surface-primary/30">
                      Aucun service indexé. Ajoutez une brique technique.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {form.services.map((s: any) => (
                        <div key={s.instanceId} className="p-4 bg-surface-primary border border-border-subtle rounded-2xl relative group/item">
                          <button
                            type="button"
                            onClick={() => removeServiceFromMission(s.instanceId)}
                            className="absolute -top-2 -right-2 p-1.5 bg-noya-red text-white rounded-full shadow-lg opacity-0 group-hover/item:opacity-100 transition-all hover:scale-110 active:scale-90"
                          >
                            <X size={12} />
                          </button>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black text-noya-blue uppercase tracking-tight">{s.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] font-black text-text-dim uppercase tracking-widest mb-1.5 opacity-50">Client Override (FCFA)</label>
                              <input
                                type="number"
                                value={s.price}
                                onChange={e => updateServiceInMission(s.instanceId, 'price', Number(e.target.value))}
                                className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-xs text-text-primary font-bold outline-none focus:border-noya-blue transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-text-dim uppercase tracking-widest mb-1.5 opacity-50">Dev Commission (FCFA)</label>
                              <input
                                type="number"
                                value={s.devCommission}
                                onChange={e => updateServiceInMission(s.instanceId, 'devCommission', Number(e.target.value))}
                                className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-xs text-noya-green font-bold outline-none focus:border-noya-green transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {form.services.length > 0 && (
                  <div className="p-4 bg-surface-primary/50 border border-border-subtle rounded-2xl flex justify-between items-center text-[10px] font-black uppercase tracking-widest shadow-inner">
                    <div className="space-y-1">
                      <p className="text-text-dim">Facturation Totale</p>
                      <p className="text-sm text-noya-blue">{form.services.reduce((acc: number, s: any) => acc + Number(s.price), 0).toLocaleString()} FCFA</p>
                    </div>
                    <div className="h-8 w-px bg-border-subtle"></div>
                    <div className="space-y-1 text-right">
                      <p className="text-text-dim">Masse Salariale Dev</p>
                      <p className="text-sm text-noya-green">{form.services.reduce((acc: number, s: any) => acc + Number(s.devCommission), 0).toLocaleString()} FCFA</p>
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Technicien Assigné *</label>
                  <select
                    required value={form.assignedTo}
                    onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="">Sélectionner un dev</option>
                    {developers.map(d => (
                      <option key={d.id} value={d.id}>
                        {`${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Identité Client *</label>
                  <select
                    required value={form.clientId}
                    onChange={e => setForm({ ...form, clientId: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="">Sélectionner un compte</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Priorité Opérationnelle</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="basse">Basse</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute 🔥</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Échéance Finale</label>
                  <input
                    type="date" value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Missions & Instructions Techniques</label>
                <textarea
                  value={form.description} rows={3}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Définition du cadre d'intervention..."
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium resize-none shadow-inner"
                />
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button
                  type="button" onClick={closeCreateModal}
                  className="flex-1 px-8 py-4 text-text-secondary font-black uppercase tracking-widest hover:text-text-primary transition-all"
                >
                  Avorter
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="flex-1 px-8 py-4 bg-noya-blue text-noya-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Déploiement...' : 'Déployer la mission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Edition */}
      {isEditModalOpen && editingMission && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50 shrink-0">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">Ajustement Mission</h2>
              <button 
                onClick={closeEditModal}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-4 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Titre du Site / Projet *</label>
                <input
                  type="text" required value={editingMission.title}
                  onChange={e => setEditingMission({ ...editingMission, title: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">Stack de Services Actuelle</label>
                  <div className="flex items-center gap-2">
                    <select
                      className="px-3 py-1.5 bg-surface-primary border border-border-subtle rounded-lg text-[10px] font-bold outline-none cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) {
                          addServiceToMission(e.target.value, true);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">+ Injecter un module</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {(editingMission.services || []).length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-border-subtle rounded-2xl text-center text-[10px] font-black text-text-dim uppercase tracking-widest italic bg-surface-primary/30">
                      Rupture de services. Ajoutez une brique technique.
                    </div>
                  ) : (
                    editingMission.services.map((s: any) => (
                      <div key={s.instanceId || s.id} className="p-4 bg-surface-primary border border-border-subtle rounded-2xl relative group/item">
                        <button
                          type="button"
                          onClick={() => removeServiceFromMission(s.instanceId || s.id, true)}
                          className="absolute -top-2 -right-2 p-1.5 bg-noya-red text-white rounded-full shadow-lg opacity-0 group-hover/item:opacity-100 transition-all hover:scale-110 active:scale-90"
                        >
                          <X size={12} />
                        </button>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-noya-blue uppercase tracking-tight">{s.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[8px] font-black text-text-dim uppercase tracking-widest mb-1.5 opacity-50">Rev. Client (FCFA)</label>
                            <input
                              type="number"
                              value={s.price}
                              onChange={e => updateServiceInMission(s.instanceId || s.id, 'price', Number(e.target.value), true)}
                              className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-xs text-text-primary font-bold outline-none focus:border-noya-blue transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-black text-text-dim uppercase tracking-widest mb-1.5 opacity-50">Rev. Dev (FCFA)</label>
                            <input
                              type="number"
                              value={s.devCommission}
                              onChange={e => updateServiceInMission(s.instanceId || s.id, 'devCommission', Number(e.target.value), true)}
                              className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-xs text-noya-green font-bold outline-none focus:border-noya-green transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {(editingMission.services || []).length > 0 && (
                  <div className="p-4 bg-surface-primary/50 border border-border-subtle rounded-2xl flex justify-between items-center text-[10px] font-black uppercase tracking-widest shadow-inner">
                    <div className="space-y-1">
                      <p className="text-text-dim">Facturation Totale</p>
                      <p className="text-sm text-noya-blue">{editingMission.services.reduce((acc: number, s: any) => acc + Number(s.price), 0).toLocaleString()} FCFA</p>
                    </div>
                    <div className="h-8 w-px bg-border-subtle"></div>
                    <div className="space-y-1 text-right">
                      <p className="text-text-dim">Total Dev</p>
                      <p className="text-sm text-noya-green">{editingMission.services.reduce((acc: number, s: any) => acc + Number(s.devCommission), 0).toLocaleString()} FCFA</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Réassignation Technicien *</label>
                <select
                  required value={editingMission.assignedTo}
                  onChange={e => setEditingMission({ ...editingMission, assignedTo: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                >
                  {developers.map(d => (
                    <option key={d.id} value={d.id}>
                      {`${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Propriétaire du Projet *</label>
                <select
                  required value={editingMission.clientId}
                  onChange={e => setEditingMission({ ...editingMission, clientId: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Urgence Opérationnelle</label>
                  <select
                    value={editingMission.priority}
                    onChange={e => setEditingMission({ ...editingMission, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="basse">Basse</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute 🔥</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Date Limite de Livraison</label>
                  <input
                    type="date" value={editingMission.deadline}
                    onChange={e => setEditingMission({ ...editingMission, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Instructions de Mise à Jour</label>
                <textarea
                  value={editingMission.description} rows={3}
                  onChange={e => setEditingMission({ ...editingMission, description: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium resize-none shadow-inner"
                />
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button
                  type="button" 
                  onClick={closeEditModal}
                  className="flex-1 px-8 py-4 text-text-secondary font-black uppercase tracking-widest hover:text-text-primary transition-all"
                >
                  Abandonner
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="flex-1 px-8 py-4 bg-noya-blue text-noya-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Synchronisation...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Service Catalog */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 bg-noya-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border-medium animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
              <h2 className="text-xl font-black text-text-primary uppercase tracking-widest">
                {editingService ? 'Ajuster Service' : 'Nouveau Service'}
              </h2>
              <button 
                onClick={closeServiceModal} 
                className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={editingService ? handleUpdateService : handleCreateService} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Nom du Service *</label>
                <input
                  type="text" required
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="Ex: Landing Page Premium"
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Prix Catalogue (FCFA) *</label>
                <input
                  type="number" required
                  value={serviceForm.price}
                  onChange={e => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Rétribution Développeur (FCFA) *</label>
                <input
                  type="number" required
                  value={serviceForm.devCommission}
                  onChange={e => setServiceForm({ ...serviceForm, devCommission: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeServiceModal}
                  className="flex-1 px-6 py-3 text-text-secondary font-black uppercase tracking-widest hover:text-text-primary transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-noya-blue text-noya-black rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Sync...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
