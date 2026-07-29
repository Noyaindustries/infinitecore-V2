import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw, ShoppingBag, Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  INFINITE_APP_CATALOG,
  createEmptyAppCatalogEntry,
  formatFcfa,
  hasLicensePricing,
  hasSubscriptionPricing,
  isBuiltInAppId,
  mergeCatalogWithDefaults,
  validateCatalogEntryPricing,
  type AppCatalogEntry,
  type AppSubscriptionPricing,
} from '../../data/appCatalog';
import { appCatalogService } from '../../services/appCatalogService';
import AppCatalogCardImage from '../../components/AppCatalogCardImage';
import AppCatalogEditorModal from '../../components/AppCatalogEditorModal';

type EditorState = {
  mode: 'create' | 'edit';
  draft: AppCatalogEntry;
  originalId?: string;
};

function prepareAppsForSave(list: AppCatalogEntry[]): AppCatalogEntry[] {
  return list.map((a) => ({
    ...a,
    features: (a.features ?? []).filter((f) => f.title.trim()),
  }));
}

function validateAppsList(list: AppCatalogEntry[]): string | null {
  const invalid = list.find((a) => !a.id.trim() || !a.title.trim());
  if (invalid) return 'Chaque application doit avoir un identifiant et un titre.';
  const emptyFeature = list.find((a) => (a.features ?? []).some((f) => !f.title.trim()));
  if (emptyFeature) {
    return `« ${emptyFeature.title} » : chaque fonctionnalité doit avoir un titre.`;
  }
  const ids = list.map((a) => a.id);
  if (new Set(ids).size !== ids.length) {
    return 'Deux applications ont le même identifiant (slug).';
  }
  return list.map(validateCatalogEntryPricing).find(Boolean) ?? null;
}

export default function SuperAdminAppCatalog() {
  const [apps, setApps] = useState<AppCatalogEntry[]>(INFINITE_APP_CATALOG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = await appCatalogService.fetchCatalog();
        if (!cancelled) setApps(catalog);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistApps = async (list: AppCatalogEntry[]): Promise<boolean> => {
    const validationError = validateAppsList(list);
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    setSaving(true);
    try {
      const saved = await appCatalogService.saveCatalog(prepareAppsForSave(list));
      setApps(saved);
      toast.success('Catalogue enregistré en base.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await persistApps(apps);
  };

  const handleReset = () => {
    if (!window.confirm('Réinitialiser le catalogue aux valeurs par défaut du code ? Les apps personnalisées seront retirées.')) return;
    setApps(mergeCatalogWithDefaults([]));
    setEditor(null);
    toast('Valeurs par défaut chargées — enregistrez pour appliquer en base.');
  };

  const handleAddApp = () => {
    setEditor({ mode: 'create', draft: createEmptyAppCatalogEntry() });
  };

  const handleEditApp = (app: AppCatalogEntry) => {
    setEditor({ mode: 'edit', draft: { ...app }, originalId: app.id });
  };

  const handleEditorSubmit = async () => {
    if (!editor) return;
    const title = editor.draft.title.trim();
    if (!title || title === 'Nouvelle application') {
      toast.error('Donnez un titre à l’application.');
      return;
    }
    const entry = editor.draft;
    const pricingError = validateCatalogEntryPricing(entry);
    if (pricingError) {
      toast.error(pricingError);
      return;
    }

    if (editor.mode === 'create') {
      if (apps.some((a) => a.id === entry.id)) {
        toast.error('Cet identifiant existe déjà — modifiez le titre.');
        return;
      }
      const nextApps = [...apps, entry];
      setEditor(null);
      await persistApps(nextApps);
      return;
    }

    const originalId = editor.originalId ?? entry.id;
    if (entry.id !== originalId && apps.some((a) => a.id === entry.id)) {
      toast.error('Cet identifiant est déjà utilisé par une autre application.');
      return;
    }
    const nextApps = apps.map((a) => (a.id === originalId ? entry : a));
    setEditor(null);
    await persistApps(nextApps);
  };

  const handleRemoveApp = (id: string) => {
    const app = apps.find((a) => a.id === id);
    if (!app) return;
    const builtIn = isBuiltInAppId(id);
    const msg = builtIn
      ? `Retirer « ${app.title} » du catalogue publié ? (réapparaît via « Défauts »)`
      : `Supprimer définitivement « ${app.title} » ?`;
    if (!window.confirm(msg)) return;
    setApps((prev) => prev.filter((a) => a.id !== id));
    if (editor?.originalId === id || editor?.draft.id === id) setEditor(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-noya-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-noya-blue">
            <ShoppingBag className="h-5 w-5" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Boutique</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Catalogue applications</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Les tarifs et contenus sont enregistrés en base dès que vous cliquez sur Appliquer dans le formulaire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddApp}
            className="inline-flex items-center gap-2 rounded-xl border border-noya-green/30 bg-noya-green/10 px-4 py-2 text-sm font-semibold text-noya-green hover:bg-noya-green/20"
          >
            <Plus className="h-4 w-4" />
            Nouvelle app
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-text-primary/5"
          >
            <RotateCcw className="h-4 w-4" />
            Défauts
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-noya-blue px-4 py-2 text-sm font-bold text-noya-black disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        {apps.length} application{apps.length > 1 ? 's' : ''} — dont{' '}
        {apps.filter((a) => !isBuiltInAppId(a.id)).length} personnalisée(s)
      </p>

      {editor ? (
        <AppCatalogEditorModal
          key={`${editor.mode}:${editor.originalId ?? editor.draft.id}`}
          mode={editor.mode}
          draft={editor.draft}
          onChange={(draft) => setEditor((prev) => (prev ? { ...prev, draft } : prev))}
          onClose={() => setEditor(null)}
          onSubmit={handleEditorSubmit}
        />
      ) : null}

      <div className="space-y-4">
        {apps.map((app) => {
          const subscription = app.pricing.find((p): p is AppSubscriptionPricing => p.type === 'subscription');
          const featureCount = (app.features ?? []).length;
          const isCustom = !isBuiltInAppId(app.id);

          return (
            <div key={app.id} className="rounded-2xl border border-border bg-noya-sidebar p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-4">
                  <div className="w-32 shrink-0 overflow-hidden rounded-xl">
                    <AppCatalogCardImage app={app} showTitle={false} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {app.id}
                      {isCustom ? ' · personnalisée' : ' · intégrée'}
                    </p>
                    <h2 className="text-lg font-bold text-text-primary">{app.title}</h2>
                    <p className="text-xs text-text-muted">
                      Module : {app.moduleKey}
                      {featureCount > 0 && ` · ${featureCount} fonctionnalité${featureCount > 1 ? 's' : ''}`}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {[
                        hasLicensePricing(app)
                          ? 'Licence : sur devis'
                          : 'Licence : —',
                        hasSubscriptionPricing(app) && subscription
                          ? `Abo : ${formatFcfa(subscription.price)}/mois`
                          : 'Abo : —',
                      ].join(' · ')}
                    </p>
                    <Link
                      to={`/applications/${app.id}`}
                      target="_blank"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-noya-blue hover:underline"
                    >
                      Prévisualiser <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      app.onlineCheckout
                        ? 'bg-noya-green/15 text-noya-green'
                        : 'bg-text-primary/10 text-text-muted'
                    }`}
                  >
                    {app.onlineCheckout ? 'Paiement en ligne' : 'Sur devis'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEditApp(app)}
                    className="text-xs font-semibold text-noya-orange hover:underline"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveApp(app.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-noya-red hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
