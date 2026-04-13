import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Upload, Bell, FileText, Image as ImageIcon, Code, CheckCircle, Clock, X, Download, Trash2, BookOpen, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, orderBy, doc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile } from '../../services/uploadService';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { missionService, Mission } from '../../services/missionService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Operations() {
  const [activeTab, setActiveTab] = useState<'fichiers' | 'notifications' | 'developpeurs' | 'ressources'>('fichiers');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState('PDF');
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

    // Fetch developers
    const qDevs = query(collection(db, 'users'), where('role', '==', 'developer'));
    const unsubscribeDevs = onSnapshot(qDevs, (snapshot) => {
      setDevelopers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch clients
    const qClients = query(collection(db, 'users'), where('role', '==', 'client'));
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
      unsubscribeDevs();
      unsubscribeClients();
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

  const handleResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !resourceTitle.trim()) {
      toast.error('Veuillez remplir le titre avant de choisir un fichier.');
      if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
      return;
    }
    const ext = file.name.split('.').pop()?.toUpperCase() || resourceType;
    setResourceUploadProgress(0);
    try {
      const result = await uploadFile(file, 'resources', (pct) => setResourceUploadProgress(pct));
      const resId = `RES-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      await setDoc(doc(db, 'resources', resId), {
        id: resId,
        title: resourceTitle.trim(),
        fileType: ext,
        url: result.url,
        storagePath: result.publicId,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} Mo`,
        createdAt: new Date().toISOString(),
      });
      toast.success('Ressource ajoutée avec succès !');
      setResourceTitle('');
      setResourceType('PDF');
      setIsResourceModalOpen(false);
    } catch {
      toast.error('Erreur lors du chargement.');
    } finally {
      setResourceUploadProgress(null);
      if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
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

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(f =>
    !fileSearch || f.name?.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">Opérations & Dossiers</h1>
          <p className="text-text-secondary mt-1 font-medium italic">Centre de commandement logistique et documentaire</p>
        </div>
        <div className="flex gap-4">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="flex items-center gap-3 bg-noya-blue text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-noya-blue/20 transition-all font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            <Upload size={18} />
            {uploadProgress !== null ? `${uploadProgress}%` : 'Nouveau Fichier'}
          </button>
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="w-full bg-surface-tertiary rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-noya-blue h-full transition-all duration-300 shadow-[0_0_10px_rgba(43,198,115,0.5)]"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="border-b border-border-subtle p-4 bg-surface-primary/30">
          <div className="tabs-scroll-container gap-8 pb-2">
            {(['fichiers', 'notifications', 'developpeurs', 'ressources'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative tab-button-nowrap ${
                  activeTab === tab ? 'text-noya-orange' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab === 'fichiers' ? 'Archives Radar' :
                 tab === 'notifications' ? `Flux Alertes${notifications.length > 0 ? ` [${notifications.length}]` : ''}` :
                 tab === 'developpeurs' ? 'Logistique Dev' :
                 `Bibliothèque [${resources.length}]`}
                {activeTab === tab && (
                  <motion.div layoutId="activeTabOp" className="absolute bottom-0 left-0 right-0 h-0.5 bg-noya-orange shadow-[0_0_10px_rgba(255,179,50,0.5)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
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
                <div className="text-center py-12 text-gray-400">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Aucun fichier chargé. Cliquez sur "Nouveau Fichier" pour commencer.</p>
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
                              {formatFileSize(file.size)}
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
                  onClick={() => setIsResourceModalOpen(true)}
                  className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl hover:bg-white/10 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg"
                >
                  <Upload size={16} /> Injecter ressource
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
                            ETA: {mission.deadline?.trim() ? format(new Date(mission.deadline), 'dd MMM yyyy', { locale: fr }) : 'Indéterminé'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-border-subtle bg-surface-primary/50">
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Nouvelle Ressource</h3>
                <button onClick={() => setIsResourceModalOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Titre de la ressource *</label>
                  <input
                    type="text"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="Ex: Manuel Opérationnel"
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Architecture Fichier</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    className="w-full px-5 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-orange outline-none shadow-inner font-black uppercase text-[11px] tracking-widest cursor-pointer transition-all"
                  >
                    <option value="PDF">Format PDF</option>
                    <option value="DOCX">Document Word</option>
                    <option value="ZIP">Archive ZIP</option>
                    <option value="MP4">Vidéo MP4</option>
                    <option value="IMG">Image Raster</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-5">
                  <button
                    type="button"
                    onClick={() => setIsResourceModalOpen(false)}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={!resourceTitle.trim()}
                    onClick={() => {
                      if (!resourceTitle.trim()) {
                        toast.error('Veuillez renseigner un titre.');
                        return;
                      }
                      resourceFileInputRef.current?.click();
                    }}
                    className="px-8 py-4 bg-noya-blue text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-blue/20 disabled:opacity-50"
                  >
                    Charger le fichier
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
