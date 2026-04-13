import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: "C'est quoi Infinite Core ?",
    answer: "C'est la suite logicielle tout-en-un de Noya Industries pour gérer votre PME : clients, finances, équipes, projets. Conçu pour la réalité des entreprises africaines."
  },
  {
    question: "Quelle est la différence entre Infinite Core et PADDE-CI ?",
    answer: "PADDE-CI c'est notre service d'audit et de conseil digital (site web, réseaux sociaux, stratégie). Infinite Core c'est notre logiciel de gestion interne. Les deux sont accessibles depuis le même espace client."
  },
  {
    question: "Peut-on commencer avec 1 seul module ?",
    answer: "Oui. Vous choisissez le module dont vous avez besoin maintenant. Vous ajoutez les autres quand vous êtes prêt."
  },
  {
    question: "Est-ce qu'il faut des compétences techniques pour utiliser la plateforme ?",
    answer: "Non. La plateforme est conçue pour des dirigeants et des équipes sans formation technique. Une séance de formation est incluse dans chaque module."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-[#0A0A0F] py-24 min-h-screen text-gray-300 font-sans">
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[#6366F1] font-bold tracking-widest text-sm mb-4 uppercase inline-block border-b border-[#6366F1]/30 pb-2">Besoin d'aide ?</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Questions Fréquentes
          </h1>
          <p className="text-xl text-[#9CA3AF]">
            Tout ce que vous voulez savoir sur nos services Infinite Core et PADDE-CI.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="border border-[#1F2937] hover:border-[#6366F1]/50 bg-[#111116] rounded-2xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-[#1E1E2E] transition-colors"
              >
                <span className="font-bold text-lg text-white">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="text-[#6366F1] shrink-0" />
                ) : (
                  <ChevronDown className="text-[#4B5563] shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="p-6 pt-0 text-[#9CA3AF] leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-20 p-8 bg-[#161622] rounded-3xl text-center border border-[#2d2d3d] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <h3 className="text-xl font-bold mb-4 text-white">D'autres questions ?</h3>
          <p className="text-[#9CA3AF] mb-8">
            Notre équipe est disponible sur WhatsApp pour vous répondre en moins de 24h.
          </p>
          <a
            href="https://wa.me/2250103015467"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1FA855] transition-all shadow-lg"
          >
            Discuter sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
