import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Upload, X, FileText, CheckCircle, Clock, Trash2, ChevronDown, Users, Plus, Download, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../components/AuthProvider';
import { formatFileSize } from '../../lib/formatFileSize';
import { isPdfDocument } from '../../lib/dossierPdf';
import { dossierService, DossierStep, StepType, STEP_META, STEP_ORDER } from '../../services/dossierService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  soumis: 'Traitement',
  valide: 'Accepté',
  en_attente: 'Standby',
};

const STATUS_COLORS: Record<string, string> = {
  soumis: 'bg-noya-orange/10 text-noya-orange border-noya-orange/20',
  valide: 'bg-noya-green/10 text-noya-green border-noya-green/20',
  en_attente: 'bg-surface-tertiary text-text-muted border-border-subtle',
};

const STEP_COLORS: Record<string, string> = {
  audit: 'bg-noya-blue/10 text-noya-blue border-noya-blue/20',
  proposition: 'bg-noya-orange/10 text-noya-orange border-noya-orange/20',
  contrat: 'bg-noya-purple/10 text-noya-purple border-noya-purple/20',
  facture: 'bg-noya-green/10 text-noya-green border-noya-green/20',
};

interface UploadModalProps {
  client: any;
  stepType: StepType;
  onClose: () => void;
  commandoName: string;
  commandoId: string;
}

