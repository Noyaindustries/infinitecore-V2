import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Upload,
  Bell,
  FileText,
  Image as ImageIcon,
  Code,
  CheckCircle,
  Clock,
  X,
  Download,
  Trash2,
  BookOpen,
  Plus,
  Users,
  KanbanSquare,
  FolderOpen,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, orderBy, doc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile } from '../../services/uploadService';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { missionService, Mission } from '../../services/missionService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatFileSize } from '../../lib/formatFileSize';
import { cn } from '../../lib/utils';

/** Étiquette bibliothèque dérivée du fichier (affichage / filtre cartes). */
function inferResourceLabel(file: File): string {
  const ext = (file.name.split('.').pop() || '').toUpperCase();
  if (file.type.startsWith('image/')) return 'IMG';
  if (file.type.startsWith('video/')) return 'MP4';
  if (file.type === 'application/pdf' || ext === 'PDF') return 'PDF';
  if (['DOC', 'DOCX'].includes(ext)) return 'DOCX';
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return 'XLSX';
  if (['PPT', 'PPTX'].includes(ext)) return 'PPTX';
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return 'ZIP';
  if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext)) return 'IMG';
  if (ext && ext.length <= 8) return ext;
  return 'FILE';
}

export default function Operations() {
  const [activeTab, setActiveTab] = useState<'fichiers' | 'notifications' | 'developpeurs' | 'ressources'>('fichiers');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState('PDF');
  const [resourceSelectedFile, setResourceSelectedFile] = useState<File | null>(null);
  const [resourceDropActive, setResourceDropActive] = useState(false);
  const [resources, setResources] = useState<any[]>([]);
  const [resourceUploadProgress, setResourceUploadProgress] = useState<number | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ devId: '', title: '', clientId: '', deadline: '' });
  const [missions, setMissions] = useState<Mission[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileSearch, setFileSearch] = useState('');

  useEffect(() => {
    // Subscribe to missions
    const unsubscribeMissions = missionService.subscribeToAllMissions((data) => {
      setMissions(data);
      setIsLoading(false);
    });

    // Subscribe to files/documents
    const unsubscribeFiles = onSnapshot(
      query(collection(db, 'documents'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setFiles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'documents')
    );

    // Subscribe to notifications (all, for admin view)
    const unsubscribeNotifs = onSnapshot(
      query(collection(db, 'notifications'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; role?: string }));
      setDevelopers(rows.filter((u) => String(u.role || '').toLowerCase() === 'developer'));
      setClients(rows.filter((u) => String(u.role || '').toLowerCase() === 'client'));
    });

    const unsubscribeResources = onSnapshot(
      query(collection(db, 'resources'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setResources(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'resources')
    );

    return () => {
      unsubscribeMissions();
      unsubscribeFiles();
      unsubscribeNotifs();
      unsubscribeUsers();
      unsubscribeResources();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const result = await uploadFile(file, 'documents', (pct) => setUploadProgress(pct));
      await addDoc(collection(db, 'documents'), {
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.url,
        storagePath: result.publicId,
        createdAt: new Date().toISOString(),
        source: 'commando',
      });
      toast.success(`${file.name} chargé avec succès !`);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement du fichier.');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: any) => {
    try {
      await deleteDoc(doc(db, 'documents', file.id));
      toast.success('Fichier supprimé.');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const resetResourceInjectForm = () => {
    setResourceTitle('');
    setResourceDescription('');
    setResourceType('PDF');
    setResourceSelectedFile(null);
    setResourceDropActive(false);
    setResourceUploadProgress(null);
    if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
  };

  const openResourceModal = () => {
    resetResourceInjectForm();
    setIsResourceModalOpen(true);
  };

  const closeResourceModal = () => {
    resetResourceInjectForm();
    setIsResourceModalOpen(false);
  };

  const onResourceFilePicked = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setResourceSelectedFile(file);
    setResourceType(inferResourceLabel(file));
  };

  const onResourceFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onResourceFilePicked(e.target.files);
    e.target.value = '';
  };

  const handleResourceInject = async () => {
    const title = resourceTitle.trim();
    if (!title) {
      toast.error('Indiquez un titre pour la ressource.');
      return;
    }
    if (!resourceSelectedFile) {
      toast.error('Ajoutez un fichier (glisser-déposer ou parcourir).');
      return;
    }
    const file = resourceSelectedFile;
    setResourceUploadProgress(0);
    try {
      const result = await uploadFile(file, 'resources', (pct) => setResourceUploadProgress(pct));
      const resId = `RES-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const desc = resourceDescription.trim();
      await setDoc(doc(db, 'resources', resId), {
        id: resId,
        title,
        ...(desc ? { description: desc } : {}),
        fileType: resourceType || inferResourceLabel(file),
        url: result.url,
        storagePath: result.publicId,
        size: formatFileSize(file.size) || '—',
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });
      toast.success('Ressource injectée dans la bibliothèque.');
      closeResourceModal();
    } catch (err) {
      console.error('[Operations] inject resource:', err);
      toast.error("Impossible d'injecter la ressource. Vérifiez le fichier et réessayez.");
    } finally {
      setResourceUploadProgress(null);
    }
  };

  const handleDeleteResource = async (resource: any) => {
    if (!window.confirm(`Supprimer la ressource "${resource.title}" ?`)) return;
    try {
      await deleteDoc(doc(db, 'resources', resource.id));
      toast.success('Ressource supprimée.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.devId || !newAssignment.title || !newAssignment.clientId) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }

    try {
      await missionService.createMission({
        title: newAssignment.title,
        clientId: newAssignment.clientId,
        assignedTo: newAssignment.devId,
        status: 'en_cours',
        priority: 'moyenne',
        type: 'implementation',
        deadline: newAssignment.deadline,
      } as any);

      toast.success('Mission assignée avec succès !');
      setIsAssignModalOpen(false);
      setNewAssignment({ devId: '', title: '', clientId: '', deadline: '' });
    } catch (error) {
      toast.error("Erreur lors de l'assignation.");
    }
  };

  const getDevName = (devId?: string) => {
    if (!devId) return 'Non assigné';
    const dev = developers.find(d => d.id === devId);
    return dev ? `${dev.firstName || ''} ${dev.lastName || ''}`.trim() || dev.email : 'Inconnu';
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email : 'Client Inconnu';
  };

  const formatMissionDeadline = (deadline?: string) => {
    if (!deadline?.trim()) return 'Indéterminé';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return 'Indéterminé';
    return format(d, 'dd MMM yyyy', { locale: fr });
  };

  const opsStats = useMemo(
    () => ({
      files: files.length,
      unreadNotifs: notifications.filter((n) => !n.read).length,
      missionsEnCours: missions.filter((m) => m.status === 'en_cours').length,
      resources: resources.length,
    }),
    [files, notifications, missions, resources]
  );

  const filteredFiles = files.filter(f =>
    !fileSearch || f.name?.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 md:px-8 md:py-10 pb-20">
      <div className="flex flex-col gap-6 border-b border-white/6 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="commando-luxe-ornament-diamond mt-1.5 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-luxe-champagne-bright/85">Infinite Commando</p>
            <h1 className="mt-1 font-display text-3xl font-normal tracking-tight text-text-primary md:text-4xl">Opérations</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Archives partagées, flux d’alertes, missions développeurs et bibliothèque ressources — centre logistique de l’atelier.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:border-luxe-champagne/30 hover:text-luxe-champagne-bright"
          >
            Tableau de bord
            <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/30 bg-luxe-champagne/10 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-luxe-champagne-bright transition-all hover:border-luxe-champagne/45 disabled:opacity-50"
          >
            <Upload size={16} aria-hidden />
            {uploadProgress !== null ? `${uploadProgress}%` : 'Nouveau fichier'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/pipeline"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-noya-sidebar/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:border-noya-blue/35 hover:text-noya-blue"
        >
          <KanbanSquare className="h-3.5 w-3.5" aria-hidden />
          Pipeline
        </Link>
        <Link
          to="/admin/dossiers"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-noya-sidebar/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:border-luxe-champagne/35 hover:text-luxe-champagne-bright"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Dossiers clients
        </Link>
        <Link
          to="/admin/clients"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-noya-sidebar/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:border-luxe-champagne/35 hover:text-luxe-champagne-bright"
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          CRM
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-text-dim">Archives</p>
          <p className="mt-2 font-display text-2xl text-luxe-champagne-bright">{opsStats.files}</p>
          <p className="mt-1 text-[11px] text-text-muted">Documents partagés</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-text-dim">Alertes non lues</p>
          <p className="mt-2 font-display text-2xl text-noya-orange">{opsStats.unreadNotifs}</p>
          <p className="mt-1 text-[11px] text-text-muted">Sur le flux global</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-text-dim">Missions actives</p>
          <p className="mt-2 font-display text-2xl text-noya-blue">{opsStats.missionsEnCours}</p>
          <p className="mt-1 text-[11px] text-text-muted">Statut « en cours »</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-text-dim">Ressources</p>
          <p className="mt-2 font-display text-2xl text-text-primary">{opsStats.resources}</p>
          <p className="mt-1 text-[11px] text-text-muted">Bibliothèque</p>
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-linear-to-r from-luxe-champagne/80 to-noya-blue transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <div className="commando-luxe-hero-shell relative overflow-hidden rounded-2xl border border-luxe-champagne/15 bg-noya-sidebar/45 backdrop-blur-md">
        <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="relative border-b border-white/8 bg-black/15 px-4 py-4 md:px-6">
          <div className="tabs-scroll-container flex gap-2 pb-1 sm:gap-6">
            {(['fichiers', 'notifications', 'developpeurs', 'ressources'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'tab-button-nowrap relative pb-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
                  activeTab === tab
                    ? 'text-luxe-champagne-bright'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {tab === 'fichiers'
                  ? 'Archives'
                  : tab === 'notifications'
                    ? `Alertes${notifications.length > 0 ? ` (${notifications.length})` : ''}`
                    : tab === 'developpeurs'
                      ? 'Missions dev'
                      : `Ressources (${resources.length})`}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTabOp"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-luxe-champagne to-noya-blue shadow-[0_0_12px_rgba(201,169,98,0.4)]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          {activeTab === 'fichiers' && (
            <div className="space-y-8">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher une archive..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-surface-primary border border-border-subtle rounded-2xl focus:outline-none focus:ring-2 focus:ring-noya-blue/50 text-sm font-medium shadow-inner"
                />
              </div>

              {filteredFiles.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" aria-hidden />
                  <p className="text-sm">Aucun fichier. Utilisez « Nouveau fichier » ci-dessus pour déposer une archive.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFiles.map((file, i) => {
                    const isImage = file.type?.startsWith('image/');
                    return (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border border-border-subtle rounded-2xl p-5 hover:border-noya-blue/30 transition-all bg-surface-primary group relative shadow-sm"
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isImage ? 'bg-noya-orange/10 text-noya-orange' : 'bg-noya-blue/10 text-noya-blue'} shadow-inner`}>
                          {isImage ? <ImageIcon size={24} /> : <FileText size={24} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-text-primary text-[11px] uppercase tracking-wider mb-1 truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <p className="text-[10px] text-text-muted font-bold mb-4 uppercase tracking-widest">
                            Chargé le {new Date(file.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                          <div className="flex justify-between items-center bg-surface-secondary/50 p-2 rounded-xl border border-border-subtle shadow-inner">
                            <span className="text-[10px] font-black font-mono text-text-muted px-2 py-1 uppercase">
                              {formatFileSize(file.size) || '—'}
                            </span>
                            <div className="flex gap-2">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-noya-blue/10 text-noya-blue hover:bg-noya-blue hover:text-white transition-all shadow-sm"
                                title="Télécharger"
                              >
                                <Download size={14} />
                              </a>
                              <button
                                onClick={() => handleDeleteFile(file)}
                                className="p-2 rounded-lg bg-red-400/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4 max-w-4xl">
              <p className="text-[10px] text-text-dim font-black uppercase tracking-[0.2em] mb-4">
                Flux d'alertes temps réel — {notifications.length} événement{notifications.length !== 1 ? 's' : ''} indexé{notifications.length !== 1 ? 's' : ''}
              </p>
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-text-dim italic font-black uppercase text-[10px] tracking-widest leading-loose">
                  <Bell size={48} className="mx-auto mb-4 opacity-10" />
                  Aucun signal détecté sur le canal.
                </div>
              ) : (
                notifications.slice(0, 50).map((notif, i) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-5 p-5 border rounded-2xl transition-all shadow-sm ${
                      notif.read 
                        ? 'bg-surface-primary/30 border-border-subtle opacity-80' 
                        : 'bg-noya-blue/5 border-noya-blue/20 ring-1 ring-noya-blue/10 shadow-lg shadow-noya-blue/5'
                    }`}
                  >
                    <div className={`p-3 rounded-xl mt-0.5 shadow-inner ${notif.read ? 'bg-surface-tertiary text-text-muted' : 'bg-noya-blue/10 text-noya-blue'}`}>
                      <Bell size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-text-primary text-[11px] uppercase tracking-wider">{notif.title || 'Notification Système'}</h4>
                        {!notif.read && <span className="w-2 h-2 bg-noya-orange rounded-full shadow-[0_0_8px_rgba(255,179,50,0.8)]" />}
                      </div>
                      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed font-medium">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-4">
                        <Clock size={10} className="text-text-dim" />
                        <p className="text-[9px] text-text-dim font-black uppercase tracking-widest italic opacity-50">
                          {notif.createdAt ? format(new Date(notif.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr }) : ''}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ressources' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <p className="text-[10px] text-text-dim font-black uppercase tracking-[0.2em]">
                    Bibliothèque Opérationnelle — {resources.length} ressource{resources.length !== 1 ? 's' : ''} disponible{resources.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 font-medium opacity-60">Documents stratégiques pour les partenaires et unités de développement.</p>
                </div>
                <button
                  type="button"
                  onClick={openResourceModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/35 bg-luxe-champagne/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-luxe-champagne-bright shadow-[0_12px_40px_-24px_rgba(201,169,98,0.35)] transition-all hover:border-luxe-champagne/55 hover:bg-luxe-champagne/15"
                >
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                  Injecter ressource
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.length > 0 ? (
                  resources.map((res, i) => (
                    <motion.div
                      key={res.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-surface-primary/30 border border-border-subtle rounded-2xl p-6 hover:bg-surface-primary/60 transition-all group shadow-sm flex flex-col justify-between h-full"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 rounded-xl bg-noya-orange/10 text-noya-orange border border-noya-orange/20 shadow-inner group-hover:scale-110 transition-transform">
                            {res.fileType === 'IMG' ? <ImageIcon size={20} /> : <BookOpen size={20} />}
                          </div>
                          <div className="flex gap-2">
                            <a 
                              href={res.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-tertiary rounded-xl transition-all border border-transparent hover:border-border-subtle"
                            >
                              <Download size={18} />
                            </a>
                            <button
                              onClick={() => handleDeleteResource(res)}
                              className="p-2.5 text-text-muted hover:text-noya-red hover:bg-noya-red/10 rounded-xl transition-all border border-transparent hover:border-border-subtle"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-black text-text-primary text-[13px] uppercase tracking-tight mb-2 group-hover:text-noya-orange transition-colors">{res.title}</h4>
                        {res.description ? (
                          <p className="text-xs font-medium leading-relaxed text-text-secondary line-clamp-2">{res.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border-subtle/50 text-[10px] text-text-dim font-black uppercase tracking-widest opacity-60">
                         <span className="flex items-center gap-1.5"><FileText size={12} /> {res.fileType}</span>
                         <span className="flex items-center gap-1.5"><Clock size={12} /> {res.size}</span>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 text-text-dim italic font-black uppercase text-[10px] tracking-widest leading-loose">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-10" />
                    Aucune ressource stratégique indexée.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'developpeurs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <p className="text-[10px] text-text-dim font-black uppercase tracking-[0.2em]">
                    Logistique Développeurs — {missions.length} mission{missions.length !== 1 ? 's' : ''} déployée{missions.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 font-medium opacity-60">Gestion et assignation des unités de réalisation technique.</p>
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="flex items-center justify-center gap-3 bg-noya-orange text-noya-black px-6 py-3 rounded-2xl hover:scale-105 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-noya-orange/20"
                >
                  <Plus size={16} /> Déployer mission
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isLoading ? (
                  <div className="col-span-full flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-noya-blue"></div>
                  </div>
                ) : missions.length > 0 ? (
                  missions.map((mission, i) => (
                    <motion.div
                      key={mission.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-surface-primary/30 border border-border-subtle rounded-2xl p-6 hover:bg-surface-primary/60 transition-all group shadow-sm flex flex-col gap-6"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-noya-blue/10 border border-noya-blue/20 flex items-center justify-center font-black text-noya-blue uppercase text-sm shadow-inner group-hover:scale-105 transition-transform">
                            {getDevName(mission.assignedTo).charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-black text-text-primary uppercase tracking-tight text-[13px] group-hover:text-noya-blue transition-colors">{getDevName(mission.assignedTo)}</h4>
                            <p className="text-[10px] text-text-dim font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                              <Code size={12} className="opacity-50" /> Unité de Développement
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-inner
                          ${mission.status === 'en_cours' ? 'bg-noya-blue/10 text-noya-blue border-noya-blue/20' :
                            mission.status === 'termine' ? 'bg-noya-green/10 text-noya-green border-noya-green/20' :
                            'bg-surface-tertiary text-text-muted border-border-subtle'}`}
                        >
                          {mission.status === 'en_cours' ? 'Traitement' :
                           mission.status === 'termine' ? 'Validé' :
                           mission.status === 'en_attente' ? 'Ready' : 'Avorté'}
                        </span>
                      </div>

                      <div className="bg-surface-primary/50 p-4 rounded-xl border border-border-subtle shadow-inner">
                        <h5 className="font-black text-text-primary text-[11px] uppercase tracking-tight mb-2">{mission.title}</h5>
                        <p className="text-[10px] text-text-secondary font-medium italic opacity-70 mb-4 flex items-center gap-2">
                          <Users size={12} className="text-text-dim" /> Client: {getClientName(mission.clientId)}
                        </p>
                        <div className="flex justify-between items-center pt-3 border-t border-border-subtle/50">
                          <span className="flex items-center gap-2 text-[10px] text-text-muted font-black uppercase tracking-widest italic opacity-60">
                            <Clock size={12} />
                            ETA: {formatMissionDeadline(mission.deadline)}
                          </span>
                          {mission.status === 'termine' && (
                            <span className="flex items-center gap-1.5 text-noya-green text-[10px] font-black uppercase tracking-widest">
                              <CheckCircle size={12} /> Sync OK
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 text-text-dim italic font-black uppercase text-[10px] tracking-widest leading-loose">
                    <Code size={48} className="mx-auto mb-4 opacity-10" />
                    Aucune unité n'est actuellement déployée sur le terrain.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isResourceModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && closeResourceModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="commando-luxe-hero-shell max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-luxe-champagne/25 bg-noya-sidebar/95 shadow-[0_32px_80px_-32px_rgba(0,0,0,0.85)]"
              role="dialog"
              aria-labelledby="inject-resource-title"
              aria-modal="true"
            >
              <div className="commando-dashboard-hero-mesh pointer-events-none absolute inset-0 opacity-40" aria-hidden />
              <div className="relative border-b border-white/10 px-6 py-5 md:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-[10px] uppercase tracking-[0.28em] text-luxe-champagne-bright/90">Bibliothèque</p>
                    <h3 id="inject-resource-title" className="mt-1 font-display text-2xl font-normal tracking-tight text-text-primary">
                      Injecter une ressource
                    </h3>
                    <p className="mt-2 text-xs text-text-secondary">
                      Titre, description optionnelle, puis fichier — le type d’indexation est proposé automatiquement (modifiable).
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Fermer"
                    onClick={closeResourceModal}
                    className="shrink-0 rounded-xl border border-white/10 p-2 text-text-muted transition-colors hover:border-luxe-champagne/30 hover:text-luxe-champagne-bright"
                  >
                    <X size={20} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="relative space-y-5 px-6 py-6 md:px-8 md:py-7">
                <input
                  ref={resourceFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.rar,.7z,image/*,video/*,.mp4,.webm,.mov"
                  onChange={onResourceFileInputChange}
                />

                <div>
                  <label htmlFor="resource-inject-title" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    Titre <span className="text-noya-orange">*</span>
                  </label>
                  <input
                    id="resource-inject-title"
                    type="text"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="Ex. — Manuel onboarding partenaires"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-dim focus:border-luxe-champagne/40 focus:ring-1 focus:ring-luxe-champagne/25"
                  />
                </div>

                <div>
                  <label htmlFor="resource-inject-desc" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    Description <span className="font-normal normal-case text-text-muted">(optionnel)</span>
                  </label>
                  <textarea
                    id="resource-inject-desc"
                    value={resourceDescription}
                    onChange={(e) => setResourceDescription(e.target.value)}
                    rows={3}
                    placeholder="Contexte, public visé, version…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-dim focus:border-luxe-champagne/40 focus:ring-1 focus:ring-luxe-champagne/25"
                  />
                </div>

                <div>
                  <label htmlFor="resource-inject-type" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    Type indexé
                  </label>
                  <select
                    id="resource-inject-type"
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-primary outline-none focus:border-luxe-champagne/40 focus:ring-1 focus:ring-luxe-champagne/25"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOCX">Word</option>
                    <option value="XLSX">Excel</option>
                    <option value="PPTX">PowerPoint</option>
                    <option value="ZIP">Archive</option>
                    <option value="MP4">Vidéo</option>
                    <option value="IMG">Image</option>
                    <option value="FILE">Autre</option>
                  </select>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    Fichier <span className="text-noya-orange">*</span>
                  </p>
                  <div
                    onClick={() => resourceFileInputRef.current?.click()}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setResourceDropActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setResourceDropActive(false);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      setResourceDropActive(false);
                      onResourceFilePicked(e.dataTransfer.files);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all',
                      resourceDropActive
                        ? 'border-luxe-champagne/60 bg-luxe-champagne/10'
                        : 'border-white/15 bg-black/20 hover:border-luxe-champagne/35 hover:bg-white/3'
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        resourceFileInputRef.current?.click();
                      }
                    }}
                  >
                    <Upload className="h-8 w-8 text-luxe-champagne-bright/80" aria-hidden />
                    <span className="text-sm font-medium text-text-primary">Glisser-déposer ou parcourir</span>
                    <span className="text-[11px] text-text-muted">PDF, Office, images, vidéo, archives…</span>
                  </div>
                </div>

                {resourceSelectedFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-luxe-champagne/25 bg-luxe-champagne/8 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-luxe-champagne-bright" aria-hidden />
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium text-text-primary">{resourceSelectedFile.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {formatFileSize(resourceSelectedFile.size) || '—'} · {inferResourceLabel(resourceSelectedFile)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Retirer le fichier"
                      onClick={() => {
                        setResourceSelectedFile(null);
                        if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
                      }}
                      className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:border-noya-red/40 hover:text-noya-red"
                    >
                      Retirer
                    </button>
                  </div>
                ) : null}

                {resourceUploadProgress !== null ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      <span>Envoi</span>
                      <span>{resourceUploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-luxe-champagne/90 to-noya-blue transition-all duration-300"
                        style={{ width: `${resourceUploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-5">
                  <button
                    type="button"
                    onClick={closeResourceModal}
                    disabled={resourceUploadProgress !== null}
                    className="rounded-xl border border-white/10 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={!resourceTitle.trim() || !resourceSelectedFile || resourceUploadProgress !== null}
                    onClick={() => void handleResourceInject()}
                    className="inline-flex items-center gap-2 rounded-xl border border-luxe-champagne/40 bg-linear-to-r from-luxe-champagne/20 to-noya-blue/20 px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-luxe-champagne-bright shadow-[0_12px_32px_-16px_rgba(201,169,98,0.4)] transition-all hover:border-luxe-champagne/55 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Injecter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Déploiement Mission</h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddAssignment} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Unité Développeur *</label>
                  <select
                    required
                    value={newAssignment.devId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, devId: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-black uppercase text-[11px] tracking-widest cursor-pointer transition-all"
                  >
                    <option value="">SÉLECTIONNER UN OPÉRATEUR</option>
                    {developers.map(dev => (
                      <option key={dev.id} value={dev.id} className="bg-surface-secondary">
                        {`${dev.firstName || ''} ${dev.lastName || ''}`.trim() || dev.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Entité Client *</label>
                  <select
                    required
                    value={newAssignment.clientId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, clientId: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-black uppercase text-[11px] tracking-widest cursor-pointer transition-all"
                  >
                    <option value="">SÉLECTIONNER UN CLIENT</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id} className="bg-surface-secondary">
                        {`${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Objectif de Mission *</label>
                  <input
                    type="text" required
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                    placeholder="Ex: Déploiement infrastructure cloud"
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Date d'Échéance Opérationnelle</label>
                  <input
                    type="date"
                    value={newAssignment.deadline}
                    onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-black uppercase text-[11px] tracking-widest transition-all"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-5">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-4 bg-noya-orange text-noya-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-orange/20"
                  >
                    Déployer la Mission
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
