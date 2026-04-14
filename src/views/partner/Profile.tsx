import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Building, CreditCard, Copy, CheckCircle, Save, Users, Wallet, FolderOpen, Camera, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../components/FirebaseProvider';
import { db } from '../../firebase';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { deleteUploadedFile, uploadFile } from '../../services/uploadService';

type LeadStatus = 'soumis' | 'contacte' | 'en_demo' | 'proposition' | 'signe' | 'gagne' | 'perdu';

type LeadRow = {
  id: string;
  status?: LeadStatus;
  commissionAmount?: number;
  commissionPaid?: boolean;
};

const normalizePartnerCode = (code: string) => code.toUpperCase().replace('PART-USR', 'PART-INF');
const buildPartnerCode = (uid?: string) => `PART-${(uid || '').substring(0, 6).toUpperCase().replace('USR', 'INF')}`;

export default function PartnerProfile() {
  const { user, userData } = useAuth();
  const safeUserData = (userData || {}) as Record<string, any>;
  const partnerUid = String(safeUserData.uid || user?.uid || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    iban: '',
    bic: '',
    referralCode: '',
    photoURL: '',
    photoPath: '',
  });

  useEffect(() => {
    if (safeUserData) {
      // Generate referralCode from uid if not yet stored
      const rawCode = safeUserData.referralCode || buildPartnerCode(partnerUid);
      const code = normalizePartnerCode(rawCode);
      setProfile({
        firstName: safeUserData.firstName || '',
        lastName: safeUserData.lastName || '',
        email: safeUserData.email || user?.email || '',
        phone: safeUserData.phone || '',
        company: safeUserData.company || '',
        address: safeUserData.address || '',
        iban: safeUserData.iban || '',
        bic: safeUserData.bic || '',
        referralCode: code,
        photoURL: safeUserData.photoURL || '',
        photoPath: safeUserData.photoPath || '',
      });
      // Persist if absent or still using the old USR prefix.
      if (partnerUid && (!safeUserData.referralCode || safeUserData.referralCode !== code)) {
        updateDoc(doc(db, 'users', partnerUid), { referralCode: code }).catch(() => {});
      }
    }
  }, [safeUserData, user, partnerUid]);

  useEffect(() => {
    if (!partnerUid) return;
    const leadsQuery = query(collection(db, 'leads'), where('partnerId', '==', partnerUid));
    const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', partnerUid), where('read', '==', false));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeadRow, "id">) })));
    });
    const unsubscribeNotifs = onSnapshot(notifsQuery, (snap) => {
      setUnreadNotifications(snap.docs.length);
    });
    return () => {
      unsubscribeLeads();
      unsubscribeNotifs();
    };
  }, [partnerUid]);

  const referralLink = `https://infinitecore.app/signup?ref=${profile.referralCode}`;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Partenaire';

  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const activeLeads = leads.filter((l) => l.status && !['perdu', 'gagne'].includes(l.status)).length;
    const totalCommission = leads.reduce((acc, l) => acc + (Number(l.commissionAmount) || 0), 0);
    const paidCommission = leads
      .filter((l) => l.commissionPaid)
      .reduce((acc, l) => acc + (Number(l.commissionAmount) || 0), 0);
    return { totalLeads, activeLeads, totalCommission, paidCommission };
  }, [leads]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerUid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', partnerUid), {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        company: profile.company,
        address: profile.address,
        iban: profile.iban,
        bic: profile.bic,
      });
      setIsEditing(false);
      toast.success('Profil mis à jour avec succès !');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (safeUserData) {
      const rawCode = safeUserData.referralCode || buildPartnerCode(partnerUid);
      const code = normalizePartnerCode(rawCode);
      setProfile({
        firstName: safeUserData.firstName || '',
        lastName: safeUserData.lastName || '',
        email: safeUserData.email || user?.email || '',
        phone: safeUserData.phone || '',
        company: safeUserData.company || '',
        address: safeUserData.address || '',
        iban: safeUserData.iban || '',
        bic: safeUserData.bic || '',
        referralCode: code,
        photoURL: safeUserData.photoURL || '',
        photoPath: safeUserData.photoPath || '',
      });
    }
    setIsEditing(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Lien de referral copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !partnerUid) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 5MB).');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const result = await uploadFile(file, `avatars/partners/${partnerUid}`);
      if (profile.photoPath) {
        await deleteUploadedFile(profile.photoPath).catch(() => undefined);
      }
      await updateDoc(doc(db, 'users', partnerUid), {
        photoURL: result.url,
        photoPath: result.publicId,
      });
      setProfile((prev) => ({
        ...prev,
        photoURL: result.url,
        photoPath: result.publicId,
      }));
      toast.success('Photo de profil mise à jour.');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de téléverser la photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!partnerUid || !profile.photoURL) return;
    setIsUploadingPhoto(true);
    try {
      if (profile.photoPath) {
        await deleteUploadedFile(profile.photoPath).catch(() => undefined);
      }
      await updateDoc(doc(db, 'users', partnerUid), {
        photoURL: '',
        photoPath: '',
      });
      setProfile((prev) => ({
        ...prev,
        photoURL: '',
        photoPath: '',
      }));
      toast.success('Photo de profil supprimée.');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de supprimer la photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mon Profil Partenaire</h1>
          <p className="text-sm text-text-secondary mt-1">Gérez vos informations, suivez vos performances et accédez rapidement aux modules du menu partenaire.</p>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-text-secondary font-medium hover:bg-white/5 rounded-xl transition-colors"
            >
              Annuler
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-text-primary rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Modifier le profil
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Leads total</p>
          <p className="text-2xl font-black text-text-primary mt-1">{stats.totalLeads}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Leads actifs</p>
          <p className="text-2xl font-black text-noya-green mt-1">{stats.activeLeads}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Commissions</p>
          <p className="text-2xl font-black text-text-primary mt-1">{stats.totalCommission.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Alertes non lues</p>
          <p className="text-2xl font-black text-noya-orange mt-1">{unreadNotifications}</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl shadow-sm border border-white/10 overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-[#10203B] to-[#0E1728] text-white flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-white/15 flex items-center justify-center text-3xl font-bold border-4 border-white/20 overflow-hidden">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <>
                  {(profile.firstName || profile.email || 'P').charAt(0).toUpperCase()}
                  {profile.lastName?.charAt(0)?.toUpperCase() || ''}
                </>
              )}
            </div>
            <label className="absolute -right-1 -bottom-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/60 text-white transition hover:bg-black/80">
              {isUploadingPhoto ? (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePhotoUpload(e)}
                disabled={isUploadingPhoto}
              />
            </label>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold">{fullName}</h2>
            <p className="text-blue-200 mt-1">{profile.company || 'Entreprise non renseignée'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors">
                <Camera size={14} />
                Changer la photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e)}
                  disabled={isUploadingPhoto}
                />
              </label>
              {profile.photoURL ? (
                <button
                  type="button"
                  onClick={() => void handlePhotoDelete()}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              ) : null}
            </div>
            {profile.referralCode && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
                  <p className="text-xs text-blue-200 uppercase tracking-wider mb-1">Code Partenaire</p>
                  <p className="font-mono font-bold text-lg">{profile.referralCode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/partenaire/clients" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
              <Users size={16} className="text-noya-green" />
              Mes contacts
            </Link>
            <Link to="/partenaire/commissions" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
              <Wallet size={16} className="text-noya-orange" />
              Commissions
            </Link>
            <Link to="/partenaire/ressources" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-colors">
              <FolderOpen size={16} className="text-noya-blue" />
              Ressources
            </Link>
          </div>

          {profile.referralCode && (
            <div className="mb-8 bg-noya-blue/10 border border-noya-blue/20 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-text-primary mb-1">Votre lien de referral unique</h3>
                <p className="text-sm text-text-secondary">Partagez ce lien avec vos prospects. Chaque inscription sera liée à votre compte.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <code className="bg-black/20 px-3 py-2 rounded-lg border border-white/10 text-sm text-text-primary font-mono flex-1 sm:flex-none truncate max-w-[200px] sm:max-w-xs">
                  {referralLink}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-noya-blue text-white rounded-lg hover:bg-noya-blue/80 transition-colors flex-shrink-0"
                  title="Copier le lien"
                >
                  {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <User size={20} className="text-noya-blue" /> Informations Personnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="partner-profile-firstname" className="block text-sm font-medium text-text-secondary mb-1">Prénom</label>
                  <input
                    id="partner-profile-firstname"
                    type="text"
                    disabled={!isEditing}
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted"
                  />
                </div>
                <div>
                  <label htmlFor="partner-profile-lastname" className="block text-sm font-medium text-text-secondary mb-1">Nom</label>
                  <input
                    id="partner-profile-lastname"
                    type="text"
                    disabled={!isEditing}
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted"
                  />
                </div>
                <div>
                  <label htmlFor="partner-profile-email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                      id="partner-profile-email"
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-xl bg-black/10 text-text-muted cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="partner-profile-phone" className="block text-sm font-medium text-text-secondary mb-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                      id="partner-profile-phone"
                      type="tel"
                      disabled={!isEditing}
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <Building size={20} className="text-noya-blue" /> Informations Entreprise
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="partner-profile-company" className="block text-sm font-medium text-text-secondary mb-1">Nom de l'entreprise</label>
                  <input
                    id="partner-profile-company"
                    type="text"
                    disabled={!isEditing}
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted"
                  />
                </div>
                <div>
                  <label htmlFor="partner-profile-address" className="block text-sm font-medium text-text-secondary mb-1">Adresse complète</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-text-muted" size={18} />
                    <textarea
                      id="partner-profile-address"
                      disabled={!isEditing}
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      rows={2}
                      className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <CreditCard size={20} className="text-noya-blue" /> Coordonnées Bancaires (RIB)
              </h3>
              <p className="text-sm text-text-secondary mb-4">Ces informations sont nécessaires pour le versement de vos commissions.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="partner-profile-iban" className="block text-sm font-medium text-text-secondary mb-1">IBAN</label>
                  <input
                    id="partner-profile-iban"
                    type="text"
                    disabled={!isEditing}
                    value={profile.iban}
                    onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="partner-profile-bic" className="block text-sm font-medium text-text-secondary mb-1">BIC / SWIFT</label>
                  <input
                    id="partner-profile-bic"
                    type="text"
                    disabled={!isEditing}
                    value={profile.bic}
                    onChange={(e) => setProfile({ ...profile, bic: e.target.value })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/20 text-text-primary rounded-xl focus:ring-2 focus:ring-noya-blue disabled:bg-black/10 disabled:text-text-muted font-mono"
                  />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end pt-6 border-t border-white/10">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-noya-green text-white font-medium rounded-xl hover:bg-noya-green/80 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
                  Enregistrer les modifications
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