function UploadModal({ client, stepType, onClose, commandoName, commandoId }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const meta = STEP_META[stepType];
  const auditPdfOnly = stepType === 'audit';
  const fileInputAccept = auditPdfOnly
    ? '.pdf,application/pdf'
    : '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (auditPdfOnly && !isPdfDocument(f)) {
      toast.error("L'étape Audit (étape 1) n'accepte que des fichiers PDF.");
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (auditPdfOnly && !isPdfDocument(file)) {
      toast.error("L'étape Audit (étape 1) n'accepte que des fichiers PDF.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile(
        file,
        `dossiers/${client.id}/${stepType}`,
        (pct) => setProgress(pct)
      );

      await dossierService.createStep({
        clientId: client.id,
        stepType,
        title: meta.label,
        fileUrl: result.url,
        fileName: file.name,
        fileSize: file.size,
        storagePath: result.publicId,
        uploadedBy: commandoId,
        uploadedByName: commandoName,
        note: note.trim(),
      });

      const clientDisplayName = client.firstName
        ? `${client.firstName} ${client.lastName || ''}`.trim()
        : client.email;

      // Ne pas faire échouer le dépôt si la notif ou la tâche Kanban échoue (règles / quota).
      try {
        await notificationService.createNotification(
          client.id,
          `Nouveau document : ${meta.label}`,
          `L'équipe Noya a déposé votre ${meta.label.toLowerCase()}. Consultez-le et validez-le dans votre espace.`,
          'mission',
          { stepType, clientId: client.id }
        );
      } catch (e) {
        console.warn('[AdminDossiers] notification après dépôt:', e);
      }
      try {
        const taskId = `TSK-${Math.floor(1000 + Math.random() * 9000)}`;
        await setDoc(doc(db, 'tasks', taskId), {
          id: taskId,
          userId: commandoId,
          title: `Document déposé: ${meta.label}`,
          client: clientDisplayName,
          columnId: 'contacte',
          isOrder: false,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[AdminDossiers] tâche pipeline après dépôt:', e);
      }

      toast.success(`${meta.label} enregistré pour ${clientDisplayName} — le client peut le valider dans Mon dossier.`);
      onClose();
    } catch (err) {
      console.error('[AdminDossiers] upload:', err);
      toast.error('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-8 border-b border-border-subtle bg-surface-primary/50">
          <div>
            <h2 className="font-black text-text-primary uppercase tracking-tight">
              Injection : <span className={`px-3 py-1 rounded-lg text-[10px] tracking-widest ${STEP_COLORS[stepType]}`}>{meta.label}</span>
            </h2>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <Users size={12} className="opacity-50" />
              Cible : {client.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : client.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'upload"
            title="Fermer"
            className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* File picker */}
          <div>
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
              Vecteur Documentaire <span className="text-noya-orange">*</span>
              {auditPdfOnly ? (
                <span className="ml-2 font-mono text-[9px] font-bold normal-case text-noya-orange">
                  PDF uniquement (étape 1)
                </span>
              ) : null}
            </label>
            <input
              id={`dossier-file-${stepType}`}
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept={fileInputAccept}
              title={`Sélectionner un fichier pour l'étape ${meta.label}`}
            />
            {file ? (
              <div className="flex items-center gap-4 px-5 py-4 bg-noya-blue/5 border border-noya-blue/20 rounded-2xl shadow-inner">
                <FileText size={20} className="text-noya-blue shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-text-primary uppercase tracking-tight truncate">{file.name}</p>
                  <p className="text-[10px] font-bold text-noya-blue uppercase tracking-widest">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Retirer le fichier sélectionné"
                  title="Retirer le fichier"
                  className="p-2 text-text-muted hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border-medium bg-surface-primary/30 rounded-2xl py-12 flex flex-col items-center gap-3 text-text-muted hover:border-noya-blue/50 hover:bg-noya-blue/5 transition-all group"
              >
                <Upload size={32} className="group-hover:scale-110 transition-transform text-noya-blue/50" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sélection d'unité radar</span>
                <span className="text-[9px] font-bold uppercase opacity-50 tracking-widest">
                  {auditPdfOnly ? 'Fichier PDF uniquement' : 'PDF, Office, Images supportés'}
                </span>
              </button>
            )}
          </div>

          {/* Optional note */}
          <div>
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
              Note de Commandement <span className="text-text-dim text-[9px] ml-1">(Optionnel)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ex: Merci de valider l'audit avant le déploiement..."
              className="w-full px-5 py-4 bg-surface-primary border border-border-subtle rounded-2xl text-[11px] font-medium text-text-primary focus:ring-2 focus:ring-noya-orange outline-none resize-none shadow-inner"
            />
          </div>

          {/* Progress bar during upload */}
          {uploading && (
            <div className="space-y-2">
              <div className="w-full bg-surface-tertiary rounded-full h-1.5 overflow-hidden">
                <div className="bg-noya-blue h-full transition-all shadow-[0_0_10px_rgba(43,198,115,0.5)]" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[9px] font-black text-noya-blue text-center uppercase tracking-widest">{progress}% synchronisé</p>
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-6 py-4 border border-border-subtle text-text-muted rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-surface-tertiary transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-6 py-4 bg-noya-orange text-noya-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-noya-orange/20 flex items-center justify-center gap-3"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-noya-black/30 border-t-noya-black rounded-full animate-spin" />
              ) : (
                <><Upload size={16} /> Déployer</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function GeneralUploadModal({ client, onClose, commandoName, commandoId }: { client: any, onClose: () => void, commandoName: string, commandoId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('livrables');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const documentId = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
      const result = await uploadFile(
        file,
        `documents/${client.id}`,
        (pct) => setProgress(pct)
      );

      await setDoc(doc(db, 'documents', documentId), {
        id: documentId,
        userId: client.id,
        name: file.name,
        url: result.url,
        storagePath: result.publicId,
        type: type,
        size: file.size,
        uploadedBy: commandoId,
        uploadedByName: commandoName,
        createdAt: new Date().toISOString(),
      });

      const clientDisplayName = client.firstName
        ? `${client.firstName} ${client.lastName || ''}`.trim()
        : client.email;
        
      // Update Commando Kanban Pipeline
      const taskId = `TSK-${Math.floor(1000 + Math.random() * 9000)}`;
      await setDoc(doc(db, 'tasks', taskId), {
        id: taskId,
        userId: commandoId,
        title: `Document général déposé: ${file.name}`,
        client: clientDisplayName,
        columnId: 'contacte',
        isOrder: false,
        createdAt: new Date().toISOString(),
      });

      toast.success('Document ajouté avec succès !');
      onClose();
    } catch (err) {
      console.error('Error uploading file:', err);
      toast.error('Erreur lors du chargement.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-secondary rounded-3xl shadow-2xl border border-border-medium w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-8 border-b border-border-subtle bg-surface-primary/50">
          <div>
            <h2 className="font-black text-text-primary uppercase tracking-tight">Injection Documentaire</h2>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <Users size={12} className="opacity-50" />
              Cible : {client.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : client.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'archive"
            title="Fermer"
            className="p-2 hover:bg-surface-tertiary rounded-full transition-all text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
              Type de document <span className="text-noya-orange">*</span>
            </label>
            <select
              id="general-doc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              title="Type de document"
              className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-noya-blue outline-none transition-all shadow-inner font-medium"
            >
              <option value="livrables">Livrable Infinite</option>
              <option value="pieces">Pièce Justificative</option>
              <option value="paiements">Preuve de Paiement</option>
              <option value="contrats">Contrat & Signature</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
              Vecteur Archive <span className="text-noya-orange">*</span>
            </label>
            <input
              id="general-doc-file"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              title="Sélectionner un document"
            />
            {file ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <FileText size={18} className="text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{file.name}</p>
                  <p className="text-xs text-blue-600">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Retirer le document sélectionné"
                  title="Retirer le document"
                  className="p-1 text-blue-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <Upload size={24} />
                <span className="text-sm font-medium">Cliquez pour choisir un fichier</span>
              </button>
            )}
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 text-center">{progress}%</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2.5 bg-[#1E3A5F] text-white rounded-xl font-semibold text-sm hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Upload size={15} /> Ajouter le document</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminDossiers() {
  const { user, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [allSteps, setAllSteps] = useState<DossierStep[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [uploadModal, setUploadModal] = useState<{ client: any; stepType: StepType } | null>(null);
  const [generalUploadModal, setGeneralUploadModal] = useState<any | null>(null);
  const [allGeneralDocs, setAllGeneralDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const commandoName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Commando';

  useEffect(() => {
    // Liste élargie : tous les profils avec rôle « client » (casse tolérée), pas seulement l’égalité stricte Firestore.
    const unsubClients = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as { id: string; role?: string; createdAt?: string }))
          .filter((u) => String(u.role || '').toLowerCase() === 'client')
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setClients(data);
        setLoading(false);
      },
      (err) => {
        console.error('[AdminDossiers] clients query:', err);
        toast.error('Impossible de charger les clients. Vérifiez la connexion ou les règles Firestore.');
        setLoading(false);
      }
    );
    const unsubSteps = dossierService.subscribeToAllSteps((data) => setAllSteps(data));
    const unsubDocs = onSnapshot(
      collection(db, 'documents'),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllGeneralDocs(data);
      },
      (err) => {
        console.error('[AdminDossiers] documents:', err);
        toast.error('Impossible de charger les documents généraux.');
      }
    );
    return () => {
      unsubClients();
      unsubSteps();
      unsubDocs();
    };
  }, []);

  useEffect(() => {
    const state = location.state as { selectClientId?: string } | null;
    const id = state?.selectClientId;
    if (!id || clients.length === 0) return;
    const found = clients.find((c) => c.id === id);
    if (found) {
      setSelectedClient(found);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, clients, navigate]);

  const handleDeleteStep = async (step: DossierStep) => {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      await dossierService.deleteStep(step.id);
      toast.success('Document supprimé.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleDeleteGeneralDoc = async (docObj: any) => {
    if (!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
    try {
      await deleteDoc(doc(db, 'documents', docObj.id));
      toast.success('Document supprimé.');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${c.firstName || ''} ${c.lastName || ''} ${c.email || ''}`.toLowerCase();
    return name.includes(q);
  });

  // Steps for selected client
  const clientSteps = selectedClient
    ? allSteps.filter((s) => s.clientId === selectedClient.id)
    : [];

  // Per-step latest doc
  const latestPerStep: Partial<Record<StepType, DossierStep>> = {};
  clientSteps.forEach((s) => {
    const ex = latestPerStep[s.stepType];
    if (!ex || s.uploadedAt > ex.uploadedAt) latestPerStep[s.stepType] = s;
  });

  const validatedCount = STEP_ORDER.filter((t) => latestPerStep[t]?.status === 'valide').length;

  // Count pending validations across all clients
  const pendingCount = allSteps.filter((s) => s.status === 'soumis').length;

  return (
    <div className="space-y-6 px-4 py-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">Archives Dossiers</h1>
          <p className="text-text-secondary mt-1 font-medium italic">Station de commandement des flux documentaires clients</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-4 bg-noya-orange/5 border border-noya-orange/20 rounded-2xl px-6 py-4 shadow-sm animate-pulse">
            <Clock size={20} className="text-noya-orange" />
            <p className="text-[10px] font-black uppercase tracking-widest text-noya-orange">
              {pendingCount} transmission{pendingCount > 1 ? 's' : ''} en attente client
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Client list */}
        <div className="lg:w-80 shrink-0 space-y-4">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-noya-blue transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SCANNER LA BASE CLIENT..."
              className="w-full pl-12 pr-6 py-3.5 bg-surface-secondary border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-noya-blue/30 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="bg-surface-secondary rounded-2xl border border-border-subtle overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3 bg-surface-primary/30">
              <Users size={16} className="text-text-muted opacity-50" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                Unités Cibles [{filteredClients.length}]
              </span>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-b-blue-500 rounded-full animate-spin" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-text-secondary space-y-2">
                <p className="font-semibold text-text-primary">Aucun compte portail client</p>
                <p className="text-xs leading-relaxed">
                  Seuls les utilisateurs avec le rôle <span className="font-mono text-noya-orange">client</span> (inscription
                  / portail) apparaissent ici. Sans client sélectionné, vous ne pouvez pas injecter d’étape de dossier.
                </p>
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto divide-y divide-border-subtle scrollbar-none">
                {filteredClients.map((client) => {
                  const cSteps = allSteps.filter((s) => s.clientId === client.id);
                  const cValidated = cSteps.filter((s) => s.status === 'valide').length;
                  const hasPending = cSteps.some((s) => s.status === 'soumis');
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(isSelected ? null : client)}
                      className={`w-full px-5 py-4 text-left hover:bg-surface-tertiary transition-all flex items-center justify-between gap-4 group ${isSelected ? 'bg-surface-tertiary border-l-4 border-noya-blue' : 'border-l-4 border-transparent'}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-inner overflow-hidden transition-all ${isSelected ? 'bg-noya-blue text-white shadow-noya-blue/20' : 'bg-surface-tertiary text-text-muted border border-border-subtle group-hover:bg-surface-elevated'}`}>
                          {client.firstName?.[0] || client.email?.[0] || 'C'}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {client.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : client.email}
                          </p>
                          <p className="text-[10px] text-text-muted font-bold truncate tracking-widest uppercase opacity-60">{client.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasPending && <span className="w-2 h-2 rounded-full bg-noya-orange animate-pulse shadow-[0_0_5px_rgba(255,179,50,0.5)]" />}
                        {cValidated > 0 && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shadow-inner ${cValidated === STEP_ORDER.length ? 'bg-noya-green/10 text-noya-green border-noya-green/20' : 'bg-surface-tertiary text-text-muted border-border-subtle'}`}>
                            {cValidated}/{STEP_ORDER.length}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected client dossier */}
        <div className="flex-1">
          {!selectedClient ? (
            <div className="bg-surface-secondary rounded-2xl border border-border-subtle border-dashed flex flex-col items-center justify-center py-20 text-text-dim gap-4 opacity-50">
              <Users size={40} className="opacity-20 translate-y-2" />
              <p className="font-black text-[10px] uppercase tracking-[0.2em] italic">Sélectionner une unité client pour interroger la base.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Client info bar */}
              <div className="bg-surface-secondary rounded-2xl border border-border-subtle px-6 py-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-tertiary border border-border-subtle text-text-muted flex items-center justify-center font-black uppercase shadow-inner">
                    {selectedClient.firstName?.[0] || selectedClient.email?.[0] || 'C'}
                  </div>
                  <div>
                    <p className="font-black text-text-primary uppercase tracking-tight">
                      {selectedClient.firstName ? `${selectedClient.firstName} ${selectedClient.lastName || ''}`.trim() : selectedClient.email}
                    </p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-60">{selectedClient.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
                  <Link
                    to={`/admin/messagerie?client=${encodeURIComponent(selectedClient.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-noya-blue/25 bg-noya-blue/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-noya-blue transition-all hover:border-noya-blue/45 hover:bg-noya-blue/15"
                  >
                    <MessageCircle size={14} aria-hidden />
                    Messagerie
                  </Link>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{validatedCount} / {STEP_ORDER.length} VALIDÉS</span>
                  <div className="w-32 h-2 bg-surface-tertiary rounded-full overflow-hidden shadow-inner border border-border-subtle">
                    <div
                      className="h-full bg-noya-green rounded-full transition-all shadow-[0_0_10px_rgba(43,198,115,0.3)]"
                      style={{ width: `${(validatedCount / STEP_ORDER.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Steps grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STEP_ORDER.map((stepType) => {
                  const step = latestPerStep[stepType];
                  const meta = STEP_META[stepType];
                  const allClientStepsForType = clientSteps.filter((s) => s.stepType === stepType);

                  return (
                    <div key={stepType} className="bg-surface-secondary rounded-2xl border border-border-subtle overflow-hidden shadow-sm hover:border-noya-blue/20 transition-all group">
                      {/* Step header */}
                      <div className={`flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-primary/30`}>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner ${STEP_COLORS[stepType].replace('bg-', 'bg-opacity-10 border-')}`}>
                            {meta.label}
                          </span>
                          {step && (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border shadow-inner ${STATUS_COLORS[step.status].replace('bg-', 'bg-opacity-10 border-')}`}>
                              {STATUS_LABELS[step.status]}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadModal({ client: selectedClient, stepType })}
                          className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-noya-blue text-white rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-noya-blue/20"
                        >
                          <Plus size={12} /> Injecter
                        </button>
                      </div>

                      {/* Step body */}
                      <div className="p-5">
                        {!step ? (
                          <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-30">
                            <FileText size={24} className="text-text-muted" />
                            <p className="text-[9px] text-text-muted font-black uppercase tracking-widest">Zone vierge</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {allClientStepsForType.map((s) => (
                              <div key={s.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface-primary border border-border-subtle group/item hover:bg-surface-tertiary transition-all shadow-inner">
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText size={16} className="text-text-muted opacity-50 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black text-text-primary uppercase tracking-tight truncate group-hover/item:text-noya-blue transition-colors">{s.fileName}</p>
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                                      {format(new Date(s.uploadedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                      {s.status === 'valide' && s.validatedAt && (
                                        <span className="text-noya-green ml-2 font-black">✓ Validé {format(new Date(s.validatedAt), 'dd/MM', { locale: fr })}</span>
                                      )}
                                    </p>
                                    {s.note && <p className="text-[10px] text-noya-blue italic mt-1.5 border-l-2 border-noya-blue/20 pl-2 leading-relaxed">{s.note}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border shadow-inner ${STATUS_COLORS[s.status].replace('bg-', 'bg-opacity-10 border-')}`}>
                                    {STATUS_LABELS[s.status]}
                                  </span>
                                  {s.status !== 'valide' && (
                                    <button
                                      onClick={() => handleDeleteStep(s)}
                                      className="p-2 text-text-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                      title="Supprimer l'unité"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

               {/* General Documents Section */}
              <div className="mt-12 space-y-6 pt-8 border-t border-border-subtle">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Archives Versatiles</h3>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Livrables techniques, facturation, documents institutionnels</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGeneralUploadModal(selectedClient)}
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-6 py-3 bg-surface-tertiary border border-border-subtle text-text-primary rounded-2xl hover:bg-noya-blue/10 hover:border-noya-blue/30 transition-all shadow-sm"
                  >
                    <Plus size={16} /> Nouvelle Archive
                  </button>
                </div>

                {(() => {
                  const cGeneralDocs = allGeneralDocs.filter((d) => d.userId === selectedClient.id);
                  return cGeneralDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface-secondary/50 rounded-3xl border border-border-subtle border-dashed gap-4 text-text-muted opacity-30">
                      <FileText size={48} />
                      <p className="text-[11px] font-black uppercase tracking-[0.3em]">Néant sur cette zone radar</p>
                    </div>
                  ) : (
                    <div className="bg-surface-secondary border border-border-subtle rounded-3xl overflow-hidden divide-y divide-border-subtle shadow-lg">
                      {cGeneralDocs.map(doc => (
                        <div key={doc.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-surface-tertiary transition-all group/doc">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-surface-tertiary border border-border-subtle text-text-muted flex items-center justify-center group-hover/doc:bg-surface-elevated transition-colors shadow-inner">
                              <FileText size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-text-primary uppercase tracking-tight truncate group-hover/doc:text-noya-orange transition-colors">{doc.name}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[9px] font-black font-mono text-text-muted px-2 py-0.5 bg-surface-tertiary rounded-md border border-border-subtle uppercase tracking-widest shadow-inner">
                                  {doc.type}
                                </span>
                                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-60">
                                  {new Date(doc.createdAt).toLocaleDateString('fr-FR')} 
                                </span>
                                <span className="text-[10px] text-text-dim font-black font-mono hidden sm:inline">[{formatFileSize(doc.size)}]</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Télécharger ${doc.name}`}
                              className="p-3 text-text-muted hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl transition-all shadow-sm border border-transparent hover:border-noya-blue/20"
                            >
                              <Download size={18} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteGeneralDoc(doc)}
                              aria-label={`Supprimer ${doc.name}`}
                              title="Supprimer le document"
                              className="p-3 text-text-dim hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-500/20"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      <AnimatePresence>
        {uploadModal && (
          <UploadModal
            client={uploadModal.client}
            stepType={uploadModal.stepType}
            commandoName={commandoName}
            commandoId={user?.uid || ''}
            onClose={() => setUploadModal(null)}
          />
        )}
        {generalUploadModal && (
          <GeneralUploadModal
            client={generalUploadModal}
            commandoName={commandoName}
            commandoId={user?.uid || ''}
            onClose={() => setGeneralUploadModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
