import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../components/FirebaseProvider';
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
  const { user, userData, isAuthReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!isAuthReady || !user || !userData) return;
    navigate(homePathForRole(userData.role), { replace: true });
  }, [isAuthReady, user, userData, navigate]);

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

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-white">
          {isStaff ? 'Connexion équipe' : 'Connexion'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Pas de compte ?{' '}
          <Link to="/signup" className="font-medium text-[#F27D26] hover:text-[#e06b15]">
            Créer un compte
          </Link>
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
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
