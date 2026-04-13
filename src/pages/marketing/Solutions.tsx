import { Link } from 'react-router-dom';
import { 
  Users, 
  Wallet, 
  FileSignature, 
  Briefcase, 
  GraduationCap, 
  MessageSquare, 
  ShoppingCart,
  ArrowRight
} from 'lucide-react';

export default function Solutions() {
  const modulesData = [
    { 
      id: 'crm', 
      title: 'Infinite CRM', 
      shortDesc: 'Gérez clients, devis et facturation.', 
      icon: Users, 
      fullDesc: "Centralisez toute votre relation client. Suivez vos prospects, générez des devis en quelques clics, convertissez-les en factures et suivez les paiements. Un outil complet pour booster vos ventes et fidéliser votre clientèle.",
      color: "text-orange-400"
    },
    { 
      id: 'finance', 
      title: 'Infinite Finance', 
      shortDesc: 'Trésorerie et finances en temps réel.', 
      icon: Wallet, 
      fullDesc: "Gardez un œil sur la santé financière de votre entreprise. Suivez vos entrées et sorties d'argent, catégorisez vos dépenses, et obtenez des rapports détaillés pour prendre les meilleures décisions stratégiques.",
      color: "text-yellow-400"
    },
    { 
      id: 'rh', 
      title: 'Infinite RH', 
      shortDesc: 'Employés, paie, contrats, congés.', 
      icon: FileSignature, 
      fullDesc: "Simplifiez la gestion de votre personnel. Automatisez la génération des fiches de paie, gérez les demandes de congés, stockez les contrats en toute sécurité et suivez les performances de vos collaborateurs.",
      color: "text-emerald-400"
    },
    { 
      id: 'projects', 
      title: 'Infinite Projects', 
      shortDesc: 'Missions, tâches, deadlines.', 
      icon: Briefcase, 
      fullDesc: "Pilotez vos projets de A à Z. Créez des tâches, assignez-les à vos équipes, définissez des échéances et suivez l'avancement en temps réel grâce à des tableaux Kanban intuitifs." 
    },
    { 
      id: 'academy', 
      title: 'Infinite Academy', 
      shortDesc: 'Formation et onboarding interne.', 
      icon: GraduationCap, 
      fullDesc: "Développez les compétences de vos équipes. Créez des parcours de formation sur mesure, facilitez l'intégration des nouveaux employés (onboarding) et évaluez les acquis avec des quiz interactifs.",
      color: "text-indigo-400"
    },
    { 
      id: 'comms', 
      title: 'Infinite Comms', 
      shortDesc: 'Messagerie sécurisée d\'entreprise.', 
      icon: MessageSquare, 
      fullDesc: "Communiquez efficacement et en toute sécurité. Remplacez les groupes WhatsApp par une messagerie professionnelle intégrée, créez des canaux par projet ou par équipe, et partagez des fichiers facilement.",
      color: "text-purple-400"
    },
    { 
      id: 'store', 
      title: 'Infinite Store', 
      shortDesc: 'Boutique en ligne connectée.', 
      icon: ShoppingCart, 
      fullDesc: "Vendez vos produits et services en ligne 24/7. Une vitrine e-commerce parfaitement synchronisée avec votre CRM et votre module Finance pour une gestion centralisée de vos commandes et de vos stocks.",
      color: "text-pink-400"
    },
  ];

  return (
    <div className="bg-[#0A0A0F] min-h-screen pt-24 pb-24 font-sans text-gray-300">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <p className="text-[#6366F1] font-bold tracking-widest text-sm mb-4 uppercase inline-block border-b border-[#6366F1]/30 pb-2">Les Modules</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">Toutes nos solutions.</h1>
          <p className="text-xl text-[#9CA3AF]">
            Découvrez nos modules conçus pour répondre à chaque besoin spécifique de votre entreprise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modulesData.map((mod) => (
            <div 
              key={mod.id}
              className="bg-[#1E1E2E] border border-[#2d2d3d] p-8 rounded-2xl hover:border-[#6366F1]/50 hover:bg-[#25253A] transition-all group flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-[#0A0A0F] border border-[#2d2d3d] rounded-xl flex items-center justify-center mb-6">
                <mod.icon className={`${mod.color} w-5 h-5`} />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">{mod.title}</h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed mb-6 flex-1">{mod.fullDesc}</p>
              
              <Link 
                to="/signup" 
                className="inline-flex items-center gap-2 text-[#6366F1] font-semibold hover:text-indigo-400 transition-colors mt-auto group-hover:translate-x-1 duration-300"
              >
                Commencer avec ce module <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center bg-gradient-to-b from-[#161622] to-[#0A0A0F] border border-[#2d2d3d] p-12 rounded-3xl">
          <h2 className="text-3xl font-bold mb-6 text-white">Besoin d'une solution sur mesure ?</h2>
          <p className="text-lg text-[#9CA3AF] mb-8 max-w-2xl mx-auto">
            Notre équipe peut adapter Infinite Core à vos processus spécifiques ou développer de nouveaux modules pour votre activité.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#6366F1] hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            Contactez-nous
          </Link>
        </div>
      </div>
    </div>
  );
}
