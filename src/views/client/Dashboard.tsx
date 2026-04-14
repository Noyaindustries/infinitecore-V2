import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ExternalLink,
  FolderCheck,
  LayoutDashboard,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../components/FirebaseProvider';
import { PADDE_CI_FREE_AUDITS } from '../../data/paddeCiFreeAudits';
import { openPaddeCiAuditForm } from '../../utils/openPaddeCiAuditForm';
import {
  dossierService,
  DossierStep,
  STEP_META,
  STEP_ORDER,
  StepType,
} from '../../services/dossierService';

const AUDIT_ICONS = {
  'audit-rapide': Zap,
  'audit-business': Search,
  'audit-institutionnel': Building2,
} as const;

function useDossierProgress(clientId: string | undefined) {
  const [steps, setSteps] = useState<DossierStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    const unsub = dossierService.subscribeToClientSteps(clientId, (data) => {
      setSteps(data);
      setLoading(false);
    });
    return () => unsub();
  }, [clientId]);

  return useMemo(() => {
    const latestPerStep: Partial<Record<StepType, DossierStep>> = {};
    steps.forEach((s) => {
      const existing = latestPerStep[s.stepType];
      if (!existing || s.uploadedAt > existing.uploadedAt) {
        latestPerStep[s.stepType] = s;
      }
    });

    const validatedCount = STEP_ORDER.filter((t) => latestPerStep[t]?.status === 'valide').length;
    const progressPct = Math.round((validatedCount / STEP_ORDER.length) * 100);
    const awaiting = STEP_ORDER.find((t) => latestPerStep[t]?.status === 'soumis');

    let statusMessage = 'Votre équipe Infinite peut déposer des documents à tout moment — vous serez notifié.';
    if (validatedCount === STEP_ORDER.length) {
      statusMessage = 'Toutes les étapes de votre dossier sont validées. Conservez vos justificatifs dans Mon dossier.';
    } else if (awaiting) {
      statusMessage = `Action requise : valider « ${STEP_META[awaiting].label} » dans Mon dossier.`;
    } else if (steps.length > 0) {
      statusMessage = 'Votre dossier avance. Consultez Mon dossier pour la suite des étapes.';
    }

    return { loading, steps, progressPct, validatedCount, awaiting, statusMessage };
  }, [steps, loading]);
}

const quickLinks = [
  {
    to: '/dashboard/suivi',
    icon: FolderCheck,
    title: 'Mon dossier',
    description: 'Documents, validations et historique.',
    border:
      'border-white/[0.08] hover:border-luxe-champagne/35 hover:shadow-[0_0_36px_-12px_rgba(201,169,98,0.2)]',
    iconBg: 'bg-noya-blue/12 text-noya-blue ring-1 ring-white/5',
  },
  {
    to: '/dashboard/messagerie',
    icon: MessageCircle,
    title: 'Messagerie',
    description: 'Échangez avec votre équipe Infinite.',
    border: 'border-white/[0.08] hover:border-white/18',
    iconBg: 'bg-white/[0.06] text-luxe-champagne/90 ring-1 ring-luxe-champagne/15',
  },
  {
    to: '/dashboard/boutique',
    icon: ShoppingCart,
    title: 'Boutique & services',
    description: 'Modules, packs et options pour votre croissance.',
    border: 'border-white/[0.08] hover:border-noya-orange/40 hover:shadow-[0_0_32px_-10px_rgba(255,179,50,0.15)]',
    iconBg: 'bg-noya-orange/12 text-noya-orange ring-1 ring-white/5',
  },
  {
    to: '/dashboard/profil',
    icon: User,
    title: 'Mon profil',
    description: 'Coordonnées et préférences du compte.',
    border: 'border-white/[0.08] hover:border-white/18',
    iconBg: 'bg-white/[0.06] text-text-secondary ring-1 ring-white/8',
  },
] as const;

