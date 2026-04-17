import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  Mail,
  FolderOpen,
  MessageCircle,
  Building2,
  Phone,
  UserRoundCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCommandoClients, clientDisplayName, type CommandoClientRow } from '../../hooks/useCommandoClients';
import { dossierService, STEP_ORDER, type DossierStep, type StepType } from '../../services/dossierService';

function createdIso(c: CommandoClientRow): string | null {
  const raw = c.createdAt as unknown;
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
    return (raw as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function formatJoined(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function latestPerStepForClient(steps: DossierStep[], clientId: string): Partial<Record<StepType, DossierStep>> {
  const map: Partial<Record<StepType, DossierStep>> = {};
  for (const s of steps) {
    if (s.clientId !== clientId) continue;
    const ex = map[s.stepType];
    if (!ex || s.uploadedAt > ex.uploadedAt) map[s.stepType] = s;
  }
  return map;
}

function dossierMetrics(steps: DossierStep[], clientId: string) {
  const latest = latestPerStepForClient(steps, clientId);
  const validated = STEP_ORDER.filter((t) => latest[t]?.status === 'valide').length;
  const awaitingClient = STEP_ORDER.some((t) => latest[t]?.status === 'soumis');
  return { validated, total: STEP_ORDER.length, awaitingClient };
}

export default function AdminClients() {
  const location = useLocation();
  const { clients, loading } = useCommandoClients();
  const [search, setSearch] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'referred' | 'padde'>('all');
  const [partnerFilterId, setPartnerFilterId] = useState('');
  const [allSteps, setAllSteps] = useState<DossierStep[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const partnerId = params.get('partnerId') || '';
    if (partnerId) {
      setReferralFilter('referred');
      setPartnerFilterId(partnerId);
    } else {
      setPartnerFilterId('');
    }
  }, [location.search]);

  useEffect(() => {
    const unsub = dossierService.subscribeToAllSteps(setAllSteps);
    return () => unsub();
  }, []);

  const pendingGlobal = useMemo(
    () => allSteps.filter((s) => s.status === 'soumis').length,
    [allSteps]
  );

  const monthStartIso = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const newThisMonth = useMemo(
    () => clients.filter((c) => (createdIso(c) || '') >= monthStartIso).length,
    [clients, monthStartIso]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped =
      referralFilter === 'referred'
        ? clients.filter((c) => Boolean(c.referredByPartnerName))
        : referralFilter === 'padde'
          ? clients.filter((c) => String(c.source || '').toLowerCase() === 'padde-ci')
          : clients;
    const scopedByPartner = partnerFilterId
      ? scoped.filter((c) => String(c.referredByPartnerId || '') === partnerFilterId)
      : scoped;

    if (!q) return scopedByPartner;
    return scopedByPartner.filter((c) => {
      const blob = `${clientDisplayName(c)} ${c.email || ''} ${c.companyName || ''} ${c.phone || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [clients, search, referralFilter, partnerFilterId]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10 pb-20">
      <div className="mb-8 flex flex-col gap-4 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="commando-luxe-ornament-diamond mt-1.5 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-luxe-champagne-bright/85">CRM</p>
            <h1 className="mt-1 font-display text-3xl font-normal tracking-tight text-text-primary md:text-4xl">
              Carnet clients
            </h1>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">
              Comptes portail, parcours dossier et accès rapides vers la messagerie et les archives.
            </p>
          </div>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted transition-colors hover:border-luxe-champagne/30 hover:text-luxe-champagne-bright sm:self-auto"
        >
          Tableau de bord
          <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Portefeuille</p>
          <p className="mt-2 font-display text-3xl text-luxe-champagne-bright">{loading ? '—' : clients.length}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Comptes clients actifs</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Attente validation</p>
          <p className="mt-2 font-display text-3xl text-noya-orange">{pendingGlobal}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Documents soumis côté client</p>
        </div>
        <div className="commando-luxe-stat-slab px-5 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-text-dim">Ce mois-ci</p>
          <p className="mt-2 font-display text-3xl text-text-primary">{loading ? '—' : newThisMonth}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">Nouvelles inscriptions</p>
        </div>
      </div>

      <div className="commando-luxe-hero-shell relative mt-10 overflow-hidden rounded-2xl border border-luxe-champagne/15 bg-noya-sidebar/45 p-5 backdrop-blur-md md:p-6">
        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReferralFilter('all')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                referralFilter === 'all'
                  ? 'border-luxe-champagne/40 bg-luxe-champagne/10 text-luxe-champagne-bright'
                  : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary'
              )}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setReferralFilter('referred')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                referralFilter === 'referred'
                  ? 'border-noya-blue/45 bg-noya-blue/15 text-noya-blue'
                  : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary'
              )}
            >
              Parrainés
            </button>
            <button
              type="button"
              onClick={() => setReferralFilter('padde')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                referralFilter === 'padde'
                  ? 'border-noya-orange/45 bg-noya-orange/15 text-noya-orange'
                  : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary'
              )}
            >
              PADDE-CI
            </button>
            {partnerFilterId ? (
              <button
                type="button"
                onClick={() => setPartnerFilterId('')}
                className="rounded-lg border border-noya-blue/35 bg-noya-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-noya-blue transition-colors hover:bg-noya-blue/20"
              >
                Filtre partenaire actif · réinitialiser
              </button>
            ) : null}
          </div>
          <label htmlFor="crm-search" className="sr-only">
            Rechercher un client
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-luxe-champagne/50" aria-hidden />
            <input
              id="crm-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, e-mail, société…"
              className="w-full rounded-xl border border-white/10 bg-black/20 py-3.5 pl-11 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-dim focus:border-luxe-champagne/35 focus:ring-1 focus:ring-luxe-champagne/20"
            />
          </div>
          <p className="mt-3 text-[11px] text-text-muted">
            {loading ? 'Chargement…' : `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/8 bg-noya-sidebar/35 shadow-[0_24px_64px_-40px_rgba(0,0,0,0.85)]">
        <div className="hidden grid-cols-[1.2fr_1.4fr_0.9fr_1fr_auto] gap-4 border-b border-white/6 bg-black/15 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-text-dim lg:grid">
          <span>Client</span>
          <span>Coordonnées</span>
          <span>Inscription</span>
          <span>Parcours dossier</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y divide-white/6">
          {loading ? (
            <li className="px-5 py-16 text-center text-sm text-text-muted">Chargement du carnet…</li>
          ) : filtered.length === 0 ? (
            <li className="px-5 py-16 text-center text-sm text-text-muted">Aucun client ne correspond à votre recherche.</li>
          ) : (
            filtered.map((c) => (
              <Fragment key={c.id}>
                <ClientRow client={c} steps={allSteps} />
              </Fragment>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ClientRow({ client, steps }: { client: CommandoClientRow; steps: DossierStep[] }) {
  const { validated, total, awaitingClient } = dossierMetrics(steps, client.id);
  const joined = formatJoined(createdIso(client));
  const name = clientDisplayName(client);

  return (
    <li>
      <div className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.03] lg:grid lg:grid-cols-[1.2fr_1.4fr_0.9fr_1fr_auto] lg:items-center lg:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-luxe-champagne/25 bg-linear-to-br from-luxe-champagne/15 to-noya-blue/10 font-display text-sm font-medium text-luxe-champagne-bright">
            {(name[0] || '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{name}</p>
            {client.companyName ? (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-muted">
                <Building2 className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                {client.companyName}
              </p>
            ) : null}
            {client.referredByPartnerName ? (
              <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noya-blue">
                <UserRoundCheck className="h-3 w-3 shrink-0" aria-hidden />
                Parrainé par {client.referredByPartnerName}
              </p>
            ) : null}
            {String(client.source || '').toLowerCase() === 'padde-ci' ? (
              <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-noya-orange/30 bg-noya-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noya-orange">
                <Globe className="h-3 w-3 shrink-0" aria-hidden />
                Source PADDE-CI
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {client.email ? (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-2 text-text-secondary transition-colors hover:text-luxe-champagne-bright"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-luxe-champagne/50" aria-hidden />
              <span className="truncate">{client.email}</span>
            </a>
          ) : (
            <span className="text-text-dim">—</span>
          )}
          {client.phone ? (
            <p className="flex items-center gap-2 text-xs text-text-muted">
              <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              {client.phone}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-sm text-text-secondary lg:block">
          <Clock className="h-3.5 w-3.5 text-text-dim lg:hidden" aria-hidden />
          {joined}
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-luxe-champagne/80 to-noya-blue/90 transition-all"
              style={{ width: `${Math.round((validated / total) * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-noya-green/80" aria-hidden />
              {validated}/{total} étapes validées
            </span>
            {awaitingClient ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-noya-orange/25 bg-noya-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noya-orange">
                <AlertCircle className="h-3 w-3" aria-hidden />
                Attente client
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            to="/admin/dossiers"
            state={{ selectClientId: client.id }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all',
              'border-luxe-champagne/30 bg-luxe-champagne/10 text-luxe-champagne-bright hover:border-luxe-champagne/50 hover:bg-luxe-champagne/15'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            Dossier
          </Link>
          <Link
            to={`/admin/messagerie?client=${encodeURIComponent(client.id)}`}
            state={{ selectClientId: client.id }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted transition-all hover:border-noya-blue/30 hover:text-noya-blue"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Chat
          </Link>
        </div>
      </div>
    </li>
  );
}
