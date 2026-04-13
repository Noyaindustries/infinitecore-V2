import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('ic_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('ic_consent', 'all');
    // Here you would initialize GA4 and Clarity
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('ic_consent', 'essential');
    // Here you would ensure GA4/Clarity are NOT initialized
    setIsVisible(false);
  };

  if (!isVisible && !showDetails) return null;

  return (
    <AnimatePresence>
      {isVisible && !showDetails && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Nous respectons votre vie privée</h3>
              <p className="text-gray-600 text-sm">
                Nous utilisons des cookies essentiels pour faire fonctionner notre site. Avec votre consentement, nous utilisons également des cookies analytiques pour améliorer votre expérience. Vous pouvez modifier vos préférences à tout moment.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={() => setShowDetails(true)}
                className="px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                Gérer les préférences
              </button>
              <button
                onClick={handleAcceptEssential}
                className="px-6 py-3 text-sm font-medium text-[#1E3A5F] border-2 border-[#1E3A5F] hover:bg-gray-50 rounded-xl transition-colors"
              >
                Essentiels uniquement
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-6 py-3 text-sm font-bold text-white bg-[#F27D26] hover:bg-[#d96b1c] rounded-xl transition-colors shadow-lg"
              >
                Tout accepter
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900">Préférences des cookies</h2>
              <button 
                onClick={() => {
                  setShowDetails(false);
                  if (!localStorage.getItem('ic_consent')) setIsVisible(true);
                }}
                className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-200 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="p-5 border border-gray-200 rounded-2xl bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">Cookies essentiels</h3>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                    <Check size={14} /> Toujours actifs
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Ces cookies sont nécessaires au fonctionnement du site Web et ne peuvent pas être désactivés dans nos systèmes. Ils ne stockent aucune information d'identification personnelle.
                </p>
              </div>

              <div className="p-5 border border-gray-200 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">Cookies analytiques</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F27D26]"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-600">
                  Ces cookies nous permettent de déterminer le nombre de visites et les sources du trafic, afin de mesurer et d'améliorer les performances de notre site Web.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
              <button
                onClick={handleAcceptEssential}
                className="px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Essentiels uniquement
              </button>
              <button
                onClick={() => {
                  handleAcceptAll();
                  setShowDetails(false);
                }}
                className="px-6 py-3 text-sm font-bold text-white bg-[#1E3A5F] hover:bg-[#152a45] rounded-xl transition-colors shadow-lg"
              >
                Enregistrer mes choix
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