export default function ClientDashboard() {
  const { user, userData } = useAuth();
  const { loading, progressPct, validatedCount, awaiting, statusMessage } = useDossierProgress(user?.uid);

  const displayName = useMemo(() => {
    const full = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (user?.displayName) return user.displayName;
    const email = user?.email ?? '';
    const local = email.split('@')[0];
    return local || 'Client';
  }, [user, userData]);

  const company = typeof userData?.company === 'string' ? userData.company.trim() : '';
  const industry = typeof userData?.industry === 'string' ? userData.industry.trim() : '';
  const pack = typeof userData?.pack === 'string' ? userData.pack : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-10">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-linear-to-br from-[#0c101c] via-[#080c14] to-[#05080f] p-6 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.75),0_0_0_1px_rgba(201,169,98,0.12),inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:p-9">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_80px_rgba(110,167,234,0.06)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-noya-blue/12 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-luxe-champagne/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/35 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-luxe-champagne/25 bg-luxe-champagne/[0.07] px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-luxe-champagne-bright">
              <LayoutDashboard className="h-3.5 w-3.5 text-noya-blue" aria-hidden />
              Mon espace
            </div>
            <h1 className="font-display text-[1.65rem] font-medium leading-[1.15] tracking-[0.02em] text-text-primary sm:text-4xl">
              Bonjour, {displayName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-[15px]">
              Votre portail privé Infinite Core : dossier, messagerie, boutique et profil — pensé comme une expérience
              premium, claire et sans friction.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex items-center gap-2.5 rounded-xl border border-luxe-champagne/30 bg-linear-to-br from-luxe-champagne/15 to-noya-orange/10 px-4 py-3 text-sm text-luxe-champagne-bright shadow-[0_0_24px_-8px_rgba(201,169,98,0.35)]">
              <Sparkles className="h-5 w-5 shrink-0 text-noya-orange" aria-hidden />
              <span className="font-semibold tracking-wide">Infinite Core</span>
            </div>
            <p className="max-w-[220px] text-right text-[11px] leading-snug text-text-muted sm:text-xs">
              Signature digitale &amp; suivi en temps réel.
            </p>
          </div>
        </div>
      </div>

      {/* Résumé compte + progression dossier */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0e18]/85 p-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">
            Votre organisation
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-text-muted">Entreprise</p>
              <p className="mt-0.5 font-medium text-text-primary">{company || '—'}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase text-text-muted">Secteur</p>
                <p className="mt-0.5 text-text-secondary">{industry || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-text-muted">Formule</p>
                <p className="mt-0.5 text-text-secondary capitalize">{pack || 'Starter'}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-text-muted">Email</p>
              <p className="mt-0.5 truncate text-text-secondary">{user?.email ?? '—'}</p>
            </div>
          </div>
          <Link
            to="/dashboard/profil"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-noya-blue transition-all hover:gap-2 hover:text-luxe-champagne-bright"
          >
            Mettre à jour le profil
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0e18]/85 p-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">
              Dossier Infinite
            </h2>
            {!loading && (
              <span className="text-xs font-bold text-noya-blue">{progressPct}%</span>
            )}
          </div>
          {loading ? (
            <div className="mt-6 h-3 animate-pulse rounded-full bg-white/10" aria-hidden />
          ) : (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div
                  className="h-full max-w-full rounded-full bg-linear-to-r from-noya-blue to-noya-orange transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="sr-only">Progression du dossier : {progressPct} pour cent.</p>
              <p className="mt-3 text-xs leading-relaxed text-text-secondary sm:text-sm">
                {statusMessage}
              </p>
              <p className="mt-2 text-[11px] text-text-muted">
                {validatedCount} / {STEP_ORDER.length} étapes validées
                {awaiting ? ` · En attente : ${STEP_META[awaiting].label}` : ''}
              </p>
            </>
          )}
          <Link
            to="/dashboard/suivi"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-noya-orange transition-all hover:gap-2 hover:text-luxe-champagne-bright"
          >
            Ouvrir Mon dossier
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* Les 3 audits PADDE-CI gratuits */}
      <section className="relative overflow-hidden rounded-2xl border border-noya-orange/30 bg-linear-to-br from-[#120c08]/90 via-[#0a0e18]/95 to-[#080c14]/95 p-5 shadow-[0_28px_56px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,179,50,0.12)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-noya-orange/15 blur-3xl" aria-hidden />
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-noya-orange">
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]">PADDE-CI · Gratuit</span>
            </div>
            <h2 className="font-display text-xl font-medium text-text-primary sm:text-2xl">Vos audits disponibles</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Rapide, Business ou Institutionnel — lancez le formulaire depuis ici (nouvel onglet). Les mêmes offres figurent aussi dans la boutique.
            </p>
          </div>
          <Link
            to="/dashboard/boutique"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-noya-blue transition-all hover:gap-2 hover:text-luxe-champagne-bright"
          >
            Boutique & services
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PADDE_CI_FREE_AUDITS.slice(0, 3).map((audit) => {
            const Icon = AUDIT_ICONS[audit.id as keyof typeof AUDIT_ICONS];
            return (
              <div
                key={audit.id}
                className="flex flex-col rounded-xl border border-white/[0.08] bg-[#060910]/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-5"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-noya-orange/12 text-noya-orange ring-1 ring-noya-orange/25">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-snug text-text-primary sm:text-[15px]">{audit.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-noya-green">Gratuit</p>
                  </div>
                </div>
                <p className="mb-4 flex-1 text-xs leading-relaxed text-text-secondary sm:text-sm">{audit.desc}</p>
                <p className="mb-3 text-[11px] text-text-muted">
                  Délai indicatif : <span className="text-text-secondary">{audit.duration}</span>
                </p>
                <button
                  type="button"
                  onClick={() => openPaddeCiAuditForm(audit.formUrl)}
                  className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-noya-orange to-[#ffc85c] px-3 py-2.5 text-xs font-bold text-noya-black shadow-[0_8px_24px_-8px_rgba(255,179,50,0.45)] transition-all hover:brightness-105 sm:text-sm"
                >
                  Demander l&apos;audit
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Raccourcis */}
      <div>
        <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">
          Accès rapides
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative flex gap-4 overflow-hidden rounded-2xl border bg-[#080c14]/90 p-5 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all duration-300 ${item.border}`}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(201,169,98,0.08),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <div
                className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
              >
                <item.icon className="h-6 w-6" aria-hidden strokeWidth={1.75} />
              </div>
              <div className="relative min-w-0 flex-1">
                <h3 className="font-display text-lg font-medium text-text-primary group-hover:text-luxe-champagne-bright">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-noya-blue transition-all group-hover:gap-2 group-hover:text-luxe-champagne-bright">
                  Accéder
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bloc aide */}
      <div className="rounded-2xl border border-luxe-champagne/20 bg-linear-to-br from-white/[0.04] to-transparent px-5 py-5 sm:px-7">
        <p className="text-sm leading-relaxed text-text-secondary">
          <span className="font-display text-base font-medium text-text-primary">Besoin d&apos;aide ?</span>{' '}
          Utilisez la messagerie pour joindre votre interlocuteur, ou consultez l&apos;état de vos demandes dans{' '}
          <Link to="/dashboard/suivi" className="font-semibold text-noya-blue underline decoration-noya-blue/30 underline-offset-4 transition-colors hover:text-luxe-champagne-bright hover:decoration-luxe-champagne/40">
            Mon dossier
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
