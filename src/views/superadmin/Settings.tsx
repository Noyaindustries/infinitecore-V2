import React, { useState, useEffect, useRef } from 'react';
import { Save, Globe, Shield, Bell, AlertTriangle, Image as ImageIcon, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from '@/lib/mongoFirestore';
import { db, auth } from '@/lib/clientSdk';
import { deleteUploadedFile, uploadFile } from '@/services/uploadService';
import { useBranding, DEFAULT_FAVICON, DEFAULT_LOGO } from '@/components/BrandingProvider';

type PlatformSettings = {
  siteName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  logoUrl: string;
  logoPublicId: string;
  faviconUrl: string;
  faviconPublicId: string;
};

const MAX_BRANDING_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'Infinite CRM',
  supportEmail: 'support@infinite.com',
  maintenanceMode: false,
  allowRegistration: true,
  logoUrl: '',
  logoPublicId: '',
  faviconUrl: '',
  faviconPublicId: '',
};

function isAllowedBrandingFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return /\.(png|jpe?g|webp|svg)$/.test(name);
}

export default function SuperAdminSettings() {
  const { refresh: refreshBranding } = useBranding();
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<PlatformSettings>;
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
            logoPublicId: typeof data.logoPublicId === 'string' ? data.logoPublicId : '',
            faviconUrl: typeof data.faviconUrl === 'string' ? data.faviconUrl : '',
            faviconPublicId: typeof data.faviconPublicId === 'string' ? data.faviconPublicId : '',
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    void fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      await refreshBranding();
      toast.success('Configuration enregistrée avec succès');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadBrandingAsset = async (
    kind: 'logo' | 'favicon',
    file: File
  ): Promise<void> => {
    if (!isAllowedBrandingFile(file)) {
      toast.error('Formats acceptés : PNG, JPG, WEBP, SVG.');
      return;
    }
    if (file.size > MAX_BRANDING_BYTES) {
      toast.error('Image trop volumineuse (max 5 Mo).');
      return;
    }

    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    const toastId = toast.loading(kind === 'logo' ? 'Upload du logo…' : "Upload de l'icône d'onglet…");
    try {
      const result = await uploadFile(file, 'branding');
      const prevPublicId =
        kind === 'logo' ? settings.logoPublicId : settings.faviconPublicId;
      if (prevPublicId && prevPublicId !== result.publicId) {
        await deleteUploadedFile(prevPublicId).catch(() => undefined);
      }
      setSettings((prev) =>
        kind === 'logo'
          ? { ...prev, logoUrl: result.url, logoPublicId: result.publicId }
          : { ...prev, faviconUrl: result.url, faviconPublicId: result.publicId }
      );
      toast.success(
        kind === 'logo'
          ? 'Logo mis à jour — pensez à enregistrer.'
          : "Favicon mis à jour — pensez à enregistrer.",
        { id: toastId }
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Échec de l'upload.", {
        id: toastId,
      });
    } finally {
      setUploading(false);
    }
  };

  const resetBrandingAsset = async (kind: 'logo' | 'favicon') => {
    const publicId = kind === 'logo' ? settings.logoPublicId : settings.faviconPublicId;
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    try {
      if (publicId) {
        await deleteUploadedFile(publicId).catch(() => undefined);
      }
      setSettings((prev) =>
        kind === 'logo'
          ? { ...prev, logoUrl: '', logoPublicId: '' }
          : { ...prev, faviconUrl: '', faviconPublicId: '' }
      );
      toast.success(
        kind === 'logo'
          ? 'Logo restauré par défaut — enregistrez pour appliquer.'
          : 'Favicon restauré par défaut — enregistrez pour appliquer.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (
      !window.confirm(
        'ATTENTION : Cette action est irréversible. Toutes les données (sauf votre compte) seront supprimées. Voulez-vous vraiment continuer ?'
      )
    ) {
      return;
    }

    setIsClearing(true);
    const toastId = toast.loading('Suppression des données en cours...');

    try {
      const collectionsToClear = [
        'companies',
        'tickets',
        'tasks',
        'documents',
        'orders',
        'missions',
        'payments',
        'notifications',
        'logs',
        'padde_audits',
      ];

      for (const collectionName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const deletePromises = querySnapshot.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }

      const currentUserUid = auth.currentUser?.uid;
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDeletePromises = usersSnapshot.docs
        .filter((d) => d.id !== currentUserUid)
        .map((d) => deleteDoc(d.ref));
      await Promise.all(userDeletePromises);

      toast.success('Base de données réinitialisée avec succès.', { id: toastId });
    } catch (error) {
      console.error('Error clearing database:', error);
      toast.error('Erreur lors de la réinitialisation de la base de données.', { id: toastId });
    } finally {
      setIsClearing(false);
    }
  };

  const logoPreview = settings.logoUrl.trim() || DEFAULT_LOGO;
  const faviconPreview = settings.faviconUrl.trim() || DEFAULT_FAVICON;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Configuration Globale</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">
            Architecture système et paramètres de sécurité critiques
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)] disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? 'Synchronisation...' : 'Enregistrer'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-4">
              <div className="p-3 bg-surface-primary/50 text-noya-blue rounded-xl">
                <Globe size={24} />
              </div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">
                Plateforme & Identité
              </h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                    Nom de l&apos;Écosystème
                  </label>
                  <div className="relative">
                    <Globe
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-50"
                      size={18}
                    />
                    <input
                      type="text"
                      value={settings.siteName}
                      onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                      placeholder="Ex: Infinite CRM"
                      className="w-full pl-12 pr-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                    Canal Support Maître
                  </label>
                  <input
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-border-subtle">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">
                    Logo du site
                  </label>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-primary border border-border-subtle">
                    <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary">
                      <img
                        src={logoPreview}
                        alt="Aperçu logo"
                        className="max-h-14 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2 min-w-0">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadBrandingAsset('logo', file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-noya-blue/15 text-noya-blue hover:bg-noya-blue/25 disabled:opacity-50 transition-colors"
                      >
                        <ImageIcon size={14} />
                        {uploadingLogo ? 'Envoi…' : 'Changer le logo'}
                      </button>
                      <button
                        type="button"
                        disabled={uploadingLogo || (!settings.logoUrl && !settings.logoPublicId)}
                        onClick={() => void resetBrandingAsset('logo')}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-tertiary disabled:opacity-40 transition-colors"
                      >
                        <RotateCcw size={14} />
                        Restaurer le défaut
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted italic opacity-70">
                    PNG, JPG, WEBP ou SVG — max 5 Mo. Visible partout (nav marketing et tableaux de bord).
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">
                    Icône d&apos;onglet (favicon)
                  </label>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-primary border border-border-subtle">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary">
                      <img
                        src={faviconPreview}
                        alt="Aperçu favicon"
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2 min-w-0">
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadBrandingAsset('favicon', file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingFavicon}
                        onClick={() => faviconInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-noya-blue/15 text-noya-blue hover:bg-noya-blue/25 disabled:opacity-50 transition-colors"
                      >
                        <ImageIcon size={14} />
                        {uploadingFavicon ? 'Envoi…' : "Changer l'icône"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          uploadingFavicon || (!settings.faviconUrl && !settings.faviconPublicId)
                        }
                        onClick={() => void resetBrandingAsset('favicon')}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-tertiary disabled:opacity-40 transition-colors"
                      >
                        <RotateCcw size={14} />
                        Restaurer le défaut
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted italic opacity-70">
                    Idéalement un carré PNG (32×32 ou 192×192). Cliquez Enregistrer pour l&apos;appliquer.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-4">
              <div className="p-3 bg-surface-primary/50 text-noya-red rounded-xl">
                <Shield size={24} />
              </div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">
                Protocoles de Sécurité
              </h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex items-center justify-between p-6 bg-surface-primary rounded-2xl border border-border-subtle hover:border-noya-red/30 transition-all group">
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-noya-red transition-colors">
                    Mode Maintenance
                  </h3>
                  <p className="text-xs text-text-muted italic opacity-60 mt-1">
                    Geler l&apos;accès public pour maintenance technique.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.maintenanceMode}
                    onChange={(e) =>
                      setSettings({ ...settings, maintenanceMode: e.target.checked })
                    }
                  />
                  <div className="w-14 h-7 bg-surface-tertiary border border-border-subtle rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white/20 after:rounded-full after:h-[19px] after:w-[19px] after:transition-all peer-checked:bg-noya-red peer-checked:after:bg-white shadow-inner"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-6 bg-surface-primary rounded-2xl border border-border-subtle hover:border-noya-blue/30 transition-all group">
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-noya-blue transition-colors">
                    Open Enrollment
                  </h3>
                  <p className="text-xs text-text-muted italic opacity-60 mt-1">
                    Autoriser la création autonome de nouveaux comptes clients.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.allowRegistration}
                    onChange={(e) =>
                      setSettings({ ...settings, allowRegistration: e.target.checked })
                    }
                  />
                  <div className="w-14 h-7 bg-surface-tertiary border border-border-subtle rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white/20 after:rounded-full after:h-[19px] after:w-[19px] after:transition-all peer-checked:bg-noya-blue peer-checked:after:bg-white shadow-inner"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden h-fit">
            <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-4">
              <div className="p-3 bg-surface-primary/50 text-noya-orange rounded-xl">
                <Bell size={24} />
              </div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Index Flux</h2>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-xs text-text-secondary italic opacity-60 leading-relaxed">
                Abonnement aux événements critiques du système pour supervision en temps réel.
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Nouvel utilisateur inscrit', icon: '👤' },
                  { label: 'Nouvelle commande payée', icon: '💰' },
                  { label: 'Ticket support urgent', icon: '🔥' },
                  { label: 'Rapport hebdomadaire', icon: '📊' },
                ].map((item, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-primary border border-border-subtle hover:bg-surface-tertiary cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border-subtle bg-surface-primary text-noya-orange focus:ring-noya-orange"
                      defaultChecked={i < 3}
                    />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-tighter opacity-80 flex items-center gap-2">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-noya-red/5 rounded-3xl border border-noya-red/20 overflow-hidden">
            <div className="p-6 border-b border-noya-red/10 bg-noya-red/10 flex items-center gap-4">
              <div className="p-2 bg-noya-red/20 text-noya-red rounded-lg">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-sm font-black text-noya-red uppercase tracking-widest">Zone Critique</h2>
            </div>
            <div className="p-8">
              <p className="text-xs text-text-primary font-bold opacity-80 uppercase tracking-tight">
                Réinitialisation de l&apos;Ecosystème
              </p>
              <p className="text-[10px] text-text-secondary italic mt-2 opacity-60 leading-relaxed">
                Action irréversible. Effacement total des logs, missions, commandes et profils.
              </p>
              <button
                type="button"
                onClick={() => void handleClearDatabase()}
                disabled={isClearing}
                className="w-full mt-6 py-4 bg-noya-red/20 hover:bg-noya-red text-noya-red hover:text-white border border-noya-red/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-lg"
              >
                {isClearing ? 'EFFACEMENT...' : 'Wipe Database'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
