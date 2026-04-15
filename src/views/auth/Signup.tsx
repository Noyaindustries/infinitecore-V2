import React, { useState, useEffect, useCallback } from 'react';
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
import { auth, db } from '@/lib/clientSdk';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  verifyEmailLoginCode,
  verifyEmailSignupCode,
} from '@/lib/mongoAuth';
import { doc, setDoc } from '@/lib/mongoFirestore';
import { apiRequest } from '../../lib/apiClient';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { openGoogleConfirmDialog } from '../../lib/googleConfirmUI';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addClient } = useStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupChallengeId, setSignupChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [googleVerificationPending, setGoogleVerificationPending] = useState(false);
  const [googleVerificationCode, setGoogleVerificationCode] = useState('');
  const [googleChallengeId, setGoogleChallengeId] = useState('');
  const [googleVerificationEmail, setGoogleVerificationEmail] = useState('');
  const [googleIsNewUser, setGoogleIsNewUser] = useState(false);

  const homePathForRole = (role: string | undefined): string => {
    switch (role) {
      case 'admin': return '/superadmin';
      case 'commando': return '/admin';
      case 'developer': return '/developer';
      case 'partner': return '/partenaire';
      case 'client':
      default: return '/dashboard';
    }
  };

  const navigateAfterSignup = async () => {
    try {
      const { apiRequest } = await import('../../lib/apiClient');
      const meData = await apiRequest<{ success: boolean; userData?: { role?: string } }>('/api/auth/me');
      navigate(homePathForRole(meData?.userData?.role), { replace: true });
    } catch {
      navigate('/dashboard', { replace: true });
    }
  };
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

  const handleCloseForm = () => {
    const hasDraft = Object.values(formData).some((value) => value.trim().length > 0);
    const shouldConfirm =
      hasDraft || currentStep > 1 || awaitingEmailVerification || googleVerificationPending;
    if (shouldConfirm) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }
    navigate('/');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Fetch partner name
      const fetchPartner = async () => {
        try {
          const payload = await apiRequest<{
            success: boolean;
            partner?: { id: string; firstName?: string; lastName?: string; email?: string };
          }>(`/api/auth/referral?ref=${encodeURIComponent(ref)}`);
          if (payload?.success && payload.partner) {
            setReferrerId(payload.partner.id);
            setReferrerName(getPartnerLabel(payload.partner, payload.partner.id));
          }
        } catch (err) {
          // Ne bloque pas l'inscription si la référence est absente/invalide.
          console.warn('[Signup] referral lookup unavailable:', err);
        }
      };
      fetchPartner();
    }
  }, [location]);

  const syncReferralSignupSideEffects = async (payload: {
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
      await apiRequest('/api/auth/referral-signup-notify', {
        method: 'POST',
        body: JSON.stringify({
          referralCode,
          referredByPartnerId: referrerId || null,
          referredByPartnerName: referrerName?.trim() || null,
          signupUserId: payload.signupUserId || null,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          companyName: payload.companyName,
          industry: payload.industry,
        }),
      });
    } catch (error) {
      // Effet secondaire non bloquant : on ne casse jamais le signup.
      console.error('[Signup] referral side-effects sync failed:', error);
    }
  };

  const updateFormData = (field: string, value: any) => {
    if (awaitingEmailVerification && (field === 'email' || field === 'password' || field === 'confirmPassword')) {
      setAwaitingEmailVerification(false);
      setSignupChallengeId('');
      setVerificationCode('');
    }
    if (field === 'email' && googleVerificationPending) {
      setGoogleVerificationPending(false);
      setGoogleVerificationCode('');
      setGoogleChallengeId('');
      setGoogleVerificationEmail('');
      setGoogleIsNewUser(false);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 12) score += 1;
    if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    return Math.max(1, score);
  };

  const isStrongPassword = (password: string) =>
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

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
    if (!isStrongPassword(formData.password)) {
      toast.error('Mot de passe insuffisant (12+ caractères, majuscule, minuscule, chiffre et symbole).');
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
    if (currentStep === 3 && awaitingEmailVerification) {
      setAwaitingEmailVerification(false);
      setSignupChallengeId('');
      setVerificationCode('');
    }
    setCurrentStep((prev) => (prev === 3 ? 2 : 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!awaitingEmailVerification && ![1, 2, 3].every((step) => validateStep(step as 1 | 2 | 3))) {
      return;
    }
    if (awaitingEmailVerification && !/^\d{6}$/.test(verificationCode.trim())) {
      toast.error('Saisissez le code email à 6 chiffres.');
      return;
    }
    if (awaitingEmailVerification && !signupChallengeId) {
      toast.error("La session de vérification a expiré. Redémarrez l'inscription.");
      setAwaitingEmailVerification(false);
      return;
    }

    setIsLoading(true);

    try {
      let user: { uid: string; email: string | null } | null = null;
      if (!awaitingEmailVerification) {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        if ('verificationRequired' in userCredential && userCredential.verificationRequired) {
          if (!userCredential.challengeId) {
            throw new Error("Impossible de démarrer la vérification email.");
          }
          setSignupChallengeId(userCredential.challengeId);
          setVerificationCode('');
          setAwaitingEmailVerification(true);
          toast.success('Code de vérification envoyé par email.');
          return;
        }
        user = userCredential.user;
      } else {
        const verified = await verifyEmailSignupCode(auth, {
          email: formData.email.trim().toLowerCase(),
          challengeId: signupChallengeId,
          code: verificationCode.trim(),
        });
        user = verified.user;
        setAwaitingEmailVerification(false);
      }
      if (!user) {
        throw new Error('Compte utilisateur indisponible après vérification.');
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
          companyId: null,
          referredBy: referralCode || null,
          referredByPartnerId: referrerId || null,
          referredByPartnerName: referrerName?.trim() || null,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
      }

      await syncReferralSignupSideEffects({
        signupUserId: user.uid,
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
      await navigateAfterSignup();
      
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
        const msg = typeof error?.message === 'string' ? error.message : '';
        toast.error(msg || 'Une erreur est survenue lors de la création du compte.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const runGoogleSignup = useCallback(
    async () => {
      const confirmed = await openGoogleConfirmDialog({
        title: 'Vérification de sécurité',
        description: 'Confirmez l’ouverture de Google pour continuer la création ou la connexion à votre compte.',
        confirmLabel: 'Continuer avec Google',
        cancelLabel: 'Annuler',
      });
      if (!confirmed) {
        toast.error('Connexion Google annulée.');
        return;
      }

      setIsLoading(true);
      try {
        const providerName = 'google' as const;
        let provider;
        if (providerName === 'google') {
          provider = new GoogleAuthProvider();
        }

        if (!provider) {
          throw new Error('Provider not initialized');
        }

        const emailTrim = formData.email.trim();
        provider.setCustomParameters({
          prompt: 'select_account',
          ...(emailTrim ? { login_hint: emailTrim } : {}),
        });
        const userCredential = await signInWithPopup(auth, provider, {
          email: emailTrim || undefined,
          displayName: formData.fullName.trim() || undefined,
          companyName: `${formData.fullName.trim() || 'Mon'}'s Company`,
          industry: 'Non spécifié',
          size: '1-5',
          referredBy: referralCode || null,
          referredByPartnerId: referrerId || null,
          referredByPartnerName: referrerName?.trim() || null,
        });
        if ('verificationRequired' in userCredential && userCredential.verificationRequired) {
          if (!userCredential.challengeId) {
            throw new Error("Challenge de vérification Google manquant.");
          }
          const verifiedEmail = userCredential.email || emailTrim;
          setGoogleVerificationPending(true);
          setGoogleVerificationCode('');
          setGoogleChallengeId(userCredential.challengeId);
          setGoogleVerificationEmail(verifiedEmail);
          setGoogleIsNewUser(Boolean(userCredential.isNew));
          toast.success('Code de vérification Google envoyé par email.');
          return;
        }
        const u = userCredential.user as { uid: string; email?: string | null; displayName?: string | null; role?: string };
        const isNew = (userCredential as { isNew?: boolean }).isNew;

        if (isNew) {
          try {
            await syncReferralSignupSideEffects({
              signupUserId: u.uid,
              firstName: u.displayName?.split(' ')[0] || '',
              lastName: u.displayName?.split(' ').slice(1).join(' ') || '',
              email: u.email || '',
              phone: '',
              companyName: `${u.displayName || 'Mon'}'s Company`,
              industry: 'Non spécifié',
            });
          } catch (e) {
            console.error("Lead sync failed", e);
          }

          addClient({
            name: u.displayName || u.email || 'Nouveau Client',
            email: u.email || '',
            company: `${u.displayName || 'Mon'}'s Company`,
            pack: 'Pack Essentiel'
          });

          setIsSuccess(true);
          await navigateAfterSignup();
        } else {
          navigate(homePathForRole(u.role), { replace: true });
        }
      } catch (error: unknown) {
        const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : '';
        const cancelled =
          code === 'auth/popup-closed-by-user' ||
          (typeof (error as Error)?.message === 'string' && (error as Error).message.includes('Connexion Google annulée'));
        if (cancelled) {
          toast.error('Connexion Google annulée.');
        } else {
          console.error('google signup error:', error);
          if (code === 'auth/popup-blocked') {
            toast.error('Le popup a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.');
          } else if (code === 'auth/unauthorized-domain') {
            toast.error("Ce domaine n'est pas autorisé pour l'inscription. Veuillez contacter l'administrateur.");
          } else {
            toast.error("Erreur lors de l'inscription avec Google.");
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      formData.email,
      formData.fullName,
      referralCode,
      referrerId,
      referrerName,
      addClient,
      navigate,
      navigateAfterSignup,
      syncReferralSignupSideEffects,
    ]
  );

  const handleOAuth = (providerName: 'google') => {
    if (providerName !== 'google') return;
    void runGoogleSignup();
  };

  const completeGoogleVerification = async () => {
    const code = googleVerificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Entrez le code Google à 6 chiffres.');
      return;
    }
    if (!googleChallengeId || !googleVerificationEmail) {
      toast.error('Session Google expirée. Relancez Google.');
      return;
    }
    setIsLoading(true);
    try {
      const verified = await verifyEmailLoginCode(auth, {
        email: googleVerificationEmail,
        challengeId: googleChallengeId,
        code,
      });
      const u = verified.user as any;
      if (googleIsNewUser) {
        try {
          await syncReferralSignupSideEffects({
            signupUserId: u.uid,
            firstName: u.displayName?.split(' ')[0] || '',
            lastName: u.displayName?.split(' ').slice(1).join(' ') || '',
            email: u.email || '',
            phone: '',
            companyName: `${u.displayName || 'Mon'}'s Company`,
            industry: 'Non spécifié',
          });
        } catch (e) { console.error("Lead sync failed", e); }
        addClient({
          name: u.displayName || u.email || 'Nouveau Client',
          email: u.email || '',
          company: `${u.displayName || 'Mon'}'s Company`,
          pack: 'Pack Essentiel'
        });
      }
      setGoogleVerificationPending(false);
      setGoogleVerificationCode('');
      setGoogleChallengeId('');
      setGoogleVerificationEmail('');
      setGoogleIsNewUser(false);
      navigate(homePathForRole(u.role), { replace: true });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : '';
      toast.error(msg || 'Validation Google impossible.');
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
              {googleVerificationPending ? (
                <div className="rounded-xl border border-white/10 bg-[#080d17]/84 p-3 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.85)]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                    Vérification Google
                  </p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    Code envoyé à <span className="font-medium text-white">{googleVerificationEmail}</span>
                  </p>
                  <div className="relative mt-2">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-5 w-5 text-[#4B5563]" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={googleVerificationCode}
                      onChange={(e) => setGoogleVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="block w-full rounded-xl border border-white/10 bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm tracking-[0.24em] text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                      placeholder="000000"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void completeGoogleVerification()}
                      disabled={isLoading}
                      className="rounded-xl bg-[#6366F1] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
                    >
                      Valider le code
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOAuth('google')}
                      disabled={isLoading}
                      className="text-xs font-medium text-[#6366F1] transition-colors hover:text-indigo-400 disabled:opacity-60"
                    >
                      Relancer Google
                    </button>
                  </div>
                </div>
              ) : null}
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
                        placeholder="12+ caractères, majuscule, minuscule, chiffre, symbole"
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
                  {awaitingEmailVerification ? (
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-[#9CA3AF]">
                        Code de vérification email <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-5 w-5 text-[#4B5563]" />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="block w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] py-2.5 pl-10 pr-3 text-sm tracking-[0.24em] text-white placeholder-[#4B5563] focus:border-[#6366F1] focus:ring-[#6366F1]"
                          placeholder="000000"
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#9CA3AF]">Code envoyé à {formData.email}</p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!validateStep(3)) return;
                          setIsLoading(true);
                          try {
                            const retry = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                            if ('verificationRequired' in retry && retry.verificationRequired && retry.challengeId) {
                              setSignupChallengeId(retry.challengeId);
                              setVerificationCode('');
                              toast.success('Nouveau code envoyé par email.');
                              return;
                            }
                            toast.error("Impossible de renvoyer le code pour le moment.");
                          } catch (error) {
                            const msg = error instanceof Error ? error.message : 'Impossible de renvoyer le code.';
                            toast.error(msg);
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                        className="mt-2 text-xs font-medium text-[#6366F1] transition-colors hover:text-indigo-400 disabled:opacity-60"
                      >
                        Renvoyer le code
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="w-full shrink-0 rounded-xl border border-[#2d2d3d] px-4 py-3 text-sm font-semibold text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white sm:min-w-0 sm:flex-1"
                >
                  Fermer le formulaire
                </button>
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
                    {isLoading
                      ? 'Traitement en cours...'
                      : awaitingEmailVerification
                        ? 'Valider mon email'
                        : 'Recevoir mon code'}{' '}
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
