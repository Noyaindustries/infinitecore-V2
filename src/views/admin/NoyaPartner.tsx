import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Handshake, ShieldCheck } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';

const NOYA_RECRUTEMENT_URL = 'https://www.noyaindustries.com/recrutement';
const NOYA_RECRUTEMENT_SOURCE = 'noya-recrutement';

type NoyaRecruitmentLead = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  status?: string;
  createdAt?: string;
  source?: string;
  partnerName?: string;
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

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'leads'),
        where('source', '==', NOYA_RECRUTEMENT_SOURCE),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoyaRecruitmentLead, 'id'>) }));
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
                <th className="px-4 py-3">Partenaire</th>
                <th className="px-4 py-3">Reçu le</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
                    Chargement des inscriptions...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
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
                    <td className="px-4 py-3 text-text-secondary">{row.partnerName || 'Noya Partenaire'}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
