import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Phone, 
  ArrowRight,
  Building2,
  CheckCircle,
  Briefcase,
  Users
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addClient } = useStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    industry: '',
    employees: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Fetch partner name
      const fetchPartner = async () => {
        try {
          const partnerDoc = await getDoc(doc(db, 'users', ref));
          if (partnerDoc.exists()) {
            const data = partnerDoc.data();
            setReferrerName(`${data.firstName || ''} ${data.lastName || ''}`.trim());
          }
        } catch (err) {
          console.error("Error fetching partner name:", err);
        }
      };
      fetchPartner();
    }
  }, [location]);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    return Math.max(1, score);
  };

  const strength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create company
      const companyId = `comp_${Date.now()}`;
      try {
        await setDoc(doc(db, 'companies', companyId), {
          id: companyId,
          name: formData.company,
          industry: formData.industry,
          size: formData.employees,
          pack: 'starter', // Default
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `companies/${companyId}`);
      }

      // Extract first and last name from fullName
      const nameParts = formData.fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      const isAdminEmail = formData.email === 'superadmin@infinitecore.com';

      // Create user profile in Firestore
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email,
          firstName: firstName,
          lastName: lastName,
          phone: formData.phone,
          company: formData.company,
          industry: formData.industry,
          employees: formData.employees,
          role: isAdminEmail ? 'admin' : 'client',
          companyId: companyId,
          referredBy: referralCode || null,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
      }

      // Keep local store update for UI consistency if needed
      addClient({
        name: formData.fullName,
        email: formData.email,
        company: formData.company,
        pack: 'Pack Essentiel'
      });
      
      setIsSuccess(true);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate(isAdminEmail ? '/superadmin' : '/dashboard');
      }, 3000);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // If user was created in Auth but Firestore failed, clean up
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (e) {
          console.error("Cleanup failed", e);
        }
      }

      if (error.code === 'auth/email-already-in-use' || (error.message && error.message.includes('auth/email-already-in-use'))) {
        toast.error('Cet email est déjà utilisé.');
      } else {
        toast.error('Une erreur est survenue lors de la création du compte.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (providerName: 'google') => {
    setIsLoading(true);
    try {
      let provider;
      if (providerName === 'google') {
        provider = new GoogleAuthProvider();
      }

      if (!provider) {
        throw new Error('Provider not initialized');
      }

      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const nameParts = (user.displayName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const isAdminEmail = user.email === 'superadmin@infinitecore.com';

        // Create company
        const companyId = `comp_${Date.now()}`;
        try {
          await setDoc(doc(db, 'companies', companyId), {
            id: companyId,
            name: `${firstName}'s Company`,
            industry: 'Non spécifié',
            size: '1-5',
            pack: 'starter',
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `companies/${companyId}`);
        }

        // Create user profile
        try {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || '',
            firstName: firstName,
            lastName: lastName,
            phone: user.phoneNumber || '',
            role: isAdminEmail ? 'admin' : 'client',
            companyId: companyId,
            referredBy: referralCode || null,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }

        addClient({
          name: user.displayName || user.email || 'Nouveau Client',
          email: user.email || '',
          company: `${firstName}'s Company`,
          pack: 'Pack Essentiel'
        });

        setIsSuccess(true);
        setTimeout(() => {
          navigate(isAdminEmail ? '/superadmin' : '/dashboard');
        }, 3000);
      } else {
        // User already exists, just log them in
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          navigate('/superadmin');
        } else if (userData.role === 'commando') {
          navigate('/admin');
        } else if (userData.role === 'developer') {
          navigate('/developer');
        } else if (userData.role === 'partner') {
          navigate('/partenaire');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error(`${providerName} signup error:`, error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Le popup a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('Ce domaine n\'est pas autorisé dans la configuration Firebase. Veuillez contacter l\'administrateur.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('La fenêtre de connexion a été fermée avant la fin de l\'opération.');
      } else {
        toast.error(`Erreur lors de l'inscription avec ${providerName}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex w-full flex-col items-center px-4 py-8 font-sans sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Créer mon compte gratuit</h2>
        <p className="text-[#9CA3AF]">Prêt en 2 minutes. Aucune carte bancaire.</p>
        {referralCode && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
            <CheckCircle size={16} />
            Parrainé par : <span className="font-bold">{referrerName || 'Partenaire Infinite'}</span>
          </div>
        )}
      </div>

      {/* Form Container */}
      <div className="w-full max-w-2xl bg-[#1E1E2E] rounded-2xl shadow-sm border border-[#2d2d3d] p-8">
        {isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <div className="flex justify-center mb-6">
              <CheckCircle className="text-[#48bb78] w-24 h-24" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Bienvenue !</h3>
            <p className="text-lg text-[#9CA3AF] mb-8">
              Votre compte a été créé avec succès. Redirection vers votre espace...
            </p>
          </motion.div>
        ) : (
          <>
            {/* OAuth Buttons */}
            <div className="space-y-4 mb-8">
              <button 
                onClick={() => handleOAuth('google')}
                className="w-full flex items-center justify-center gap-3 bg-[#0A0A0F] border border-[#2d2d3d] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#111116] transition-colors"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Continuer avec Google
              </button>
            </div>

            <div className="relative flex items-center py-5">
              <div className="flex-grow border-t border-[#2d2d3d]"></div>
              <span className="flex-shrink-0 mx-4 text-[#4B5563] text-sm">OU</span>
              <div className="flex-grow border-t border-[#2d2d3d]"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Prénom et Nom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => updateFormData('fullName', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="Jean Dupont"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="jean@entreprise.com"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => updateFormData('phone', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="+225XXXXXXXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Nom de l'entreprise <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => updateFormData('company', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="Mon Entreprise"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Secteur d'activité <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <select
                      required
                      value={formData.industry}
                      onChange={(e) => updateFormData('industry', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white"
                    >
                      <option value="" disabled>Sélectionnez un secteur</option>
                      <option value="BTP">BTP</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Services">Services</option>
                      <option value="Consulting">Consulting</option>
                      <option value="ONG">ONG</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Nombre d'employés <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <select
                      required
                      value={formData.employees}
                      onChange={(e) => updateFormData('employees', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white"
                    >
                      <option value="" disabled>Sélectionnez une taille</option>
                      <option value="1-5">1-5</option>
                      <option value="6-20">6-20</option>
                      <option value="21-50">21-50</option>
                      <option value="50+">50+</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="Min 8 caractères"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#4B5563] hover:text-[#9CA3AF]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className={`h-1 w-1/3 rounded-full transition-colors ${!formData.password ? 'bg-gray-200' : strength >= 1 ? (strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-yellow-500' : 'bg-[#48bb78]') : 'bg-gray-200'}`}></div>
                    <div className={`h-1 w-1/3 rounded-full transition-colors ${!formData.password ? 'bg-gray-200' : strength >= 2 ? (strength === 2 ? 'bg-yellow-500' : 'bg-[#48bb78]') : 'bg-gray-200'}`}></div>
                    <div className={`h-1 w-1/3 rounded-full transition-colors ${!formData.password ? 'bg-gray-200' : strength >= 3 ? 'bg-[#48bb78]' : 'bg-gray-200'}`}></div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                    Confirmation <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-[#2d2d3d] rounded-xl focus:ring-[#6366F1] focus:border-[#6366F1] text-sm bg-[#0A0A0F] text-white placeholder-[#4B5563]"
                      placeholder="Confirmez le mot de passe"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#6366F1] hover:bg-indigo-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  {isLoading ? 'Création en cours...' : 'Créer mon compte'} <ArrowRight size={20} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Footer Link */}
      {!isSuccess && (
        <div className="mt-8 text-center">
          <p className="text-sm text-[#9CA3AF]">
            Déjà inscrit ? <Link to="/login" className="font-bold text-[#6366F1] hover:text-indigo-400">Connectez-vous</Link>
          </p>
        </div>
      )}

    </div>
  );
}
