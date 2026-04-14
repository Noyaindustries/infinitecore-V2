import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  FileText,
  FileArchive,
  PlayCircle,
  Image as ImageIcon,
  Folder,
  Sparkles,
  Filter,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

const TYPE_ICONS: Record<string, React.ElementType> = {
  PDF: FileText,
  ZIP: FileArchive,
  MP4: PlayCircle,
  DOCX: FileText,
  IMG: ImageIcon,
};

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  PDF: { color: 'text-red-500', bg: 'bg-red-500/10' },
  ZIP: { color: 'text-noya-orange', bg: 'bg-noya-orange/10' },
  MP4: { color: 'text-purple-500', bg: 'bg-purple-500/10' },
  DOCX: { color: 'text-noya-blue', bg: 'bg-noya-blue/10' },
  IMG: { color: 'text-noya-green', bg: 'bg-noya-green/10' },
};

type PartnerResource = {
  id: string;
  title?: string;
  description?: string;
  fileType?: string;
  size?: string;
  url?: string;
  featured?: boolean;
  createdAt?: string;
  tags?: string[];
};

const PLAYBOOK_STEPS = [
  'Envoyer la plaquette + FAQ au prospect apres le premier echange.',
  'Qualifier le besoin avec la fiche de cadrage avant demo.',
  'Transmettre les objections/retours au Commando pour support closing.',
];

function normalizeType(type: string | undefined): string {
  return String(type || '').toUpperCase();
}

function formatResourceDate(value: unknown): string {
  if (!value) return 'Date inconnue';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export default function PartnerResources() {
  const [resources, setResources] = useState<PartnerResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<PartnerResource, 'id'>) }));
      setResources(mapped);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const types = useMemo(
    () => Array.from(new Set(resources.map((r) => normalizeType(r.fileType)).filter(Boolean))),
    [resources],
  );

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const searchText = search.trim().toLowerCase();
      const type = normalizeType(resource.fileType);
      const byType = typeFilter === 'all' || type === typeFilter;
      const bySearch =
        !searchText ||
        `${resource.title || ''} ${resource.description || ''} ${type}`.toLowerCase().includes(searchText);
      return byType && bySearch;
    });
  }, [resources, search, typeFilter]);

  const featuredResources = useMemo(() => {
    const featured = filteredResources.filter((r) => r.featured);
    return (featured.length > 0 ? featured : filteredResources).slice(0, 3);
  }, [filteredResources]);

  const typeCounts = useMemo(() => {
    return types.map((type) => ({
      type,
      count: resources.filter((r) => normalizeType(r.fileType) === type).length,
    }));
  }, [resources, types]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-b-2 border-noya-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Kit de Vente & Ressources</h1>
        <p className="text-text-secondary mt-1">
          Retrouvez tous les supports pour convertir plus vite : docs, scripts, medias et assets de closing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/partenaire" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Tableau de bord
          <Folder size={14} className="text-noya-blue" />
        </Link>
        <Link to="/partenaire/clients" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Mes contacts
          <FileText size={14} className="text-noya-green" />
        </Link>
        <Link to="/partenaire/profil" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
          Profil partenaire
          <ImageIcon size={14} className="text-noya-orange" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Ressources total</p>
          <p className="text-2xl font-black text-text-primary mt-1">{resources.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">A la une</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black text-noya-blue">
            <Sparkles size={18} />
            {featuredResources.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
          <label htmlFor="partner-resource-search" className="block text-[10px] uppercase tracking-widest text-text-muted font-bold mb-2">Recherche</label>
          <input
            id="partner-resource-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre, type de fichier..."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 outline-none focus:ring-2 focus:ring-noya-blue"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label htmlFor="partner-resource-type" className="block text-[10px] uppercase tracking-widest text-text-muted font-bold mb-2">Type</label>
          <select
            id="partner-resource-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-noya-blue"
          >
            <option value="all">Tous</option>
            {types.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-noya-green/20 bg-noya-green/10 p-4 xl:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-noya-green">
            <CheckCircle2 size={16} />
            Playbook partenaire
          </h2>
          <div className="mt-3 space-y-2">
            {PLAYBOOK_STEPS.map((step, idx) => (
              <p key={step} className="text-sm text-text-primary">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-noya-green/20 text-xs font-bold text-noya-green">
                  {idx + 1}
                </span>
                {step}
              </p>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-text-primary">
            <Filter size={16} className="text-noya-blue" />
            Types disponibles
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                typeFilter === 'all'
                  ? 'border-noya-blue bg-noya-blue/20 text-noya-blue'
                  : 'border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              Tous ({resources.length})
            </button>
            {typeCounts.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setTypeFilter(item.type)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  typeFilter === item.type
                    ? 'border-noya-blue bg-noya-blue/20 text-noya-blue'
                    : 'border-white/10 text-text-secondary hover:bg-white/5'
                }`}
              >
                {item.type} ({item.count})
              </button>
            ))}
          </div>
        </article>
      </section>

      {featuredResources.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-text-primary">Ressources a la une</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {featuredResources.map((resource) => (
              <a
                key={`featured-${resource.id}`}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 bg-black/20 p-3 transition-colors hover:bg-white/5"
              >
                <p className="text-sm font-semibold text-text-primary line-clamp-2">{resource.title || 'Ressource'}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {normalizeType(resource.fileType) || 'Fichier'}{resource.size ? ` • ${resource.size}` : ''}
                </p>
                <p className="mt-2 text-[11px] text-text-secondary line-clamp-2">
                  {resource.description || 'Support recommande pour votre cycle de vente.'}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {filteredResources.length === 0 ? (
        <div className="bg-noya-sidebar rounded-2xl border border-white/5 flex flex-col items-center justify-center py-20 gap-4 text-text-secondary/30">
          <Folder size={48} className="opacity-20" />
          <p className="font-medium text-text-secondary">{resources.length === 0 ? 'Aucune ressource disponible pour le moment.' : 'Aucun résultat pour ce filtre.'}</p>
          <p className="text-sm text-center max-w-xs">Les documents de vente sont pilotés par l’équipe Commando / Admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource, index) => {
            const normalizedType = normalizeType(resource.fileType);
            const Icon = TYPE_ICONS[normalizedType] || FileText;
            const colors = TYPE_COLORS[normalizedType] || { color: 'text-gray-500', bg: 'bg-gray-50' };
            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-noya-sidebar p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 hover:shadow-xl transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <Icon className={`w-6 h-6 ${colors.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary line-clamp-2">{resource.title}</h3>
                    <p className="text-xs text-text-secondary mt-1 font-medium">
                      {normalizedType || 'Fichier'}{resource.size ? ` • ${resource.size}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                      {resource.description || 'Ressource partagee par l’equipe pour appuyer vos actions commerciales.'}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-text-secondary">
                      <Clock3 size={12} />
                      Ajoute le {formatResourceDate(resource.createdAt)}
                    </p>
                    {Array.isArray(resource.tags) && resource.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {resource.tags.slice(0, 3).map((tag) => (
                          <span
                            key={`${resource.id}-${tag}`}
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-noya-blue/5 border border-noya-blue/10 rounded-xl text-sm font-bold text-noya-blue hover:bg-noya-blue/10 transition-all"
                >
                  <Download size={16} /> Télécharger
                </a>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
