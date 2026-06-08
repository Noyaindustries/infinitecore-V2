import { Plus, Trash2, List } from 'lucide-react';
import type { AppCatalogFeature } from '../data/appCatalog';
import { bulkAppFeaturesToText, parseBulkAppFeatures } from '../lib/appCatalogFeatures';

type Props = {
  features: AppCatalogFeature[];
  onChange: (features: AppCatalogFeature[]) => void;
  onImportDefaults?: () => void;
};

export default function AppCatalogFeaturesEditor({ features, onChange, onImportDefaults }: Props) {
  const list = features ?? [];

  const updateAt = (idx: number, patch: Partial<AppCatalogFeature>) => {
    onChange(list.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeAt = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          Affichées sur la page détail « Fonctionnalités clés ». Chaque entrée = un titre + une description.
        </p>
        <div className="flex flex-wrap gap-2">
          {onImportDefaults && (
            <button
              type="button"
              onClick={onImportDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-text-primary/5"
            >
              <List className="h-3.5 w-3.5" />
              Modèle par défaut
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange([...list, { title: '', description: '' }])}
            className="inline-flex items-center gap-1 rounded-lg border border-noya-blue/30 bg-noya-blue/10 px-2.5 py-1.5 text-xs font-semibold text-noya-blue"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une fonctionnalité
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted">
          Aucune fonctionnalité — cliquez sur « Ajouter » ou collez une liste ci-dessous.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((f, idx) => (
            <div
              key={`feat-${idx}`}
              className="rounded-xl border border-border bg-noya-black/50 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Fonctionnalité {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-noya-red/10 hover:text-noya-red"
                  aria-label="Supprimer cette fonctionnalité"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <label className="mb-1 block text-xs font-semibold text-text-secondary">Titre</label>
              <input
                value={f.title}
                onChange={(e) => updateAt(idx, { title: e.target.value })}
                placeholder="Ex : Gestion multi-établissements"
                className="mb-3 w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
              />
              <label className="mb-1 block text-xs font-semibold text-text-secondary">Description</label>
              <textarea
                value={f.description}
                onChange={(e) => updateAt(idx, { description: e.target.value })}
                rows={2}
                placeholder="Ex : Pilotez plusieurs campus depuis un seul tableau de bord."
                className="w-full rounded-lg border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-text-muted">
          Saisie rapide (une ligne = une fonctionnalité, format : Titre | Description)
        </label>
        <textarea
          value={bulkAppFeaturesToText(list)}
          onChange={(e) => onChange(parseBulkAppFeatures(e.target.value))}
          rows={Math.max(4, list.length + 1)}
          placeholder={'Multi-établissements | Plusieurs campus, un seul tableau de bord\nNotes & bulletins | Génération automatique des bulletins PDF'}
          className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 font-mono text-sm text-text-primary"
        />
      </div>
    </div>
  );
}
