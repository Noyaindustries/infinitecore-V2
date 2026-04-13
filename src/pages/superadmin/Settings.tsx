import React, { useState, useEffect } from 'react';
import { Settings, Save, Globe, Shield, Bell, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'Infinite CRM',
    supportEmail: 'support@infinite.com',
    maintenanceMode: false,
    allowRegistration: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      toast.success('Configuration enregistrée avec succès');
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm("ATTENTION : Cette action est irréversible. Toutes les données (sauf votre compte) seront supprimées. Voulez-vous vraiment continuer ?")) {
      return;
    }

    setIsClearing(true);
    const toastId = toast.loading('Suppression des données en cours...');

    try {
      const collectionsToClear = [
        'companies', 'tickets', 'tasks', 'documents', 'orders', 
        'missions', 'payments', 'notifications', 'logs', 'padde_audits'
      ];

      // Delete documents in all collections except users
      for (const collectionName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      // Delete users except current user
      const currentUserUid = auth.currentUser?.uid;
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDeletePromises = usersSnapshot.docs
        .filter(doc => doc.id !== currentUserUid)
        .map(doc => deleteDoc(doc.ref));
      await Promise.all(userDeletePromises);

      toast.success('Base de données réinitialisée avec succès.', { id: toastId });
    } catch (error) {
      console.error("Error clearing database:", error);
      toast.error('Erreur lors de la réinitialisation de la base de données.', { id: toastId });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Configuration Globale</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Architecture système et paramètres de sécurité critiques</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-noya-blue text-noya-black rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(110,167,234,0.3)] disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? 'Synchronisation...' : 'Enregistrer'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Paramètres Généraux */}
          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-4">
              <div className="p-3 bg-surface-primary/50 text-noya-blue rounded-xl">
                <Globe size={24} />
              </div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Plateforme & Identité</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Nom de l'Écosystème</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-50" size={18} />
                    <input 
                      type="text" 
                      value={settings.siteName}
                      onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                      placeholder="Ex: Infinite CRM"
                      className="w-full pl-12 pr-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-sm focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Canal Support Maître</label>
                  <input 
                    type="email" 
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                    className="w-full px-5 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary transition-all font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sécurité et Accès */}
          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center gap-4">
              <div className="p-3 bg-surface-primary/50 text-noya-red rounded-xl">
                <Shield size={24} />
              </div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Protocoles de Sécurité</h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex items-center justify-between p-6 bg-surface-primary rounded-2xl border border-border-subtle hover:border-noya-red/30 transition-all group">
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-noya-red transition-colors">Mode Maintenance</h3>
                  <p className="text-xs text-text-muted italic opacity-60 mt-1">Geler l'accès public pour maintenance technique.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
                  />
                  <div className="w-14 h-7 bg-surface-tertiary border border-border-subtle rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white/20 after:rounded-full after:h-[19px] after:w-[19px] after:transition-all peer-checked:bg-noya-red peer-checked:after:bg-white shadow-inner"></div>
                </label>
              </div>

               <div className="flex items-center justify-between p-6 bg-surface-primary rounded-2xl border border-border-subtle hover:border-noya-blue/30 transition-all group">
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-noya-blue transition-colors">Open Enrollment</h3>
                  <p className="text-xs text-text-muted italic opacity-60 mt-1">Autoriser la création autonome de nouveaux comptes clients.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.allowRegistration}
                    onChange={(e) => setSettings({...settings, allowRegistration: e.target.checked})}
                  />
                  <div className="w-14 h-7 bg-surface-tertiary border border-border-subtle rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white/20 after:rounded-full after:h-[19px] after:w-[19px] after:transition-all peer-checked:bg-noya-blue peer-checked:after:bg-white shadow-inner"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
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
                  { label: 'Rapport hebdomadaire', icon: '📊' }
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-primary border border-border-subtle hover:bg-surface-tertiary cursor-pointer transition-all">
                    <input type="checkbox" className="w-4 h-4 rounded border-border-subtle bg-surface-primary text-noya-orange focus:ring-noya-orange" defaultChecked={i < 3} />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-tighter opacity-80 flex items-center gap-2">
                       {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-noya-red/5 rounded-3xl border border-noya-red/20 overflow-hidden">
            <div className="p-6 border-b border-noya-red/10 bg-noya-red/10 flex items-center gap-4">
              <div className="p-2 bg-noya-red/20 text-noya-red rounded-lg">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-sm font-black text-noya-red uppercase tracking-widest">Zone Critique</h2>
            </div>
            <div className="p-8">
              <p className="text-xs text-text-primary font-bold opacity-80 uppercase tracking-tight">Réinitialisation de l'Ecosystème</p>
              <p className="text-[10px] text-text-secondary italic mt-2 opacity-60 leading-relaxed">
                Action irréversible. Effacement total des logs, missions, commandes et profils.
              </p>
              <button 
                onClick={handleClearDatabase}
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
