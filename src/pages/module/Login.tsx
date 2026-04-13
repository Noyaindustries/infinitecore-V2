import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, ArrowLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';

export default function ModuleLogin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ownedModules } = useStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const module = ownedModules.find(m => m.moduleId === id);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (module && username === module.username && password === module.password) {
      toast.success(`Connexion réussie à ${module.name}`);
      navigate(`/module/${id}/dashboard`);
    } else {
      toast.error('Identifiants incorrects');
    }
  };

  if (!module) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Module non trouvé ou non activé</h1>
        <Link to="/dashboard" className="text-[#F27D26] hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Retour à l'espace client
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-96 bg-[#1E3A5F] -skew-y-6 transform origin-top-left -translate-y-20"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-8">
            <ArrowLeft size={20} /> Retour au portail
          </Link>
          <h2 className="text-3xl font-extrabold text-white">
            Connexion au Module
          </h2>
          <p className="mt-2 text-lg text-white/80">
            {module.name}
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-gray-100"
        >
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Identifiant secret
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-[#F27D26] focus:border-[#F27D26] sm:text-sm transition-colors"
                  placeholder="admin_module_123"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-[#F27D26] focus:border-[#F27D26] sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#F27D26] hover:bg-[#e06b15] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F27D26] transition-colors"
              >
                Se connecter au système
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
