import React, { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  verifyEmailLoginCode,
} from '@/lib/mongoAuth';
import { collection, doc, getDoc, getDocs, query, where } from '@/lib/mongoFirestore';
import { auth, db } from '@/lib/clientSdk';
import { useAuth } from '../../components/AuthProvider';
import { openGoogleConfirmDialog } from '../../lib/googleConfirmUI';
import toast from 'react-hot-toast';

function homePathForRole(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return '/superadmin';
    case 'commando':
      return '/admin';
    case 'developer':
      return '/developer';
    case 'partner':
      return '/partenaire';
    case 'client':
    default:
      return '/dashboard';
  }
}

export default function Login({ isStaff = false }: { isStaff?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isAuthReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginStep, setLoginStep] = useState<1 | 2 | 3>(1);
  const [verificationMethod, setVerificationMethod] = useState<'password' | 'google' | null>(null);
  const [loginChallengeId, setLoginChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleCloseForm = () => {
    const shouldConfirm =
      email.trim().length > 0 || password.trim().length > 0 || verificationCode.trim().length > 0 || loginStep > 1;
    if (shouldConfirm) {
      const confirmed = window.confirm(
        'Voulez-vous vraiment fermer ce formulaire ? Les informations saisies seront perdues.'
      );
      if (!confirmed) return;
    }
    navigate('/');
  };

  const getPartnerLabel = (data: { firstName?: string; lastName?: string; email?: string }, fallbackId: string) => {
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    return fullName || data.email || `Partenaire ${fallbackId}`;
  };

  React.useEffect(() => {
    if (!isAuthReady || !user || !userData) return;
    navigate(homePathForRole(userData.role), { replace: true });
  }, [isAuthReady, user, userData, navigate]);

  const runGoogleSignIn = useCallback(
    async () => {
      const confirmed = await openGoogleConfirmDialog({
        title: 'Vérification de sécurité',
        description: isStaff
          ? "Confirmez l'ouverture de Google pour accéder à l’espace équipe."
          : 'Confirmez l’ouverture de Google pour continuer la connexion ou la création de compte.',
        confirmLabel: 'Continuer avec Google',
        cancelLabel: 'Annuler',
      });
      if (!confirmed) {
        toast.error('Connexion Google annulée.');
        return;
      }

      setLoading(true);
      const safetyMs = 32_000;
      const safetyId = window.setTimeout(() => {
        setLoading(false);
        toast.error(
          'Connexion Google trop longue : vérifiez l’API, MongoDB et l’onglet Réseau pour `/api/auth/google`.'
        );
      }, safetyMs);
      try {
        const provider = new GoogleAuthProvider();
        const emailTrim = email.trim();
        provider.setCustomParameters({
          prompt: 'select_account',
          ...(emailTrim ? { login_hint: emailTrim } : {}),
        });
        const userCredential = await signInWithPopup(auth, provider, {
          email: emailTrim || undefined,
          staffOnly: isStaff,
        });
        if ('verificationRequired' in userCredential && userCredential.verificationRequired) {
          if (!userCredential.challengeId) {
            throw new Error("Impossible de démarrer la vérification email Google.");
          }
          if (isStaff && userCredential.role !== 'admin' && userCredential.role !== 'commando') {
            toast.error('Ce compte n’a pas accès à l’espace équipe (commando ou admin uniquement).');
            return;
          }
          const verifiedEmail = userCredential.email || emailTrim;
          setEmail(verifiedEmail);
          setLoginChallengeId(userCredential.challengeId);
          setVerificationCode('');
          setVerificationMethod('google');
          setLoginStep(3);
          toast.success('Code de vérification Google envoyé par email.');
          return;
        }
        toast.success('Connexion réussie');
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
        if (code === 'auth/popup-blocked') {
          toast.error('Le navigateur a bloqué la fenêtre Google. Autorisez les popups pour ce site.');
        } else if (code === 'auth/unauthorized-domain') {
          toast.error('Ce domaine n’est pas autorisé pour la connexion. Contactez l’administrateur.');
        } else if (code === 'auth/popup-closed-by-user') {
          toast.error('Connexion Google annulée.');
        } else {
          toast.error('Connexion Google impossible. Réessayez.');
        }
      } finally {
        window.clearTimeout(safetyId);
        setLoading(false);
      }
    },
    [email, isStaff]
  );

  React.useEffect(() => {
    if (isStaff) return;
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (!ref) {
      setReferralCode(null);
      setReferrerId(null);
      setReferrerName(null);
      return;
    }
    setReferralCode(ref);

    const fetchPartner = async () => {
      try {
        const partnerById = await getDoc(doc(db, 'users', ref));
        if (partnerById.exists()) {
          const data = partnerById.data() as { firstName?: string; lastName?: string; email?: string };
          setReferrerId(partnerById.id);
          setReferrerName(getPartnerLabel(data, partnerById.id));
          return;
        }

        const partnerByReferralCode = await getDocs(query(collection(db, 'users'), where('referralCode', '==', ref)));
        if (!partnerByReferralCode.empty) {
          const match = partnerByReferralCode.docs[0];
          const data = match.data() as { firstName?: string; lastName?: string; email?: string };
          setReferrerId(match.id);
          setReferrerName(getPartnerLabel(data, match.id));
          return;
        }

        const partnerByLegacyCode = await getDocs(query(collection(db, 'users'), where('partnerCode', '==', ref)));
        if (!partnerByLegacyCode.empty) {
          const match = partnerByLegacyCode.docs[0];
          const data = match.data() as { firstName?: string; lastName?: string; email?: string };
          setReferrerId(match.id);
          setReferrerName(getPartnerLabel(data, match.id));
        }
      } catch (error) {
        console.error('[Login] unable to resolve referral code:', error);
      }
    };

    void fetchPartner();
  }, [isStaff, location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep === 1) {
      const emailTrim = email.trim();
      if (!emailTrim) {
        toast.error("Veuillez renseigner votre adresse e-mail.");
        return;
      }
      const looksLikeEmail = /\S+@\S+\.\S+/.test(emailTrim);
      if (!looksLikeEmail) {
        toast.error("Format d'email invalide.");
        return;
      }
      setEmail(emailTrim);
      setVerificationCode('');
      setLoginChallengeId('');
      setVerificationMethod(null);
      setLoginStep(2);
      return;
    }

    if (loginStep === 2 && !password.trim()) {
      toast.error('Veuillez saisir votre mot de passe.');
      return;
    }

    if (loginStep === 3 && !/^\d{6}$/.test(verificationCode.trim())) {
      toast.error('Saisissez le code à 6 chiffres reçu par email.');
      return;
    }
    if (loginStep === 3 && !loginChallengeId) {
      toast.error('Session de vérification expirée. Recommencez la connexion.');
      setLoginStep(1);
      setPassword('');
      return;
    }

    setLoading(true);
    /** Filet de sécurité si une promesse ne se termine jamais (hors `apiRequest`). */
    const safetyMs = 32_000;
    const safetyId = window.setTimeout(() => {
      setLoading(false);
      toast.error(
        'Connexion trop longue : vérifiez que `npm run dev` tourne, que MongoDB répond (DATABASE_URL, IP Atlas), et l’onglet Réseau pour `/api/auth/login`.'
      );
    }, safetyMs);
    try {
      if (loginStep === 2) {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        if ('verificationRequired' in result && result.verificationRequired) {
          if (!result.challengeId) {
            throw new Error("Impossible de démarrer la vérification email.");
          }
          setLoginChallengeId(result.challengeId);
          setVerificationCode('');
          setVerificationMethod('password');
          setLoginStep(3);
          toast.success('Code de vérification envoyé par email.');
        } else {
          toast.success('Connexion réussie');
        }
      } else {
        await verifyEmailLoginCode(auth, {
          email: email.trim(),
          challengeId: loginChallengeId,
          code: verificationCode.trim(),
        });
        setVerificationMethod(null);
        toast.success('Connexion validée');
      }
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        toast.error('Email ou mot de passe incorrect.');
      } else {
        const msg = err instanceof Error ? err.message : '';
        toast.error(msg || 'Impossible de se connecter. Réessayez.');
      }
    } finally {
      window.clearTimeout(safetyId);
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    void runGoogleSignIn();
  };

  const handlePasswordReset = async () => {
    const targetEmail = (email || window.prompt('Entrez votre e-mail de réinitialisation') || '').trim();
    if (!targetEmail) {
      toast.error('Veuillez renseigner une adresse e-mail.');
      return;
    }
    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      toast.success(
        'Si ce compte existe, les instructions de réinitialisation ont été enregistrées. (En dev: voir la console navigateur)'
      );
    } catch {
      toast.error('Impossible de préparer la réinitialisation pour le moment.');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="relative min-h-0 overflow-hidden px-2.5 py-2 sm:min-h-[calc(100dvh-76px)] sm:px-5 sm:py-4 md:min-h-[calc(100dvh-84px)] lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_-20%,rgba(43,84,126,0.24),transparent_58%),radial-gradient(ellipse_65%_55%_at_100%_0%,rgba(217,138,44,0.16),transparent_55%),radial-gradient(ellipse_60%_45%_at_0%_100%,rgba(139,107,93,0.14),transparent_60%)]" />
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#080d17]/92 p-3 shadow-[0_40px_110px_-52px_rgba(0,0,0,0.9),0_0_0_1px_rgba(212,173,96,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:rounded-[1.5rem] sm:p-4"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/35 to-transparent" />
          <div className="mb-3.5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-black/25 p-1 text-[10px] sm:text-[11px]">
            <Link
              to="/login"
              className={`rounded-lg px-3 py-2 text-center font-semibold transition-colors ${
                !isStaff ? 'bg-luxe-champagne/20 text-luxe-champagne-bright' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              Espace client
            </Link>
            <Link
              to="/login/staff"
              className={`rounded-lg px-3 py-2 text-center font-semibold transition-colors ${
                isStaff ? 'bg-luxe-champagne/20 text-luxe-champagne-bright' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              Espace équipe
            </Link>
          </div>

          <div className="text-center">
            <h1 className="font-display text-[1.52rem] font-semibold text-text-primary sm:text-[1.7rem]">
              {isStaff ? 'Connexion équipe' : 'Connexion sécurisée'}
            </h1>
            <p className="mt-1 text-[12px] text-text-secondary sm:mt-1.5 sm:text-[13px]">
              {isStaff
                ? 'Accès réservé aux comptes admin/commando.'
                : 'Accédez à votre portail Infinite Core en quelques secondes.'}
            </p>
            {!isStaff ? (
              <p className="mt-0.5 text-[12px] text-text-secondary sm:mt-1 sm:text-[13px]">
                Pas de compte ?{' '}
                <Link to="/signup" className="font-medium text-noya-blue hover:text-luxe-champagne-bright">
                  Créer un compte
                </Link>
              </p>
            ) : null}
            {referralCode && !isStaff ? (
              <p className="mt-1 text-[10px] text-luxe-champagne/90 sm:mt-1.5 sm:text-[11px]">
                Parrainage actif : {referrerName || referralCode}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                loginStep === 1 ? 'bg-luxe-champagne/20 text-luxe-champagne-bright' : 'bg-white/5 text-text-muted'
              }`}
            >
              Etape 1
            </span>
            <span className="text-[10px] text-text-dim" aria-hidden>
              {'→'}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                loginStep === 2 ? 'bg-luxe-champagne/20 text-luxe-champagne-bright' : 'bg-white/5 text-text-muted'
              }`}
            >
              Etape 2
            </span>
            <span className="text-[10px] text-text-dim" aria-hidden>
              {'→'}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                loginStep === 3 ? 'bg-luxe-champagne/20 text-luxe-champagne-bright' : 'bg-white/5 text-text-muted'
              }`}
            >
              Etape 3
            </span>
          </div>

          <p className="mt-2 text-center text-[9px] uppercase tracking-[0.14em] text-text-muted sm:mt-2.5 sm:text-[10px] sm:tracking-[0.16em]">
            {loginStep === 1
              ? "Verification de l'email"
              : loginStep === 2
                ? 'Saisie du mot de passe'
                : 'Validation du code email'}
          </p>

          <form className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || loginStep !== 1}
                  className="block w-full rounded-xl border border-white/10 bg-surface-primary py-1.5 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-noya-blue focus:outline-none focus:ring-2 focus:ring-noya-blue/20 sm:py-2 sm:pl-10 sm:text-sm"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            {loginStep === 2 ? (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                  Mot de passe
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-surface-primary py-1.5 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-noya-blue focus:outline-none focus:ring-2 focus:ring-noya-blue/20 sm:py-2 sm:pl-10 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep(1);
                      setPassword('');
                      setLoginChallengeId('');
                      setVerificationCode('');
                      setVerificationMethod(null);
                    }}
                    disabled={loading}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary disabled:opacity-60"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={loading || resettingPassword}
                    className="text-[11px] font-medium text-noya-blue transition-colors hover:text-luxe-champagne-bright disabled:opacity-60"
                  >
                    {resettingPassword ? 'Préparation…' : 'Mot de passe oublié ?'}
                  </button>
                </div>
              </div>
            ) : null}

            {loginStep === 3 ? (
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-text-secondary">
                  Code de vérification (6 chiffres)
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
                  <input
                    id="verificationCode"
                    name="verificationCode"
                    inputMode="numeric"
                    pattern="\d{6}"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="block w-full rounded-xl border border-white/10 bg-surface-primary py-1.5 pl-9 pr-3 text-[13px] tracking-[0.24em] text-text-primary placeholder:text-text-muted focus:border-noya-blue focus:outline-none focus:ring-2 focus:ring-noya-blue/20 sm:py-2 sm:pl-10 sm:text-sm"
                    placeholder="000000"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep(2);
                      setVerificationCode('');
                      setVerificationMethod(null);
                    }}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary disabled:opacity-60"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour
                  </button>
                  <span className="text-[11px] text-text-muted">Code envoyé à {email}</span>
                  {verificationMethod === 'password' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!password.trim()) {
                          toast.error('Mot de passe requis pour renvoyer le code.');
                          return;
                        }
                        setLoading(true);
                        try {
                          const result = await signInWithEmailAndPassword(auth, email.trim(), password);
                          if ('verificationRequired' in result && result.verificationRequired && result.challengeId) {
                            setLoginChallengeId(result.challengeId);
                            setVerificationCode('');
                            toast.success('Nouveau code envoyé par email.');
                            return;
                          }
                          toast.error("Impossible de renvoyer le code pour le moment.");
                        } catch (error) {
                          const msg = error instanceof Error ? error.message : 'Impossible de renvoyer le code.';
                          toast.error(msg);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="text-[11px] font-medium text-noya-blue transition-colors hover:text-luxe-champagne-bright disabled:opacity-60"
                    >
                      Renvoyer le code
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleGoogle()}
                      disabled={loading}
                      className="text-[11px] font-medium text-noya-blue transition-colors hover:text-luxe-champagne-bright disabled:opacity-60"
                    >
                      Relancer Google
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCloseForm}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-surface-secondary px-4 py-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:opacity-60 sm:py-2 sm:text-sm"
              >
                Fermer le formulaire
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-noya-orange px-4 py-1.5 text-[13px] font-bold text-[#0b0f19] transition-colors hover:brightness-105 disabled:opacity-60 sm:py-2 sm:text-sm"
              >
                {loading ? 'Connexion…' : loginStep === 1 ? 'Continuer' : loginStep === 2 ? 'Recevoir mon code' : 'Valider le code'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center">
              <Link to="/reset-password" className="text-[10px] text-text-muted transition-colors hover:text-text-primary sm:text-[11px]">
                Réinitialiser via token
              </Link>
            </div>
          </form>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-[#080d17]/82 p-2 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:rounded-2xl sm:p-2.5"
        >
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-surface-secondary px-4 py-1.5 text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-tertiary disabled:opacity-60 sm:py-2 sm:text-sm"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            Continuer avec Google
          </button>
          {isStaff ? (
            <p className="mt-2 text-center text-[11px] text-text-muted">
              Accès Google réservé aux comptes équipe autorisés.
            </p>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
