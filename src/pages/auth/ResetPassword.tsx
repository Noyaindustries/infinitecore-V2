import React, { useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Lock, ArrowRight } from "lucide-react";
import { auth } from "../../firebase";
import { confirmPasswordReset } from "firebase/auth";
import toast from "react-hot-toast";

function passwordMeetsPolicy(password: string) {
  if (password.length < 12) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const initialToken = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !token.trim()) {
      toast.error("Email et token sont requis.");
      return;
    }
    if (!passwordMeetsPolicy(newPassword)) {
      toast.error("Mot de passe faible (12+ caractères, majuscule, minuscule, chiffre, symbole).");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, email.trim(), token.trim(), newPassword);
      toast.success("Mot de passe réinitialisé. Vous pouvez vous connecter.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Token invalide, expiré, ou paramètres incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-66px)] flex-col justify-center py-8 px-4 sm:min-h-[calc(100dvh-70px)] sm:px-6 md:min-h-[calc(100dvh-78px)] lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-white">Réinitialiser le mot de passe</h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Entrez l’e-mail, le token reçu et votre nouveau mot de passe.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-200">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-noya-accent focus:border-transparent"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="reset-token" className="block text-sm font-medium text-gray-200">
              Token de réinitialisation
            </label>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                id="reset-token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="block w-full pl-9 pr-3 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:ring-2 focus:ring-noya-accent focus:border-transparent"
                placeholder="Collez le token"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-gray-200">
              Nouveau mot de passe
            </label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                id="reset-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full pl-9 pr-3 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:ring-2 focus:ring-noya-accent focus:border-transparent"
                placeholder="12+ caractères, fort"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-gray-200">
              Confirmer le mot de passe
            </label>
            <input
              id="reset-password-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-noya-accent focus:border-transparent"
              placeholder="Répétez le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-noya-accent hover:bg-[#e06b15] disabled:opacity-60 transition-colors"
          >
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-500">
          Déjà prêt ?{" "}
          <Link to="/login" className="font-medium text-noya-accent hover:text-[#e06b15]">
            Retour à la connexion
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
