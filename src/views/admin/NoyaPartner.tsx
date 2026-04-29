import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Handshake, ShieldCheck, X, Mail, Phone, Building2, FileText } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';

const NOYA_RECRUTEMENT_URL = 'https://www.noyaindustries.com/recrutement';
const NOYA_RECRUTEMENT_SOURCE = 'noya-recrutement';

type NoyaRecruitmentLead = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsapp?: string;
  phone?: string;
  companyName?: string;
  status?: string;
  createdAt?: string;
  source?: string;
  sourcePlatform?: string;
  partnerId?: string;
  partnerName?: string;
  parcours?: 'partenaire' | 'investisseur' | string;
  urgency?: string;
  note?: string;
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminNoyaPartner() {
  const [rows, setRows] = useState<NoyaRecruitmentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NoyaRecruitmentLead | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'leads'),
        where('source', '==', NOYA_RECRUTEMENT_SOURCE),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NoyaRecruitmentLead, 'id'>),
        }));
        setRows(data);
        setLoading(false);
      },
      (error) => {
        console.error('[AdminNoyaPartner] lead stream error:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const submitted = rows.filter((r) => String(r.status || '').toLowerCase() === 'soumis').length;
    return { total: rows.length, submitted };
  }, [rows]);

  const getParcoursLabel = (r: NoyaRecruitmentLead) => {
    const p = String(r.parcours || '').toLowerCase();
    if (p === 'investisseur') return 'Investisseur';
    if (p === 'partenaire') return 'Partenaire';
    // Fallback via libellé du partenaire (ancienne donnée).
    const pn = String(r.partnerName || '').toLowerCase();
    if (pn.includes('investisseur')) return 'Investisseur';
    return 'Partenaire';
  };

  const closeModal = () => setSelected(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-text-primary tracking-tight">Noya Partenaire</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Espace de pilotage du formulaire partenaire Noya Industries.
        </p>
      </div>

      <section className="rounded-2xl border border-border-subtle bg-surface-secondary p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-noya-blue/15 p-2 text-noya-blue">
            <Handshake size={18} />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Formulaire Noya Industries</h2>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          Les inscriptions envoyées depuis le formulaire externe sont traitées via le webhook
          recrutement et rattachées au partenaire Noya quand la variable
          <code className="mx-1 rounded bg-surface-primary px-1.5 py-0.5 text-xs">NOYA_RECRUTEMENT_PARTNER_ID</code>
          est définie côté API.
        </p>

        <a
          href={NOYA_RECRUTEMENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2.5 text-sm font-black text-noya-black transition-all hover:scale-[1.02]"
        >
          Ouvrir le formulaire Noya
          <ExternalLink size={16} />
        </a>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-secondary p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Dernières inscriptions Noya</h2>
            <p className="text-xs text-text-secondary">
              Flux live des leads issus de <code>source: "noya-recrutement"</code>.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border-subtle bg-surface-primary px-3 py-1 text-text-secondary">
              Total : <strong className="text-text-primary">{stats.total}</strong>
            </span>
            <span className="rounded-full border border-border-subtle bg-surface-primary px-3 py-1 text-text-secondary">
              Soumis : <strong className="text-text-primary">{stats.submitted}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-primary/60">
              <tr className="text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Parcours</th>
                <th className="px-4 py-3">Reçu le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                    Chargement des inscriptions...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                    Aucune inscription Noya détectée pour le moment.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">
                        {`${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Nouveau contact'}
                      </div>
                      <div className="text-xs text-text-secondary">{row.email || row.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{row.companyName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-noya-blue/30 bg-noya-blue/10 px-2.5 py-1 text-[11px] font-semibold text-noya-blue">
                        {row.status || 'soumis'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{getParcoursLabel(row)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-primary/30 px-3 py-2 text-[12px] font-semibold text-text-secondary hover:text-text-primary hover:border-border-medium transition-all"
                      >
                        <FileText size={14} />
                        Détails
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 bg-noya-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-3xl border border-border-medium bg-surface-secondary shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border-subtle">
              <div>
                <h3 className="text-xl font-black text-text-primary">
                  Détails soumission Noya
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {getParcoursLabel(selected)} · Reçu le {formatDate(selected.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-surface-tertiary transition-colors text-text-secondary"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border-subtle bg-surface-primary/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Mail size={16} />
                    Contact
                  </div>
                  <div className="text-sm text-text-secondary">
                    <div className="font-semibold text-text-primary">
                      {`${selected.firstName || ''} ${selected.lastName || ''}`.trim() || '—'}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Mail size={14} className="opacity-70" />
                      <span>{selected.email || '—'}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Phone size={14} className="opacity-70" />
                      <span>{selected.phone || selected.whatsapp || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface-primary/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Building2 size={16} />
                    Entreprise / Candidat
                  </div>
                  <div className="text-sm text-text-secondary">
                    <div className="font-semibold text-text-primary">{selected.companyName || '—'}</div>
                    <div className="mt-1">
                      Statut :{' '}
                      <span className="font-bold text-text-primary">{selected.status || 'soumis'}</span>
                    </div>
                    {selected.urgency ? (
                      <div className="mt-1">
                        Urgence : <span className="font-bold text-text-primary">{selected.urgency}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-surface-primary/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <FileText size={16} />
                  Message / Proposition
                </div>
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {selected.note || '—'}
                </div>
              </div>

              <div className="text-xs text-text-dim">
                id lead: <span className="font-mono text-text-secondary">{selected.id}</span>
                {selected.sourcePlatform ? (
                  <>
                    {' '}
                    · sourcePlatform:{' '}
                    <span className="font-mono text-text-secondary">{selected.sourcePlatform}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-border-subtle bg-surface-secondary p-6">
        <div className="flex items-start gap-3 text-text-secondary">
          <ShieldCheck size={18} className="mt-0.5 text-noya-green" />
          <p className="text-sm leading-relaxed">
            Vérifie aussi l’endpoint
            <code className="mx-1 rounded bg-surface-primary px-1.5 py-0.5 text-xs">
              /api/webhooks/noya-recrutement/config-check
            </code>
            pour confirmer que le mapping partenaire est actif.
          </p>
        </div>
      </section>
    </div>
  );
}
