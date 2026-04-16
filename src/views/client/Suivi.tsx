import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  FileText,
  Download,
  Eye,
  Lock,
  Archive,
  Search,
  Loader2,
  FolderCheck,
  MessageCircle,
  LayoutDashboard,
  HelpCircle,
  ListChecks,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  SortAsc,
  Sparkles,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { dossierService, DossierStep, StepType, STEP_META, STEP_ORDER } from '../../services/dossierService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { formatFileSize } from '../../lib/formatFileSize';
import { absoluteUrlOnClient } from '../../lib/apiBase';


/** Styles cohérents avec le thème sombre espace client */
const STEP_THEME: Record<
  string,
  { iconBox: string; badge: string }
> = {
  blue: {
    iconBox: 'bg-noya-blue/15 text-noya-blue',
    badge: 'bg-noya-blue/10 text-noya-blue border border-noya-blue/25',
  },
  orange: {
    iconBox: 'bg-noya-orange/15 text-noya-orange',
    badge: 'bg-noya-orange/10 text-noya-orange border border-noya-orange/25',
  },
  purple: {
    iconBox: 'bg-purple-500/15 text-purple-300',
    badge: 'bg-purple-500/10 text-purple-200 border border-purple-500/25',
  },
  green: {
    iconBox: 'bg-noya-green/15 text-noya-green',
    badge: 'bg-noya-green/10 text-noya-green border border-noya-green/25',
  },
};

/** Étape 1 (audit) : nom de fichier de téléchargement toujours en .pdf */
function dossierDownloadFileName(step: DossierStep): string {
  if (step.stepType !== 'audit') return step.fileName;
  const raw = step.fileName.trim();
  if (/\.pdf$/i.test(raw)) return raw;
  const base = raw.replace(/\.[^/.]+$/i, '') || 'Audit-Infinite';
  return `${base}.pdf`;
}

function fileConsultKind(fileName: string): 'pdf' | 'image' | 'other' {
  const n = fileName.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(n)) return 'image';
  return 'other';
}

