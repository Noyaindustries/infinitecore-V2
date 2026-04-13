import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Pricing() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  const faqData = [
    { q: "C'est quoi Infinite Core ?", a: "C'est la suite logicielle tout-en-un de Noya Industries pour gérer votre PME : clients, finances, équipes, projets. Conçu pour la réalité des entreprises africaines." },
    { q: "Quelle est la différence entre Infinite Core et PADDE-CI ?", a: "PADDE-CI c'est notre service d'audit et de conseil digital (site web, réseaux sociaux, stratégie). Infinite Core c'est notre logiciel de gestion interne. Les deux sont accessibles depuis le même espace client." },
    { q: "Peut-on commencer avec 1 seul module ?", a: "Oui. Vous choisissez le module dont vous avez besoin maintenant. Vous ajoutez les autres quand vous êtes prêt." },
    { q: "Est-ce qu'il faut des compétences techniques ?", a: "Non. La plateforme est conçue pour des dirigeants et des équipes sans formation technique. Une séance de formation est incluse." }
  ];

  return (
    <div className="bg-[#0A0A0F] min-h-screen pt-24 pb-24 font-sans text-gray-300">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16">
          <p className="text-[#10B981] font-bold tracking-widest text-sm mb-4 uppercase inline-block border-b border-[#10B981]/30 pb-2">Investissement</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">Le plan qu'il vous faut.</h1>
          <p className="text-xl text-[#9CA3AF] max-w-2xl mx-auto">
            Créez votre compte gratuitement, commandez depuis votre espace interactif. On s'occupe du reste.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {/* Pack Découverte */}
          <div className="bg-[#1E1E2E] border border-[#2d2d3d] p-8 rounded-2xl flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Pack Découverte</h3>
            <p className="text-[#9CA3AF] text-sm mb-6 pb-6 border-b border-[#2d2d3d]">Pour structurer un besoin précis ou démarrer la digitalisation.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> 1 solution configurée</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> Formation incluse</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> Support par email</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> Mises à jour incluses</li>
            </ul>
            <Link to="/signup" className="block w-full text-center bg-[#25253A] hover:bg-[#2d2d3d] text-white font-semibold py-3 rounded-xl transition-colors border border-[#2d2d3d]">
              Démarrer
            </Link>
          </div>

          {/* Pack Croissance */}
          <div className="bg-gradient-to-b from-[#1a1c33] to-[#1E1E2E] border border-[#6366F1]/50 p-8 rounded-2xl flex flex-col relative transform md:-translate-y-4 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6366F1] text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Le plus populaire</div>
            <h3 className="text-2xl font-bold text-white mb-2">Pack Croissance</h3>
            <p className="text-[#6366F1] text-sm mb-6 pb-6 border-b border-[#2d2d3d]">Pour numériser logiquement votre flux critique et booster vos ventes.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-white"><ShieldCheck size={18} className="text-[#10B981]" /> 3 solutions connectées</li>
              <li className="flex items-center gap-3 text-sm text-white"><ShieldCheck size={18} className="text-[#10B981]" /> Onboarding dédié</li>
              <li className="flex items-center gap-3 text-sm text-white"><ShieldCheck size={18} className="text-[#10B981]" /> Support WhatsApp prioritaire</li>
              <li className="flex items-center gap-3 text-sm text-white"><ShieldCheck size={18} className="text-[#10B981]" /> Portail client complet</li>
            </ul>
            <Link to="/signup" className="block w-full text-center bg-[#6366F1] hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              Démarrer la transition
            </Link>
          </div>

          {/* Pack Elite */}
          <div className="bg-[#1E1E2E] border border-[#2d2d3d] p-8 rounded-2xl flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Pack Elite</h3>
            <p className="text-[#9CA3AF] text-sm mb-6 pb-6 border-b border-[#2d2d3d]">L'OS complet pour votre entreprise, transformation totale garantie.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> 7 solutions Infinite Core</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> Personnalisation avancée</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> Chef de projet dédié</li>
              <li className="flex items-center gap-3 text-sm text-gray-300"><ShieldCheck size={18} className="text-[#6366F1]" /> SLA garanti & prioritaire</li>
            </ul>
            <Link to="/signup" className="block w-full text-center bg-[#25253A] hover:bg-[#2d2d3d] text-white font-semibold py-3 rounded-xl transition-colors border border-[#2d2d3d]">
              Nous contacter
            </Link>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto pt-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Questions Fréquentes</h2>
          </div>
          <div className="space-y-3">
            {faqData.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="bg-[#1E1E2E] border border-[#2d2d3d] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left transition-colors"
                  >
                    <span className="font-semibold text-white pr-8">{faq.q}</span>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center bg-[#2d2d3d] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown size={16} className="text-[#9CA3AF]" />
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 pt-0 text-[#9CA3AF] text-sm leading-relaxed border-t border-[#2d2d3d] mt-2">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
