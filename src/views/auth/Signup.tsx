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
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';
import { notificationService } from '../../services/notificationService';
import { leadService } from '../../services/leadService';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addClient } = useStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);

  const getPartnerLabel = (data: { firstName?: string; lastName?: string; email?: string }, fallbackId: string) => {
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    return fullName || data.email || `Partenaire ${fallbackId}`;
  };
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    companyDescription: '',
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
          // 1) Compat direct: ref = uid du partenaire
          const partnerDoc = await getDoc(doc(db, 'users', ref));
          if (partnerDoc.exists()) {
            const data = partnerDoc.data() as { firstName?: string; lastName?: string; email?: string };
            setReferrerId(partnerDoc.id);
            setReferrerName(getPartnerLabel(data, partnerDoc.id));
            return;
          }

          // 2) ref = code de parrainage (nouveau champ)
          const byReferralCode = await getDocs(query(collection(db, 'users'), where('referralCode', '==', ref)));
          if (!byReferralCode.empty) {
            const match = byReferralCode.docs[0];
            const data = match.data() as { firstName?: string; lastName?: string; email?: string };
            setReferrerId(match.id);
            setReferrerName(getPartnerLabel(data, match.id));
            return;
          }

          // 3) compat historique: partnerCode
          const byPartnerCode = await getDocs(query(collection(db, 'users'), where('partnerCode', '==', ref)));
          if (!byPartnerCode.empty) {
            const match = byPartnerCode.docs[0];
            const data = match.data() as { firstName?: string; lastName?: string; email?: string };
            setReferrerId(match.id);
            setReferrerName(getPartnerLabel(data, match.id));
          }
        } catch (err) {
          console.error("Error fetching partner name:", err);
        }
      };
      fetchPartner();
    }
  }, [location]);

  const notifyReferralLeadToCommando = async (payload: {
    signupUserId?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName: string;
    industry: string;
  }) => {
    if (!referralCode) return;
    try {
      const [commandoSnap, adminSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'commando'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))),
      ]);

      const recipients = new Set<string>();
      for (const d of commandoSnap.docs) {
        const data = d.data() as { uid?: string };
        recipients.add(data.uid || d.id);
      }
      for (const d of adminSnap.docs) {
        const data = d.data() as { uid?: string };
        recipients.add(data.uid || d.id);
      }

      const partnerLabel = referrerName?.trim() || 'Partenaire Infinite';
      const message = `Inscription via le lien de ${partnerLabel}: ${payload.firstName} ${payload.lastName} (${payload.companyName}) - ${payload.industry} - ${payload.phone} - ref: ${referralCode}`;
      const metadata = {
        referralCode,
        referredByPartnerId: referrerId || null,
        referredByPartnerName: partnerLabel,
        source: 'referral_signup',
        signupUserId: payload.signupUserId || null,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        companyName: payload.companyName,
        industry: payload.industry,
        leadCreated: false,
      };

      if (recipients.size > 0) {
        await Promise.all(
          Array.from(recipients).map((recipientId) =>
            notificationService.createNotification(
              recipientId,
              'Nouveau formulaire parrainage',
              message,
              'order',
              metadata
            )
          )
        );
      } else {
        await notificationService.createNotification(
          'admin_general',
          'Nouveau formulaire parrainage',
          message,
          'order',
          metadata
        );
      }
    } catch (error) {
      console.error('[Signup] notify referral failed:', error);
    }
  };

  const ensureReferralLeadForPartner = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName: string;
    industry: string;
  }) => {
    if (!referrerId || !referralCode) return;
    try {
      const existingLead = await getDocs(
        query(
          collection(db, 'leads'),
          where('partnerId', '==', referrerId),
          where('email', '==', payload.email)
        )
      );
      if (!existingLead.empty) return;

      await leadService.createLead({
        partnerId: referrerId,
        partnerName: referrerName?.trim() || 'Partenaire Infinite',
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        companyName: payload.companyName || 'Prospect parrainé',
        sector: payload.industry || 'Non spécifié',
        city: 'Non spécifiée',
        employeesRange: '1-5',
        urgency: 'moyenne',
        whatsapp: payload.phone || 'Non renseigné',
        phone: payload.phone || 'Non renseigné',
        note: `Inscription via lien de parrainage (${referralCode}).`,
        status: 'soumis',
      });
    } catch (error) {
      console.error('[Signup] ensure referral lead for partner failed:', error);
    }
  };

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

  const validateStep = (step: 1 | 2 | 3) => {
    if (step === 1) {
      if (!formData.fullName.trim()) {
        toast.error('Le nom complet est requis.');
        return false;
      }
      if (!formData.email.trim()) {
        toast.error("L'email est requis.");
        return false;
      }
      if (!formData.phone.trim()) {
        toast.error('Le numéro WhatsApp est requis.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!formData.company.trim()) {
        toast.error("Le nom de l'entreprise est requis.");
        return false;
      }
      if (!formData.industry.trim()) {
        toast.error("Le secteur d'activité est requis.");
        return false;
      }
      if (!formData.employees.trim()) {
        toast.error("Le nombre d'employés est requis.");
        return false;
      }
      return true;
    }

    if (!formData.password.trim()) {
      toast.error('Le mot de passe est requis.');
      return false;
    }
    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => (prev === 1 ? 2 : 3));
  };

  const goToPrevStep = () => {
    setCurrentStep((prev) => (prev === 3 ? 2 : 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (![1, 2, 3].every((step) => validateStep(step as 1 | 2 | 3))) {
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
          description: formData.companyDescription.trim() || '',
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
          companyDescription: formData.companyDescription.trim() || '',
          industry: formData.industry,
          employees: formData.employees,
          role: isAdminEmail ? 'admin' : 'client',
          companyId: companyId,
          referredBy: referralCode || null,
          referredByPartnerId: referrerId || null,
          referredByPartnerName: referrerName?.trim() || null,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
      }

      await notifyReferralLeadToCommando({
        signupUserId: user.uid,
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.company,
        industry: formData.industry,
      });
      await ensureReferralLeadForPartner({
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.company,
        industry: formData.industry,
      });

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

      const emailTrim = formData.email.trim();
      if (emailTrim) {
        provider.setCustomParameters({ login_hint: emailTrim });
      }
      const userCredential = await signInWithPopup(auth, provider, {
        email: emailTrim || undefined,
        displayName: formData.fullName.trim() || undefined,
      });
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
            referredByPartnerId: referrerId || null,
            referredByPartnerName: referrerName?.trim() || null,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }

        await notifyReferralLeadToCommando({
          signupUserId: user.uid,
          firstName,
          lastName,
          email: user.email || '',
          phone: user.phoneNumber || '',
          companyName: `${firstName}'s Company`,
          industry: 'Non spécifié',
        });
        await ensureReferralLeadForPartner({
          firstName,
          lastName,
          email: user.email || '',
          phone: user.phoneNumber || '',
          companyName: `${firstName}'s Company`,
          industry: 'Non spécifié',
        });

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
        const profile = userDoc.data();
        if (!profile) {
          navigate('/dashboard');
          return;
        }
        const role = typeof profile.role === 'string' ? profile.role : 'client';
        if (role === 'admin') {
          navigate('/superadmin');
        } else if (role === 'commando') {
          navigate('/admin');
        } else if (role === 'developer') {
          navigate('/developer');
        } else if (role === 'partner') {
          navigate('/partenaire');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      const code = error?.code;
      const cancelled =
        code === 'auth/popup-closed-by-user' ||
        (typeof error?.message === 'string' && error.message.includes('Connexion Google annulée'));
      if (cancelled) {
        toast.error('Connexion Google annulée.');
      } else {
        console.error(`${providerName} signup error:`, error);
        if (code === 'auth/popup-blocked') {
          toast.error('Le popup a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.');
        } else if (code === 'auth/unauthorized-domain') {
          toast.error('Ce domaine n\'est pas autorisé dans la configuration Firebase. Veuillez contacter l\'administrateur.');
        } else {
          toast.error(`Erreur lors de l'inscription avec ${providerName}.`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex w-full min-w-0 max-w-full flex-col items-center px-3 py-5 font-sans sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="mb-5 w-full min-w-0 max-w-2xl px-1 text-center sm:mb-6">
        <h2 className="mb-1 text-2xl font-bold leading-tight text-white sm:text-3xl">Créer mon compte gratuit</h2>
        <p className="text-pretty text-sm text-[#9CA3AF] sm:text-base">Prêt en 2 minutes. Aucune carte bancaire.</p>
        {referralCode && (
          <div className="mx-auto mt-3 flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-medium text-blue-700 sm:px-4 sm:text-sm">
            <CheckCircle size={16} className="shrink-0" />
            <span className="min-w-0 wrap-break-word">
              Parrainé par : <span className="font-bold">{referrerName || 'Partenaire Infinite'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Form Container */}
      <div className="w-full min-w-0 max-w-2xl rounded-2xl border border-[#2d2d3d] bg-[#1E1E2E] p-4 shadow-sm sm:p-6 md:p-7">
        {isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <div className="flex justify-center mb-6">
              <CheckCircle className="text-[#48bb78] w-24 h-24" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Bienvenue !</h3>
            <p className="mb-8 text-base text-pretty text-[#9CA3AF] sm:text-lg">
              Votre compte a été créé avec succès. Redirection vers votre espace...
            </p>
          </motion.div>
        ) : (
          <>
            {/* OAuth Buttons */}
            <div className="mb-6 space-y-3">
              <button 
                onClick={() => handleOAuth('google')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#111116] sm:px-6 sm:py-2.5"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Continuer avec Google
              </button>
            </div>

            <div className="relative flex items-center py-3">
              <div className="grow border-t border-[#2d2d3d]"></div>
              <span className="mx-3 shrink-0 text-sm text-[#4B5563]">OU</span>
              <div className="grow border-t border-[#2d2d3d]"></div>
            </div>

            <form onSubmit={handleSubmit} className="mt-3 space-y-4">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] p-1 sm:gap-2">
                {[1, 2, 3].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setCurrentStep(step as 1 | 2 | 3)}
                    className={`touch-skip rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors sm:px-2 sm:py-1.5 sm:text-xs ${
                      currentStep === step ? 'bg-[#6366F1] text-white' : 'text-[#9CA3AF] hover:bg-white/5'
                    }`}
                    aria-label={`Étape ${step}`}
                    aria-current={currentStep === step ? 'step' : undefined}
                  >
                    <span className="sm:hidden" aria-hidden>
                      {step}
                    </span>
                    <span className="hidden sm:inline">Étape {step}</span>
                  </button>
                ))}
              </div>

              {currentStep === 1 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                        placeholder="jean@entreprise.com"
                      />
                    </div>
                  </div>

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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                        placeholder="+225XXXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                        placeholder="Mon Entreprise"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          title="Secteur d'activité"
                          aria-label="Secteur d'activité"
                          value={formData.industry}
                          onChange={(e) => updateFormData('industry', e.target.value)}
                          className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white focus:border-[#6366F1] focus:ring-[#6366F1]"
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
                          title="Nombre d'employés"
                          aria-label="Nombre d'employés"
                          value={formData.employees}
                          onChange={(e) => updateFormData('employees', e.target.value)}
                          className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white focus:border-[#6366F1] focus:ring-[#6366F1]"
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

                  <div>
                    <label className="block text-sm font-medium text-[#9CA3AF] mb-1">
                      Description de l'entreprise
                    </label>
                    <textarea
                      rows={2}
                      value={formData.companyDescription}
                      onChange={(e) => updateFormData('companyDescription', e.target.value)}
                      className="block w-full resize-none rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] px-3 py-2.5 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                      placeholder="Décrivez brièvement l'activité, les services ou le positionnement de votre entreprise."
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-10 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
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
                        className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                        placeholder="Confirmez le mot de passe"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    className="w-full shrink-0 rounded-xl border border-[#2d2d3d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5 sm:min-w-0 sm:flex-1"
                  >
                    Précédent
                  </button>
                )}

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-4 py-3 text-sm font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-colors hover:bg-indigo-500 sm:flex-1 sm:px-6 sm:text-base"
                  >
                    Suivant <ArrowRight size={20} className="shrink-0" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-4 py-3 text-sm font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:px-6 sm:text-base"
                  >
                    {isLoading ? 'Création en cours...' : 'Créer mon compte'}{' '}
                    <ArrowRight size={20} className="shrink-0" />
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* Footer Link */}
      {!isSuccess && (
        <div className="mt-6 text-center">
          <p className="text-sm text-[#9CA3AF]">
            Déjà inscrit ? <Link to="/login" className="font-bold text-[#6366F1] hover:text-indigo-400">Connectez-vous</Link>
          </p>
        </div>
      )}

    </div>
  );
}
