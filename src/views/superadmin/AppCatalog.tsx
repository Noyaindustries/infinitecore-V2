import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw, ShoppingBag, Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  INFINITE_APP_CATALOG,
  createEmptyAppCatalogEntry,
  formatFcfa,
  isBuiltInAppId,
  mergeCatalogWithDefaults,
  type AppCatalogEntry,
  type AppLicensePricing,
  type AppSubscriptionPricing,
} from '../../data/appCatalog';
import { appCatalogService } from '../../services/appCatalogService';
import AppCatalogCardImage from '../../components/AppCatalogCardImage';
import AppCatalogEditorModal from '../../components/AppCatalogEditorModal';

function ensureCheckoutPricing(app: AppCatalogEntry): AppCatalogEntry {
  if (!app.onlineCheckout) return app;
  const pricing = [...app.pricing];
  if (!pricing.some((p) => p.type === 'license')) {
    pricing.push({ type: 'license', price: 100_000, durationDays: 0, label: 'Licence à vie (auto-hébergée)' });
  }
  if (!pricing.some((p) => p.type === 'subscription')) {
    pricing.push({
      type: 'subscription',
      price: 10_000,
      billingCycle: 'month',
      label: 'Abonnement mensuel (SaaS Infinite Core)',
    });
  }
  return { ...app, pricing };
}

type EditorState = {
  mode: 'create' | 'edit';
  draft: AppCatalogEntry;
  originalId?: string;
};

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

  const handleSave = async () => {
    const invalid = apps.find((a) => !a.id.trim() || !a.title.trim());
    if (invalid) {
      toast.error('Chaque application doit avoir un identifiant et un titre.');
      return;
    }
    const emptyFeature = apps.find((a) => (a.features ?? []).some((f) => !f.title.trim()));
    if (emptyFeature) {
      toast.error(`« ${emptyFeature.title} » : chaque fonctionnalité doit avoir un titre.`);
      return;
    }
    const ids = apps.map((a) => a.id);
    if (new Set(ids).size !== ids.length) {
      toast.error('Deux applications ont le même identifiant (slug).');
      return;
    }
    setSaving(true);
    try {
      const toSave = apps.map(ensureCheckoutPricing).map((a) => ({
        ...a,
        features: (a.features ?? []).filter((f) => f.title.trim()),
      }));
      const saved = await appCatalogService.saveCatalog(toSave);
      setApps(saved);
      toast.success('Catalogue applications enregistré.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
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

  const handleEditorSubmit = () => {
    if (!editor) return;
    const title = editor.draft.title.trim();
    if (!title || title === 'Nouvelle application') {
      toast.error('Donnez un titre à l’application.');
      return;
    }
    const entry = ensureCheckoutPricing(editor.draft);

    if (editor.mode === 'create') {
      if (apps.some((a) => a.id === entry.id)) {
        toast.error('Cet identifiant existe déjà — modifiez le titre.');
        return;
      }
      setApps((prev) => [...prev, entry]);
      setEditor(null);
      toast.success('Application créée — cliquez sur Enregistrer pour publier.');
      return;
    }

    const originalId = editor.originalId ?? entry.id;
    if (entry.id !== originalId && apps.some((a) => a.id === entry.id)) {
      toast.error('Cet identifiant est déjà utilisé par une autre application.');
      return;
    }
    setApps((prev) => prev.map((a) => (a.id === originalId ? entry : a)));
    setEditor(null);
    toast.success('Modifications appliquées — cliquez sur Enregistrer pour publier.');
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
            Création et édition via le même formulaire flottant — puis enregistrez le catalogue.
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
          mode={editor.mode}
          draft={editor.draft}
          onChange={(draft) => setEditor((prev) => (prev ? { ...prev, draft } : prev))}
          onClose={() => setEditor(null)}
          onSubmit={handleEditorSubmit}
        />
      ) : null}

      <div className="space-y-4">
        {apps.map((app) => {
          const license = app.pricing.find((p): p is AppLicensePricing => p.type === 'license');
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
                    {license && (
                      <p className="mt-1 text-xs text-text-muted">
                        Licence : {formatFcfa(license.price)}
                        {subscription ? ` · Abo : ${formatFcfa(subscription.price)}/mois` : ''}
                      </p>
                    )}
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