function DocumentConsultModal({ step, onClose }: { step: DossierStep; onClose: () => void }) {
  const url = absoluteUrlOnClient(step.fileUrl);
  const kind = fileConsultKind(step.fileName);
  const stepIndex = STEP_ORDER.indexOf(step.stepType) + 1;
  const meta = STEP_META[step.stepType];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consult-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Fermer la consultation"
        onClick={onClose}
      />
      <div className="relative z-[101] flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0f18] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-noya-orange">Consultation</p>
            <h2 id="consult-modal-title" className="mt-1 font-bold text-text-primary sm:text-lg">
              {meta.label}
              <span className="ml-2 font-mono text-xs font-semibold text-text-muted">
                étape {stepIndex}/{STEP_ORDER.length}
              </span>
            </h2>
            <p className="mt-0.5 truncate text-xs text-text-secondary" title={step.fileName}>
              {step.fileName}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{meta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-noya-blue/40 hover:text-noya-blue"
            >
              <ExternalLink size={14} aria-hidden />
              Nouvel onglet
            </a>
            <a
              href={url}
              download={dossierDownloadFileName(step)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-noya-green/40 hover:text-noya-green"
            >
              <Download size={14} aria-hidden />
              Télécharger
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-[45vh] flex-1 overflow-hidden bg-noya-black/40">
          {kind === 'pdf' ? (
            <div className="flex h-[min(78vh,880px)] w-full flex-col bg-noya-black">
              <p className="border-b border-white/10 px-4 py-2 text-[11px] text-text-muted">
                Aperçu intégré : si la zone reste vide, utilisez <strong className="text-text-secondary">Nouvel onglet</strong> — le
                PDF est alors ouvert par le lecteur du navigateur (recommandé).
              </p>
              <object
                key={`${step.id}-${url}`}
                data={url}
                type="application/pdf"
                className="min-h-0 w-full flex-1 border-0"
                aria-label={step.fileName}
              >
                <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                  <p className="max-w-md text-sm text-text-secondary">
                    Aperçu indisponible dans cette fenêtre. Ouvrez le document dans un nouvel onglet ou téléchargez-le.
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2.5 text-sm font-semibold text-noya-black"
                  >
                    <ExternalLink size={16} aria-hidden />
                    Ouvrir le PDF
                  </a>
                </div>
              </object>
            </div>
          ) : null}
          {kind === 'image' ? (
            <div className="flex max-h-[min(78vh,880px)] items-center justify-center overflow-auto p-4">
              <img src={url} alt={step.fileName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : null}
          {kind === 'other' ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
              <FileText className="h-14 w-14 text-text-muted opacity-60" aria-hidden />
              <p className="max-w-sm text-sm text-text-secondary">
                L&apos;aperçu intégré n&apos;est pas disponible pour ce type de fichier. Ouvrez-le dans un nouvel onglet
                ou téléchargez-le.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2.5 text-sm font-semibold text-noya-black transition-colors hover:brightness-110"
              >
                <ExternalLink size={16} aria-hidden />
                Ouvrir le fichier
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ClientSuivi() {
  const { user, userData } = useAuth();
  const [steps, setSteps] = useState<DossierStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'progression' | 'archive'>('progression');
  const [searchArchive, setSearchArchive] = useState('');
  /** Filtre d’affichage / ordre des cartes « Mes étapes » */
  const [stepViewFilter, setStepViewFilter] = useState<'all' | 'action' | 'active' | 'done'>('all');
  /** Archive : tri et filtre par type d’étape */
  const [archiveSort, setArchiveSort] = useState<'validated_desc' | 'validated_asc' | 'name'>('validated_desc');
  const [archiveStepFilter, setArchiveStepFilter] = useState<StepType | 'all'>('all');
  /** Aperçu plein écran (PDF / image) — notamment étape 1 Audit */
  const [previewStep, setPreviewStep] = useState<DossierStep | null>(null);





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

  const {
    latestPerStep,
    validatedCount,
    progressValidatedPct,
    weightedProgressPct,
    stepWeights,
    currentStepIdx,
  } = useMemo(() => {
    const latest: Partial<Record<StepType, DossierStep>> = {};
    steps.forEach((s) => {
      const existing = latest[s.stepType];
      if (!existing || s.uploadedAt > existing.uploadedAt) {
        latest[s.stepType] = s;
      }
    });
    const validated = STEP_ORDER.filter((t) => latest[t]?.status === 'valide').length;
    const validatedPct = Math.round((validated / STEP_ORDER.length) * 100);

    const weights: number[] = STEP_ORDER.map((t) => {
      const st = latest[t]?.status;
      if (st === 'valide') return 1;
      if (st === 'soumis') return 0.55;
      if (st === 'en_attente') return 0.2;
      return 0;
    });
    const weightedPct = Math.round((weights.reduce((a, b) => a + b, 0) / STEP_ORDER.length) * 100);

    const pendingIdx = STEP_ORDER.findIndex((t) => latest[t]?.status === 'soumis');

    return {
      latestPerStep: latest,
      validatedCount: validated,
      progressValidatedPct: validatedPct,
      weightedProgressPct: weightedPct,
      stepWeights: weights,
      currentStepIdx: pendingIdx,
    };
  }, [steps]);

  const handleValidate = async (step: DossierStep) => {
    if (!user?.uid) {
      toast.error('Session utilisateur introuvable.');
      return;
    }
    setValidating(step.id);
    try {
      await dossierService.validateStep(step.id, user.uid);
      toast.success(`${STEP_META[step.stepType].label} validé !`);

      // La notification ne doit pas annuler la validation déjà confirmée.
      try {
        await notificationService.createNotification(
          'admin_general',
          'Document validé par le client',
          `Le client a validé : "${STEP_META[step.stepType].label}" — ${step.fileName}`,
          'mission',
          { clientId: user.uid, stepType: step.stepType }
        );
      } catch (notifyErr) {
        console.warn('[ClientSuivi] notification validate:', notifyErr);
      }
    } catch (err) {
      console.error('[ClientSuivi] validate:', err);
      toast.error('Erreur lors de la validation.');
    } finally {
      setValidating(null);
    }
  };

  const archivedDocs = steps.filter((s) => s.status === 'valide');

  const orderedStepTypes = useMemo(() => {
    const base = [...STEP_ORDER];
    const rank = (t: StepType) => {
      const st = latestPerStep[t]?.status;
      const hasDoc = Boolean(latestPerStep[t]);
      if (stepViewFilter === 'action') {
        if (st === 'soumis') return 0;
        if (st === 'valide') return 2;
        return 1;
      }
      if (stepViewFilter === 'done') {
        if (st === 'valide') return 0;
        return 1;
      }
      if (stepViewFilter === 'active') {
        if (st === 'valide') return 2;
        if (hasDoc) return 0;
        return 1;
      }
      return 0;
    };
    if (stepViewFilter === 'all') return STEP_ORDER;
    return base.sort((a, b) => rank(a) - rank(b));
  }, [stepViewFilter, latestPerStep]);

  const versionCountByType = useMemo(() => {
    const m: Partial<Record<StepType, number>> = {};
    archivedDocs.forEach((d) => {
      m[d.stepType] = (m[d.stepType] ?? 0) + 1;
    });
    return m;
  }, [archivedDocs]);

  const archiveStats = useMemo(() => {
    const totalBytes = archivedDocs.reduce((acc, s) => acc + (s.fileSize || 0), 0);
    return { totalBytes, totalCount: archivedDocs.length };
  }, [archivedDocs]);

  const processedArchive = useMemo(() => {
    const q = searchArchive.trim().toLowerCase();
    let list = archivedDocs.filter((s) => {
      const matchType = archiveStepFilter === 'all' || s.stepType === archiveStepFilter;
      if (!matchType) return false;
      if (!q) return true;
      return (
        s.fileName.toLowerCase().includes(q) ||
        STEP_META[s.stepType].label.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (archiveSort === 'name') {
        return a.fileName.localeCompare(b.fileName, 'fr', { sensitivity: 'base' });
      }
      const ta = a.validatedAt ? new Date(a.validatedAt).getTime() : 0;
      const tb = b.validatedAt ? new Date(b.validatedAt).getTime() : 0;
      if (archiveSort === 'validated_desc') return tb - ta;
      return ta - tb;
    });
    return list;
  }, [archivedDocs, searchArchive, archiveStepFilter, archiveSort]);

  const soumisCount = STEP_ORDER.filter((t) => latestPerStep[t]?.status === 'soumis').length;

  const displayName = useMemo(() => {
    const full = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    const email = user?.email ?? '';
    return email.split('@')[0] || 'Client';
  }, [user, userData]);

  const company = typeof userData?.company === 'string' ? userData.company.trim() : '';

  const firstPendingType = STEP_ORDER.find((t) => latestPerStep[t]?.status === 'soumis');

  const scrollToFirstPendingStep = () => {
    if (!firstPendingType) return;
    document.getElementById(`dossier-step-${firstPendingType}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const statusBanner = useMemo(() => {
    if (validatedCount === STEP_ORDER.length) {
      return {
        tone: 'success' as const,
        title: 'Dossier complet',
        text: 'Toutes les étapes sont validées. Vos justificatifs restent disponibles dans l’onglet Archive.',
      };
    }
    if (firstPendingType) {
      return {
        tone: 'action' as const,
        title: 'Votre validation est attendue',
        text: `Merci de consulter et de valider l’étape « ${STEP_META[firstPendingType].label} » ci-dessous pour que nous puissions poursuivre.`,
      };
    }
    if (steps.length > 0) {
      return {
        tone: 'info' as const,
        title: 'Dossier en cours',
        text: 'L’équipe Infinite met à jour vos documents au fil du projet. Vous recevrez une notification lorsqu’une étape sera prête.',
      };
    }
    return {
      tone: 'wait' as const,
      title: 'Dossier en préparation',
      text: 'Aucun document n’a encore été déposé. Votre chef de projet vous contactera via la messagerie dès que le premier livrable sera prêt.',
    };
  }, [validatedCount, firstPendingType, steps.length]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-8">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      {/* En-tête Mon dossier */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-linear-to-br from-[#0c101c] via-[#080c14] to-[#05080f] p-6 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.75),0_0_0_1px_rgba(201,169,98,0.1),inset_0_1px_0_0_rgba(255,255,255,0.05)] sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/30 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-noya-blue/12 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-luxe-champagne/25 bg-luxe-champagne/[0.07] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-luxe-champagne-bright">
              <FolderCheck className="h-3.5 w-3.5 text-noya-orange" aria-hidden />
              Mon dossier
            </div>
            <h1 className="font-display text-[1.65rem] font-medium leading-[1.15] tracking-[0.01em] text-text-primary sm:text-4xl">
              Bonjour {displayName}
              {company ? (
                <span className="mt-1 block font-sans text-lg font-semibold text-text-secondary sm:text-xl">
                  {company}
                </span>
              ) : null}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-[15px]">
              Espace sécurisé pour les livrables Infinite : consultation, téléchargement et validation des étapes Audit,
              Proposition, Contrat et Facture. Chaque validation fait avancer votre dossier.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-medium text-text-secondary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors hover:border-luxe-champagne/30 hover:text-text-primary"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Mon espace
            </Link>
            <Link
              to="/dashboard/messagerie"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-noya-blue/25 bg-noya-blue/12 px-4 py-2.5 text-sm font-semibold text-noya-blue transition-all hover:bg-noya-blue/20 hover:shadow-[0_0_24px_-8px_rgba(110,167,234,0.35)]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Messagerie
            </Link>
          </div>
        </div>
      </div>

      {/* Bandeau de statut */}
      <div
        className={`rounded-xl border px-4 py-3 sm:px-5 sm:py-4 ${
          statusBanner.tone === 'success'
            ? 'border-noya-green/30 bg-noya-green/10'
            : statusBanner.tone === 'action'
              ? 'border-noya-orange/35 bg-noya-orange/10'
              : statusBanner.tone === 'info'
                ? 'border-noya-blue/30 bg-noya-blue/10'
                : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div className="flex gap-3">
          <HelpCircle
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              statusBanner.tone === 'success'
                ? 'text-noya-green'
                : statusBanner.tone === 'action'
                  ? 'text-noya-orange'
                  : statusBanner.tone === 'info'
                    ? 'text-noya-blue'
                    : 'text-text-muted'
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary">{statusBanner.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{statusBanner.text}</p>
            {statusBanner.tone === 'action' && firstPendingType === 'audit' && latestPerStep.audit ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('progression');
                    setPreviewStep(latestPerStep.audit!);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2.5 text-sm font-bold text-noya-black shadow-[0_0_24px_-8px_rgba(110,167,234,0.45)] transition-all hover:brightness-110"
                >
                  <Eye size={16} aria-hidden />
                  Consulter l&apos;étape 1 — Audit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('progression');
                    document.getElementById('dossier-step-audit')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-noya-orange/35 hover:text-text-primary"
                >
                  <ListChecks size={16} aria-hidden />
                  Voir la fiche étape
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#0D1320]/80 px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Étapes validées</p>
          <p className="mt-1 text-2xl font-black text-noya-green">
            {validatedCount}<span className="text-base font-semibold text-text-muted">/{STEP_ORDER.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1320]/80 px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {soumisCount > 1 ? 'Actions requises' : 'En attente de vous'}
          </p>
          <p className="mt-1 text-2xl font-black text-noya-orange">{soumisCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1320]/80 px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Documents (total)</p>
          <p className="mt-1 text-2xl font-black text-noya-blue">{steps.length}</p>
        </div>
      </div>

      {/* Progression globale — pondération (soumis = partiel) + jalons */}
      <div className="rounded-2xl border border-white/10 bg-noya-sidebar/80 p-5 sm:p-6">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Progression globale
            </span>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-muted">
              Avancement estimé du dossier (étapes validées + documents en attente de votre validation). Les étapes
              contractuelles validées sont indiquées à part.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold tabular-nums text-noya-blue sm:text-3xl">{weightedProgressPct}%</span>
            <p className="mt-0.5 text-[11px] font-medium text-text-muted">
              Validé contractuellement :{' '}
              <span className="tabular-nums text-text-secondary">
                {validatedCount}/{STEP_ORDER.length} ({progressValidatedPct}%)
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            <span>Avancement dossier</span>
            <span className="tabular-nums">{weightedProgressPct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-noya-black ring-1 ring-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weightedProgressPct}%` }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="h-3 rounded-full bg-linear-to-r from-noya-blue via-noya-blue to-noya-green shadow-[0_0_20px_-4px_rgba(110,167,234,0.5)]"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {STEP_ORDER.map((stepType, i) => (
              <div key={stepType} className="h-1 overflow-hidden rounded-full bg-noya-black">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(stepWeights[i] * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 * i }}
                  className={`h-full rounded-full ${
                    stepWeights[i] >= 1
                      ? 'bg-noya-green'
                      : stepWeights[i] > 0
                        ? 'bg-noya-orange'
                        : 'bg-transparent'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <p className="sr-only">
          Progression pondérée du dossier : {weightedProgressPct} pour cent. Étapes validées contractuellement :{' '}
          {progressValidatedPct} pour cent.
        </p>

        <div className="custom-scrollbar mt-6 overflow-x-auto pb-2">
          <div className="relative flex min-w-[min(100%,22rem)] justify-between gap-2 px-2 sm:px-4">
            <div
              className="pointer-events-none absolute left-8 right-8 top-4 h-0.5 bg-white/[0.08] sm:left-10 sm:right-10"
              aria-hidden
            />
            {STEP_ORDER.map((stepType, i) => {
              const step = latestPerStep[stepType];
              const isValidated = step?.status === 'valide';
              const isCurrent = i === currentStepIdx;
              const meta = STEP_META[stepType];
              const w = stepWeights[i];
              const statusLabel = isValidated
                ? 'Validé'
                : isCurrent
                  ? 'À valider'
                  : step
                    ? step.status === 'en_attente'
                      ? 'En préparation'
                      : 'En cours'
                    : 'En attente';
              return (
                <div
                  key={stepType}
                  className="relative z-[1] flex min-w-[4.75rem] flex-1 flex-col items-center gap-2"
                  title={`${meta.label} — ${statusLabel}`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                      isValidated
                        ? 'border-noya-green bg-noya-green text-white shadow-[0_0_16px_-4px_rgba(43,198,115,0.45)]'
                        : isCurrent
                          ? 'border-noya-blue bg-noya-blue text-white ring-4 ring-noya-blue/35'
                          : step
                            ? 'border-noya-orange/90 bg-noya-orange text-white'
                            : 'border-border bg-noya-black text-text-muted'
                    }`}
                  >
                    {isValidated ? <CheckCircle size={16} /> : i + 1}
                  </div>
                  <span
                    className={`text-center text-[11px] font-semibold leading-tight ${
                      isValidated ? 'text-noya-green' : isCurrent ? 'text-noya-blue' : 'text-text-muted'
                    }`}
                  >
                    {meta.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide ${
                      isValidated
                        ? 'bg-noya-green/15 text-noya-green'
                        : isCurrent
                          ? 'bg-noya-blue/15 text-noya-blue'
                          : w > 0
                            ? 'bg-noya-orange/12 text-noya-orange'
                            : 'bg-white/[0.04] text-text-muted'
                    }`}
                  >
                    {Math.round(w * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-text-muted">
          <span className="font-semibold text-text-secondary">Lecture :</span> vert = étape validée par vous ; bleu =
          document à valider ; orange = livrable reçu, étape non encore validée ; gris = pas encore de document sur
          cette étape.
        </p>
      </div>

      {/* Onglets Mes étapes / Archive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full gap-1 rounded-xl bg-noya-black p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('progression')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all sm:flex-initial',
              activeTab === 'progression'
                ? 'bg-noya-sidebar text-noya-blue shadow-sm ring-1 ring-border'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <ListChecks size={16} aria-hidden />
            Mes étapes
            {soumisCount > 0 && (
              <span className="rounded-full bg-noya-orange/20 px-1.5 py-0.5 text-[10px] font-black text-noya-orange">
                {soumisCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all sm:flex-initial',
              activeTab === 'archive'
                ? 'bg-noya-sidebar text-noya-blue shadow-sm ring-1 ring-border'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Archive size={16} aria-hidden />
            Archive
            {archivedDocs.length > 0 && (
              <span className="rounded-full bg-noya-green/15 px-1.5 py-0.5 text-[10px] font-black text-noya-green">
                {archivedDocs.length}
              </span>
            )}
          </button>
        </div>
        {activeTab === 'archive' && archiveStats.totalCount > 0 && (
          <p className="text-xs text-text-muted sm:text-right">
            <span className="font-semibold text-text-secondary">{archiveStats.totalCount}</span> document
            {archiveStats.totalCount > 1 ? 's' : ''} archivé
            {archiveStats.totalCount > 1 ? 's' : ''} ·{' '}
            <span className="font-mono text-text-secondary">{formatFileSize(archiveStats.totalBytes)}</span> au total
          </p>
        )}
      </div>

      {activeTab === 'progression' && latestPerStep.audit && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border-2 border-noya-blue/40 bg-linear-to-br from-noya-blue/[0.14] via-[#0b101a] to-noya-black/50 p-5 shadow-[0_20px_48px_-24px_rgba(110,167,234,0.35)] sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-noya-blue/25 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-noya-blue">
                  Étape 1
                </span>
                {latestPerStep.audit.status === 'valide' ? (
                  <span className="rounded-full bg-noya-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-noya-green">
                    Validée
                  </span>
                ) : latestPerStep.audit.status === 'soumis' ? (
                  <span className="rounded-full bg-noya-orange/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-noya-orange">
                    À lire puis valider
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 font-display text-xl font-semibold text-text-primary sm:text-2xl">
                {STEP_META.audit.label}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">{STEP_META.audit.description}</p>
              <p className="mt-1 text-[11px] font-medium text-noya-blue/90">
                L&apos;étape 1 est fournie au format PDF — le téléchargement utilise une extension .pdf.
              </p>
              <p className="mt-2 truncate text-xs text-text-muted" title={latestPerStep.audit.fileName}>
                <span className="font-semibold text-text-secondary">{latestPerStep.audit.fileName}</span>
                <span className="mx-1.5 text-border">·</span>
                {formatFileSize(latestPerStep.audit.fileSize)}
                <span className="mx-1.5 text-border">·</span>
                reçu le{' '}
                {format(new Date(latestPerStep.audit.uploadedAt), 'dd MMM yyyy', { locale: fr })}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewStep(latestPerStep.audit!)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-noya-blue px-5 py-3 text-sm font-bold text-noya-black shadow-[0_0_28px_-10px_rgba(110,167,234,0.5)] transition-all hover:brightness-110"
              >
                <Eye size={18} aria-hidden />
                Consulter ici
              </button>
              <a
                href={absoluteUrlOnClient(latestPerStep.audit.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-noya-blue/40 hover:text-noya-blue"
              >
                <ExternalLink size={16} aria-hidden />
                Nouvel onglet
              </a>
              <a
                href={absoluteUrlOnClient(latestPerStep.audit.fileUrl)}
                download={dossierDownloadFileName(latestPerStep.audit)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-noya-green/40 hover:text-noya-green"
              >
                <Download size={16} aria-hidden />
                Télécharger
              </a>
            </div>
          </div>
          {latestPerStep.audit.status === 'soumis' ? (
            <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-text-muted">
              Après lecture du rapport, validez l&apos;étape dans la fiche détaillée ci-dessous pour débloquer la suite du
              dossier.
            </p>
          ) : null}
        </motion.div>
      )}

      {activeTab === 'progression' && (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-noya-black/35 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les étapes">
            {(
              [
                { id: 'all' as const, label: 'Toutes' },
                { id: 'action' as const, label: 'À valider' },
                { id: 'active' as const, label: 'Avec livrable' },
                { id: 'done' as const, label: 'Validées' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setStepViewFilter(id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  stepViewFilter === id
                    ? 'bg-noya-blue/20 text-noya-blue ring-1 ring-noya-blue/30'
                    : 'text-text-muted hover:bg-white/5 hover:text-text-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {firstPendingType ? (
            <button
              type="button"
              onClick={scrollToFirstPendingStep}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-noya-orange/35 bg-noya-orange/10 px-3 py-2 text-xs font-bold text-noya-orange transition-colors hover:bg-noya-orange/20"
            >
              <Sparkles size={14} aria-hidden />
              Aller à l&apos;étape à valider
            </button>
          ) : null}
        </div>
      )}

      {/* Steps view */}
      {activeTab === 'progression' && (
        <div className="space-y-4">
          {orderedStepTypes.map((stepType) => {
            const idx = STEP_ORDER.indexOf(stepType);
            const step = latestPerStep[stepType];
            const meta = STEP_META[stepType];
            const theme = STEP_THEME[meta.color] ?? STEP_THEME.blue;
            const isValidated = step?.status === 'valide';
            const isSoumis = step?.status === 'soumis';
            const isEmpty = !step;
            // Locked if previous step not validated yet
            const isLocked = idx > 0 && latestPerStep[STEP_ORDER[idx - 1]]?.status !== 'valide' && isEmpty;

            const archivedVersions = versionCountByType[stepType] ?? 0;

            return (
              <motion.div
                id={`dossier-step-${stepType}`}
                key={stepType}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={cn(
                  'scroll-mt-28 overflow-hidden rounded-2xl border bg-noya-sidebar shadow-sm',
                  isValidated
                    ? 'border-noya-green/35'
                    : isSoumis
                      ? 'border-noya-blue/30 ring-2 ring-noya-blue/20 ring-offset-1 ring-offset-[#0a0f18]'
                      : 'border-border',
                )}
              >
                {/* Step header */}
                <div
                  className={cn(
                    'flex items-center gap-4 border-l-[3px] px-5 py-4',
                    isValidated
                      ? 'border-l-noya-green bg-noya-green/10'
                      : isSoumis
                        ? 'border-l-noya-blue bg-noya-blue/10'
                        : 'border-l-transparent bg-noya-black/50',
                  )}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                      isValidated
                        ? 'bg-noya-green/20 text-noya-green'
                        : isSoumis
                          ? theme.iconBox
                          : 'bg-noya-black text-text-muted'
                    }`}
                  >
                    {isValidated ? <CheckCircle size={20} /> :
                     isEmpty ? <Lock size={18} /> :
                     <FileText size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-text-primary">{`Étape ${idx + 1} — ${meta.label}`}</p>
                      {isValidated && (
                        <span className="rounded-full bg-noya-green/15 px-2 py-0.5 text-xs font-medium text-noya-green">
                          Validé
                        </span>
                      )}
                      {isSoumis && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${theme.badge}`}>
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
                    {archivedVersions > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setArchiveStepFilter(stepType);
                          setActiveTab('archive');
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-left text-[11px] font-medium text-noya-blue underline-offset-2 hover:underline"
                      >
                        {archivedVersions} versions dans l&apos;archive — voir
                        <ChevronRight className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </div>
                  {isValidated && step?.validatedAt && (
                    <p className="flex-shrink-0 text-xs font-medium text-noya-green">
                      {format(new Date(step.validatedAt), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>

                {/* Step body — doc available */}
                {step && (
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${theme.iconBox}`}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary text-sm">{step.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-text-muted">{formatFileSize(step.fileSize)}</p>
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

                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewStep(step)}
                          className="flex items-center gap-1.5 rounded-xl border border-noya-blue/40 bg-noya-blue/15 px-3 py-2 text-sm font-semibold text-noya-blue transition-colors hover:bg-noya-blue/25"
                        >
                          <Eye size={15} aria-hidden />
                          {stepType === 'audit' ? 'Consulter (étape 1)' : 'Consulter'}
                        </button>
                        <a
                          href={absoluteUrlOnClient(step.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-noya-black"
                        >
                          <ExternalLink size={15} aria-hidden />
                          Onglet
                        </a>
                        <a
                          href={absoluteUrlOnClient(step.fileUrl)}
                          download={dossierDownloadFileName(step)}
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-noya-black"
                        >
                          <Download size={15} aria-hidden />
                          Télécharger
                        </a>
                        {isSoumis && (
                          <button
                            onClick={() => handleValidate(step)}
                            disabled={validating === step.id}
                            className="flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2 text-sm font-semibold text-noya-black transition-colors hover:brightness-110 disabled:opacity-50"
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
                          <div className="flex items-center gap-1.5 rounded-xl border border-noya-green/30 bg-noya-green/10 px-4 py-2 text-sm font-semibold text-noya-green">
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
                    <div className="flex items-center gap-2 text-sm italic text-text-muted">
                      <Clock size={14} aria-hidden />
                      {isLocked
                        ? "Cette étape sera disponible après validation de l'étape précédente."
                        : 'Document en cours de préparation par votre équipe Infinite.'}
                    </div>
                    

                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Archive — recherche, filtres par type, tri */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={searchArchive}
                onChange={(e) => setSearchArchive(e.target.value)}
                placeholder="Nom de fichier ou type d’étape…"
                className="w-full rounded-xl border border-border bg-noya-sidebar py-2.5 pl-9 pr-10 text-sm text-text-primary outline-none ring-noya-blue/40 focus:ring-2"
                aria-label="Rechercher dans l’archive"
              />
              {searchArchive.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchArchive('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-text-muted hover:bg-white/5 hover:text-text-primary"
                >
                  Effacer
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-noya-black/40 p-1">
              <span className="hidden px-2 text-[10px] font-black uppercase tracking-wider text-text-muted sm:inline">
                Tri
              </span>
              <button
                type="button"
                onClick={() => setArchiveSort('validated_desc')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  archiveSort === 'validated_desc'
                    ? 'bg-noya-sidebar text-noya-blue ring-1 ring-border'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <ArrowDownWideNarrow size={14} aria-hidden />
                Plus récent
              </button>
              <button
                type="button"
                onClick={() => setArchiveSort('validated_asc')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  archiveSort === 'validated_asc'
                    ? 'bg-noya-sidebar text-noya-blue ring-1 ring-border'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <ArrowUpNarrowWide size={14} aria-hidden />
                Plus ancien
              </button>
              <button
                type="button"
                onClick={() => setArchiveSort('name')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  archiveSort === 'name'
                    ? 'bg-noya-sidebar text-noya-blue ring-1 ring-border'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <SortAsc size={14} aria-hidden />
                A → Z
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par type d’étape">
            <button
              type="button"
              onClick={() => setArchiveStepFilter('all')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                archiveStepFilter === 'all'
                  ? 'bg-noya-blue/20 text-noya-blue ring-1 ring-noya-blue/35'
                  : 'bg-white/[0.04] text-text-muted hover:bg-white/10',
              )}
            >
              Tous
            </button>
            {STEP_ORDER.map((t) => {
              const n = archivedDocs.filter((d) => d.stepType === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setArchiveStepFilter(t)}
                  disabled={n === 0}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    archiveStepFilter === t
                      ? 'bg-noya-green/15 text-noya-green ring-1 ring-noya-green/30'
                      : 'bg-white/[0.04] text-text-muted hover:bg-white/10',
                  )}
                >
                  {STEP_META[t].label}
                  {n > 0 ? (
                    <span className="ml-1 tabular-nums opacity-80">({n})</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {processedArchive.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-noya-sidebar py-14 text-text-muted">
              <Archive size={40} className="opacity-20" aria-hidden />
              <p className="max-w-sm text-center font-medium text-text-secondary">
                {archivedDocs.length === 0
                  ? 'Aucun document validé pour le moment. Les fichiers apparaîtront ici une fois chaque étape validée.'
                  : 'Aucun résultat : modifiez la recherche ou le filtre par type.'}
              </p>
              {archivedDocs.length > 0 && (searchArchive.trim() || archiveStepFilter !== 'all') ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchArchive('');
                    setArchiveStepFilter('all');
                  }}
                  className="text-sm font-semibold text-noya-blue hover:underline"
                >
                  Réinitialiser filtres
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-noya-sidebar shadow-sm">
              <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-bold text-text-primary">Documents validés</h2>
                <span className="text-xs text-text-muted">
                  {processedArchive.length} affiché{processedArchive.length > 1 ? 's' : ''}
                  {processedArchive.length !== archivedDocs.length ? (
                    <span className="text-text-muted/80"> sur {archivedDocs.length}</span>
                  ) : null}
                </span>
              </div>
              <ul className="divide-y divide-border" aria-label="Liste des documents archivés">
                {processedArchive.map((step, rowIdx) => {
                  const meta = STEP_META[step.stepType];
                  const archTheme = STEP_THEME[meta.color] ?? STEP_THEME.blue;
                  return (
                    <motion.li
                      key={step.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(rowIdx * 0.04, 0.35) }}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-noya-black/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                        <div className={cn('rounded-xl p-2.5', archTheme.iconBox)}>
                          <FileText size={18} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-text-primary text-sm">{step.fileName}</p>
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', archTheme.badge)}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                            <span>{formatFileSize(step.fileSize)}</span>
                            <span className="text-border" aria-hidden>
                              ·
                            </span>
                            <span className="text-noya-green">
                              Validé le{' '}
                              {step.validatedAt
                                ? format(new Date(step.validatedAt), 'd MMM yyyy', { locale: fr })
                                : '—'}
                            </span>
                            {step.uploadedByName ? (
                              <>
                                <span className="text-border" aria-hidden>
                                  ·
                                </span>
                                <span>Envoyé par {step.uploadedByName}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
                        <button
                          type="button"
                          onClick={() => setPreviewStep(step)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-noya-blue/35 bg-noya-blue/10 px-3 py-2 text-xs font-semibold text-noya-blue transition-colors hover:bg-noya-blue/20"
                        >
                          <Eye size={15} aria-hidden />
                          Consulter
                        </button>
                        <a
                          href={absoluteUrlOnClient(step.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-noya-blue/40 hover:bg-noya-blue/5 hover:text-noya-blue"
                        >
                          <ExternalLink size={15} aria-hidden />
                          Onglet
                        </a>
                        <a
                          href={absoluteUrlOnClient(step.fileUrl)}
                          download={dossierDownloadFileName(step)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-noya-green/40 hover:bg-noya-green/5 hover:text-noya-green"
                        >
                          <Download size={15} aria-hidden />
                          Télécharger
                        </a>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {previewStep ? <DocumentConsultModal step={previewStep} onClose={() => setPreviewStep(null)} /> : null}
    </div>
  );
}
