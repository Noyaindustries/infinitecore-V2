import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from '@/lib/mongoAuth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from '@/lib/mongoFirestore';
import { auth, db } from '@/lib/clientSdk';
import { useAuth } from '../../components/AuthProvider';
import { useStore } from '../../store/useStore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
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
  const addClient = useStore((s) => s.addClient);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const getPartnerLabel = (data: { firstName?: string; lastName?: string; email?: string }, fallbackId: string) => {
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    return fullName || data.email || `Partenaire ${fallbackId}`;
  };

  React.useEffect(() => {
    if (!isAuthReady || !user || !userData) return;
    navigate(homePathForRole(userData.role), { replace: true });
  }, [isAuthReady, user, userData, navigate]);

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
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Connexion réussie');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        toast.error('Email ou mot de passe incorrect.');
      } else {
        toast.error('Impossible de se connecter. Réessayez.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const emailTrim = email.trim();
      provider.setCustomParameters({
        prompt: 'select_account',
        ...(emailTrim ? { login_hint: emailTrim } : {}),
      });
      const userCredential = await signInWithPopup(auth, provider, {
        email: emailTrim || undefined,
      });
      const u = userCredential.user;
      const userDocRef = doc(db, 'users', u.uid);
      const userDoc = await getDoc(userDocRef);

      if (isStaff) {
        if (!userDoc.exists()) {
          await signOut(auth);
          toast.error('Aucun compte équipe n’est associé à cette adresse Google.');
          return;
        }
        const role = userDoc.data()?.role as string | undefined;
        if (role !== 'admin' && role !== 'commando') {
          await signOut(auth);
          toast.error('Ce compte n’a pas accès à l’espace équipe (commando ou admin uniquement).');
          return;
        }
        toast.success('Connexion réussie');
        return;
      }

      if (!userDoc.exists()) {
        const nameParts = (u.displayName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const isAdminEmail = u.email === 'superadmin@infinitecore.com';
        const companyId = `comp_${Date.now()}`;
        try {
          await setDoc(doc(db, 'companies', companyId), {
            id: companyId,
            name: `${firstName || 'Mon'}'s Company`,
            industry: 'Non spécifié',
            size: '1-5',
            pack: 'starter',
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `companies/${companyId}`);
        }
        try {
          await setDoc(userDocRef, {
            uid: u.uid,
            email: u.email || '',
            firstName,
            lastName,
            phone: u.phoneNumber || '',
            role: isAdminEmail ? 'admin' : 'client',
            companyId,
            referredBy: referralCode || null,
            referredByPartnerId: referrerId || null,
            referredByPartnerName: referrerName?.trim() || null,
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${u.uid}`);
        }
        addClient({
          name: u.displayName || u.email || 'Nouveau client',
          email: u.email || '',
          company: `${firstName || 'Mon'}'s Company`,
          pack: 'Pack Essentiel',
        });
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
      setLoading(false);
    }
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
    <div className="flex min-h-[calc(100dvh-70px)] flex-col justify-center px-3 py-6 sm:min-h-[calc(100dvh-76px)] sm:px-6 sm:py-8 md:min-h-[calc(100dvh-84px)] lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-md px-1 sm:px-0">
        <h2 className="text-center text-2xl font-extrabold text-white sm:text-3xl">
          {isStaff ? 'Connexion équipe' : 'Connexion'}
        </h2>
        {isStaff ? (
          <p className="mt-3 text-center text-sm leading-relaxed text-pretty text-gray-400">
            Accès <span className="font-semibold text-gray-200">Infinite Commando</span> (rôle commando ou admin) : après
            connexion vous êtes redirigé vers <span className="font-mono text-[#F27D26]">/admin</span> — pipeline,
            dossiers clients, messagerie, opérations, etc.
          </p>
        ) : (
          <p className="mt-2 text-center text-sm text-gray-400">
            Pas de compte ?{' '}
            <Link to="/signup" className="font-medium text-[#F27D26] hover:text-[#e06b15]">
              Créer un compte
            </Link>
          </p>
        )}
        {isStaff ? (
          <p className="mt-3 text-center text-xs text-gray-500">
            Espace client ?{' '}
            <Link to="/login" className="font-medium text-gray-300 hover:text-white">
              Connexion portail client
            </Link>
          </p>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-6 w-full min-w-0 max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:mt-8 sm:p-8"
      >
        <div className="mb-6 space-y-3">
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-[#0a0d14] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.06] disabled:opacity-60"
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
            <p className="text-center text-xs text-gray-500">
              Réservé aux comptes <span className="font-medium text-gray-400">commando</span> ou{' '}
              <span className="font-medium text-gray-400">admin</span> déjà créés dans Infinite Core.
            </p>
          ) : null}
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-white/10" />
          <span className="mx-4 shrink-0 text-sm text-gray-500">ou</span>
          <div className="flex-grow border-t border-white/10" />
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-200">
              Email
            </label>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#F27D26] focus:border-transparent"
                placeholder="vous@exemple.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-200">
              Mot de passe
            </label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#F27D26] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={loading || resettingPassword}
                className="text-xs font-medium text-[#F27D26] hover:text-[#e06b15] disabled:opacity-60"
              >
                {resettingPassword ? 'Préparation…' : 'Mot de passe oublié ?'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Vous avez déjà un token ?{" "}
              <Link to="/reset-password" className="font-medium text-[#F27D26] hover:text-[#e06b15]">
                Réinitialiser maintenant
              </Link>
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#F27D26] hover:bg-[#e06b15] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
