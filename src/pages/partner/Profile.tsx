import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Building, CreditCard, Copy, CheckCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../components/FirebaseProvider';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function PartnerProfile() {
  const { user, userData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
  });

  useEffect(() => {
    if (userData) {
      // Generate referralCode from uid if not yet stored
      const code = userData.referralCode || `PART-${userData.uid?.substring(0, 6).toUpperCase()}`;
      setProfile({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        company: userData.company || '',
        address: userData.address || '',
        iban: userData.iban || '',
        bic: userData.bic || '',
        referralCode: code,
      });
      // Persist the referralCode to Firestore if it wasn't saved yet
      if (!userData.referralCode && user) {
        updateDoc(doc(db, 'users', user.uid), { referralCode: code }).catch(() => {});
      }
    }
  }, [userData, user]);

  const referralLink = `https://infinitecore.app/signup?ref=${profile.referralCode}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
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
    if (userData) {
      const code = userData.referralCode || `PART-${userData.uid?.substring(0, 6).toUpperCase()}`;
      setProfile({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        company: userData.company || '',
        address: userData.address || '',
        iban: userData.iban || '',
        bic: userData.bic || '',
        referralCode: code,
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

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Partenaire';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Mon Profil Partenaire</h1>
        <div className="flex gap-2">
          {isEditing && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Annuler
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Modifier le profil
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-[#1E3A5F] to-blue-900 text-white flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold border-4 border-white/30">
            {(profile.firstName || profile.email || 'P').charAt(0).toUpperCase()}
            {profile.lastName?.charAt(0)?.toUpperCase() || ''}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold">{fullName}</h2>
            <p className="text-blue-200 mt-1">{profile.company || 'Entreprise non renseignée'}</p>
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
          {profile.referralCode && (
            <div className="mb-8 bg-blue-50 border border-blue-100 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-blue-900 mb-1">Votre lien de referral unique</h3>
                <p className="text-sm text-blue-700">Partagez ce lien avec vos prospects. Chaque inscription sera liée à votre compte.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <code className="bg-white px-3 py-2 rounded-lg border border-blue-200 text-sm text-blue-800 font-mono flex-1 sm:flex-none truncate max-w-[200px] sm:max-w-xs">
                  {referralLink}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-noya-blue text-white rounded-lg hover:bg-blue-900 transition-colors flex-shrink-0"
                  title="Copier le lien"
                >
                  {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} className="text-noya-blue" /> Informations Personnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="tel"
                      disabled={!isEditing}
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building size={20} className="text-noya-blue" /> Informations Entreprise
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse complète</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                    <textarea
                      disabled={!isEditing}
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      rows={2}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard size={20} className="text-noya-blue" /> Coordonnées Bancaires (RIB)
              </h3>
              <p className="text-sm text-gray-500 mb-4">Ces informations sont nécessaires pour le versement de vos commissions.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.iban}
                    onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BIC / SWIFT</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.bic}
                    onChange={(e) => setProfile({ ...profile, bic: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end pt-6 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-noya-blue text-white font-medium rounded-xl hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-50"
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
