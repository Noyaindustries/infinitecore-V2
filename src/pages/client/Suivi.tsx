import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Clock, FileText, Download, Eye, Lock, ChevronRight,
  Archive, Search, Loader2
} from 'lucide-react';
import { useAuth } from '../../components/FirebaseProvider';
import { dossierService, DossierStep, StepType, STEP_META, STEP_ORDER } from '../../services/dossierService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'bg-purple-100 text-purple-600', dot: 'bg-purple-500' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
};

function formatSize(bytes: number) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ClientSuivi() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<DossierStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'progression' | 'archive'>('progression');
  const [searchArchive, setSearchArchive] = useState('');





  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsub = dossierService.subscribeToClientSteps(user.uid, (data) => {
      setSteps(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Latest doc per step type
  const latestPerStep: Partial<Record<StepType, DossierStep>> = {};
  steps.forEach((s) => {
    const existing = latestPerStep[s.stepType];
    if (!existing || s.uploadedAt > existing.uploadedAt) {
      latestPerStep[s.stepType] = s;
    }
  });

  const validatedCount = STEP_ORDER.filter(
    (t) => latestPerStep[t]?.status === 'valide'
  ).length;
  const progressPct = Math.round((validatedCount / STEP_ORDER.length) * 100);

  // Current active step = first soumis, or null if all done/none
  const currentStepIdx = STEP_ORDER.findIndex(
    (t) => latestPerStep[t]?.status === 'soumis'
  );

  const handleValidate = async (step: DossierStep) => {
    setValidating(step.id);
    try {
      await dossierService.validateStep(step.id);
      // Notify commando
      await notificationService.createNotification(
        'admin_general',
        'Document validé par le client',
        `Le client a validé : "${STEP_META[step.stepType].label}" — ${step.fileName}`,
        'mission',
        { clientId: user?.uid, stepType: step.stepType }
      );
      toast.success(`${STEP_META[step.stepType].label} validé !`);
    } catch (err) {
      console.error('[ClientSuivi] validate:', err);
      toast.error('Erreur lors de la validation.');
    } finally {
      setValidating(null);
    }
  };

  const archivedDocs = steps.filter((s) => s.status === 'valide');
  const filteredArchive = archivedDocs.filter((s) =>
    s.fileName.toLowerCase().includes(searchArchive.toLowerCase()) ||
    STEP_META[s.stepType].label.toLowerCase().includes(searchArchive.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-b-2 border-noya-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-noya-blue tracking-tight">Suivi de votre dossier</h1>
        <p className="text-text-secondary mt-1">
          Retrouvez ici tous les documents soumis par l'équipe Noya. Lisez-les et validez-les pour avancer dans votre projet.
        </p>
      </div>

      {/* Global progress bar */}
      <div className="bg-noya-sidebar rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Progression globale</span>
          <span className="text-xl font-bold text-noya-blue">{progressPct}%</span>
        </div>
        <div className="w-full bg-noya-black rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500"
          />
        </div>
        <div className="flex justify-between mt-3 overflow-x-auto pb-4 custom-scrollbar gap-4">
          {STEP_ORDER.map((stepType, i) => {
            const step = latestPerStep[stepType];
            const isValidated = step?.status === 'valide';
            const isCurrent = i === currentStepIdx;
            const meta = STEP_META[stepType];
            return (
              <div key={stepType} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isValidated ? 'bg-green-500 border-green-500 text-white' :
                  isCurrent ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100' :
                  step ? 'bg-orange-400 border-orange-400 text-white' :
                  'bg-noya-black border-border text-text-muted'
                }`}>
                  {isValidated ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-[11px] font-medium ${isValidated ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-text-muted'}`}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-noya-black rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('progression')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'progression' ? 'bg-noya-sidebar shadow-sm text-noya-blue border border-border' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Mes étapes
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'archive' ? 'bg-noya-sidebar shadow-sm text-noya-blue border border-border' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Archive size={14} />
          Archive
          {archivedDocs.length > 0 && (
            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {archivedDocs.length}
            </span>
          )}
        </button>
      </div>

      {/* Steps view */}
      {activeTab === 'progression' && (
        <div className="space-y-4">
          {STEP_ORDER.map((stepType, idx) => {
            const step = latestPerStep[stepType];
            const meta = STEP_META[stepType];
            const colors = COLOR_MAP[meta.color as keyof typeof COLOR_MAP];
            const isValidated = step?.status === 'valide';
            const isSoumis = step?.status === 'soumis';
            const isEmpty = !step;
            // Locked if previous step not validated yet
            const isLocked = idx > 0 && latestPerStep[STEP_ORDER[idx - 1]]?.status !== 'valide' && isEmpty;

            return (
              <motion.div
                key={stepType}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`bg-noya-sidebar rounded-2xl border shadow-sm overflow-hidden ${
                  isValidated ? 'border-green-200' :
                  isSoumis ? `border-noya-blue/30 ring-2 ring-offset-1 ring-noya-blue/20` :
                  'border-border'
                }`}
              >
                {/* Step header */}
                <div className={`flex items-center gap-4 px-5 py-4 ${isValidated ? 'bg-green-50/50' : isSoumis ? 'bg-noya-blue/5' : 'bg-noya-black/50'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isValidated ? 'bg-green-100 text-green-600' :
                    isSoumis ? colors.icon :
                    'bg-noya-black text-text-muted'
                  }`}>
                    {isValidated ? <CheckCircle size={20} /> :
                     isEmpty ? <Lock size={18} /> :
                     <FileText size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-text-primary">{`Étape ${idx + 1} — ${meta.label}`}</p>
                      {isValidated && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Validé</span>
                      )}
                      {isSoumis && (
                        <span className={`text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-medium border ${colors.border}`}>
                          En attente de votre validation
                        </span>
                      )}
                      {isEmpty && (
                        <span className="text-xs bg-noya-black/50 text-text-muted px-2 py-0.5 rounded-full font-medium border border-border">
                          {isLocked ? 'Verrouillé' : 'En préparation'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{meta.description}</p>
                  </div>
                  {isValidated && step?.validatedAt && (
                    <p className="text-xs text-green-600 font-medium flex-shrink-0">
                      {format(new Date(step.validatedAt), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>

                {/* Step body — doc available */}
                {step && (
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.icon}`}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary text-sm">{step.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-text-muted">{formatSize(step.fileSize)}</p>
                            <span className="text-border">·</span>
                            <p className="text-xs text-text-muted">
                              Envoyé le {format(new Date(step.uploadedAt), 'dd MMM yyyy', { locale: fr })}
                              {step.uploadedByName && ` par ${step.uploadedByName}`}
                            </p>
                          </div>
                          {step.note && (
                            <p className="text-xs text-noya-blue italic mt-1">"{step.note}"</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={step.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 border border-border text-text-secondary rounded-xl text-sm hover:bg-noya-black transition-colors font-medium"
                        >
                          <Eye size={15} /> Consulter
                        </a>
                        <a
                          href={step.fileUrl}
                          download
                          className="flex items-center gap-1.5 px-3 py-2 border border-border text-text-secondary rounded-xl text-sm hover:bg-noya-black transition-colors font-medium"
                        >
                          <Download size={15} />
                        </a>
                        {isSoumis && (
                          <button
                            onClick={() => handleValidate(step)}
                            disabled={validating === step.id}
                            className="flex items-center gap-2 px-4 py-2 bg-noya-blue text-noya-black rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50"
                          >
                            {validating === step.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <CheckCircle size={15} />
                            )}
                            Valider
                          </button>
                        )}
                        {isValidated && (
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold border border-green-200">
                            <CheckCircle size={15} /> Validé
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty step */}
                {isEmpty && (
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-400 italic flex items-center gap-2">
                      <Clock size={14} />
                      {isLocked
                        ? 'Cette étape sera disponible après validation de l\'étape précédente.'
                        : 'Document en cours de préparation par l\'équipe Noya Industries.'}
                    </div>
                    

                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Archive view */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchArchive}
              onChange={(e) => setSearchArchive(e.target.value)}
              placeholder="Rechercher dans les documents validés..."
              className="w-full pl-9 pr-4 py-2.5 bg-noya-sidebar border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-noya-blue outline-none"
            />
          </div>

          {filteredArchive.length === 0 ? (
            <div className="bg-noya-sidebar rounded-2xl border border-border flex flex-col items-center justify-center py-14 text-text-muted gap-3">
              <Archive size={40} className="opacity-20" />
              <p className="font-medium text-text-secondary">
                {archivedDocs.length === 0
                  ? 'Aucun document validé pour le moment.'
                  : 'Aucun résultat pour cette recherche.'}
              </p>
            </div>
          ) : (
            <div className="bg-noya-sidebar rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Documents validés</h2>
                <span className="text-xs text-text-muted">{filteredArchive.length} document{filteredArchive.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-border">
                {filteredArchive.map((step) => {
                  const meta = STEP_META[step.stepType];
                  const colors = COLOR_MAP[meta.color as keyof typeof COLOR_MAP];
                  return (
                    <div key={step.id} className="flex items-center justify-between px-5 py-4 hover:bg-noya-black transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${colors.icon}`}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-text-primary text-sm">{step.fileName}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-text-muted">{formatSize(step.fileSize)}</p>
                            <span className="text-border">·</span>
                            <p className="text-xs text-green-600">
                              Validé le {step.validatedAt ? format(new Date(step.validatedAt), 'dd MMM yyyy', { locale: fr }) : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={step.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-text-muted hover:text-noya-blue hover:bg-noya-blue/5 rounded-lg transition-colors"
                          title="Consulter"
                        >
                          <Eye size={16} />
                        </a>
                        <a
                          href={step.fileUrl}
                          download
                          className="p-2 text-text-muted hover:text-noya-blue hover:bg-noya-blue/5 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
