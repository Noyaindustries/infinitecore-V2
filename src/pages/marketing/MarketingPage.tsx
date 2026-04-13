import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, Wallet, Briefcase, GraduationCap, MessageSquare, ShoppingBag, 
  CheckCircle2, ArrowRight, Zap, Settings2, ShieldCheck, LayoutDashboard,
  Clock, FileText, BarChart3, Share2, Smartphone, Database, Check
} from 'lucide-react';
import { useState } from 'react';

interface ModuleData {
  id: string;
  title: string;
  subtitle: string;
  problem: string;
  features: {
    title: string;
    description: string;
    icon: any;
  }[];
  connections: string[];
  accentColor: string;
  icon: any;
  customizationOptions: string[];
}

const modules: Record<string, ModuleData> = {
  'infinite-crm': {
    id: 'infinite-crm',
    title: "Chaque client. Chaque relation.",
    subtitle: "Transformez vos prospects en clients fidèles avec un CRM conçu pour l'Afrique.",
    problem: "Vos opportunités commerciales dorment dans des échanges WhatsApp et des fichiers Excel éparpillés. Quand un client rappelle, vous cherchez l'historique. Quand un devis n'est pas suivi, le contrat part ailleurs.",
    features: [
      {
        title: "Pipeline visuel",
        description: "Chaque prospect a un statut clair, vous voyez d'un coup d'oeil où en est chaque deal.",
        icon: LayoutDashboard
      },
      {
        title: "Devis en 30 secondes",
        description: "Généré depuis la fiche client, prêt à envoyer sur WhatsApp.",
        icon: Clock
      },
      {
        title: "Facturation automatique",
        description: "La facture est créée dès que le devis est accepté.",
        icon: FileText
      },
      {
        title: "Signature électronique OHADA",
        description: "Valeur légale, signée en ligne, archivée automatiquement.",
        icon: ShieldCheck
      }
    ],
    connections: ["Finance (factures auto)", "RH (contacts équipe)", "Projects (suivi mission)"],
    accentColor: "#F97316", // text-orange-500
    icon: Users,
    customizationOptions: [
      "Étapes du pipeline personnalisées",
      "Modèles de devis à votre image",
      "Champs personnalisés par client",
      "Automatisations de relances"
    ]
  },
  'infinite-finance': {
    id: 'infinite-finance',
    title: "Vos finances. En temps réel.",
    subtitle: "Trésorerie, facturation et rapports financiers — accessibles en 2 clics.",
    problem: "Vous attendez votre comptable pour savoir combien vous avez en caisse. Vos factures impayées s'accumulent sans relance automatique. Vous ne savez jamais vraiment si votre entreprise est rentable ce mois-ci.",
    features: [
      {
        title: "Tableau de bord cash",
        description: "Solde en temps réel, entrées et sorties du jour.",
        icon: BarChart3
      },
      {
        title: "Factures et relances",
        description: "Création en 1 minute, relance automatique à J+7 et J+30.",
        icon: Clock
      },
      {
        title: "Rapports automatiques",
        description: "P&L mensuel généré sans intervention comptable.",
        icon: FileText
      },
      {
        title: "Export comptable",
        description: "Format compatible avec votre expert-comptable.",
        icon: Share2
      }
    ],
    connections: ["CRM (factures depuis devis)", "RH (salaires -> dépenses)", "Store (ventes -> CA)"],
    accentColor: "#EAB308", // text-yellow-500
    icon: Wallet,
    customizationOptions: [
      "Catégories de dépenses sur mesure",
      "Seuils d'alerte de trésorerie",
      "Fréquence des rapports",
      "Multi-devises"
    ]
  },
  'rh': {
    id: 'rh',
    title: "Vos équipes structurées.",
    subtitle: "Employés, paie, congés et contrats selon le droit ivoirien.",
    problem: "Vos congés sont gérés sur un cahier. Vos contrats sont dans un tiroir. Vous calculez les salaires à la main chaque fin de mois. Une inspection du travail aujourd'hui vous mettrait en difficulté.",
    features: [
      {
        title: "Fiches employés",
        description: "Informations complètes, documents, historique dans un seul endroit.",
        icon: Users
      },
      {
        title: "Gestion des congés",
        description: "Demande en ligne, validation, solde mis à jour automatiquement.",
        icon: CheckCircle2
      },
      {
        title: "Calcul de paie CNPS",
        description: "Cotisations sociales calculées selon le barème ivoirien en vigueur.",
        icon: FileText
      },
      {
        title: "Contrats de travail",
        description: "Modèles conformes au Code du Travail ivoirien, générés en 2 minutes.",
        icon: ShieldCheck
      }
    ],
    connections: ["Finance (salaires -> dépenses)", "Academy (formations employés)", "Comms (équipe)"],
    accentColor: "#10B981", // emerald-500
    icon: Briefcase,
    customizationOptions: [
      "Types de congés personnalisés",
      "Structure de primes et bonus",
      "Workflows de validation",
      "Organigramme dynamique"
    ]
  },
  'projects': {
    id: 'projects',
    title: "Vos missions livrées à temps.",
    subtitle: "Chaque projet, chaque tâche, chaque deadline en un seul espace.",
    problem: "Vos projets sont coordonnés par messages WhatsApp. Personne ne sait qui fait quoi ni pour quand. Les deadlines glissent. Les clients relancent. Vous gérez les urgences au lieu de piloter.",
    features: [
      {
        title: "Kanban projets",
        description: "Vue visuelle par colonne À faire / En cours / Terminé.",
        icon: LayoutDashboard
      },
      {
        title: "Assignation de tâches",
        description: "Chaque tâche a un responsable, une deadline, une priorité.",
        icon: Users
      },
      {
        title: "Suivi d'avancement",
        description: "Votre client peut voir où en est son projet en temps réel.",
        icon: Clock
      },
      {
        title: "Rapports de livraison",
        description: "Générés automatiquement à la clôture du projet.",
        icon: FileText
      }
    ],
    connections: ["CRM (projets liés aux clients)", "Finance (budget mission)", "RH (assignation équipe)"],
    accentColor: "#3B82F6", // blue-500
    icon: Briefcase,
    customizationOptions: [
      "Templates de projets récurrents",
      "Priorités personnalisées",
      "Accès client restreint",
      "Time-tracking par tâche"
    ]
  },
  'academy': {
    id: 'academy',
    title: "Le savoir de votre entreprise.",
    subtitle: "Formez vos équipes, onboardez vos recrues, certifiez vos talents.",
    problem: "Chaque nouvel employé apprend sur le tas. Votre savoir-faire est dans les têtes, pas dans un système. Si votre meilleur élément part demain, il emporte tout avec lui.",
    features: [
      {
        title: "Modules de formation",
        description: "Créez vos propres contenus vidéo, texte ou PDF.",
        icon: GraduationCap
      },
      {
        title: "Quiz et certifications",
        description: "Validez la maîtrise des compétences avec des évaluations simples.",
        icon: CheckCircle2
      },
      {
        title: "Suivi de progression",
        description: "Voyez qui a complété quoi et qui est en retard.",
        icon: BarChart3
      },
      {
        title: "Bibliothèque de ressources",
        description: "Procédures, guides, templates accessibles à toute l'équipe.",
        icon: Database
      }
    ],
    connections: ["RH (formations liées aux fiches employés)", "Comms (partage de ressources)"],
    accentColor: "#818CF8", // indigo-400
    icon: GraduationCap,
    customizationOptions: [
      "Parcours d'onboarding sur mesure",
      "Certificats personnalisés",
      "Groupes de formation",
      "Évaluations par les pairs"
    ]
  },
  'comms': {
    id: 'comms',
    title: "La communication sécurisée.",
    subtitle: "Remplacez WhatsApp par une messagerie professionnelle intégrée à vos dossiers.",
    problem: "Vos décisions d'entreprise se prennent dans des groupes WhatsApp mélangés avec des conversations personnelles. Les fichiers importants se perdent. Les nouveaux collaborateurs n'ont pas accès à l'historique.",
    features: [
      {
        title: "Messagerie équipe",
        description: "Canaux par département, par projet, par client — séparés et sécurisés.",
        icon: MessageSquare
      },
      {
        title: "Canaux par projet",
        description: "La conversation liée au projet reste avec le projet.",
        icon: Briefcase
      },
      {
        title: "Fichiers partagés",
        description: "Envoyez et retrouvez n'importe quel document en quelques secondes.",
        icon: FileText
      },
      {
        title: "Historique complet",
        description: "Tout est archivé, consultable, jamais perdu.",
        icon: Database
      }
    ],
    connections: ["Tous les modules — Comms est le fil de communication transversal"],
    accentColor: "#A855F7", // purple-500
    icon: MessageSquare,
    customizationOptions: [
      "Canaux privés illimités",
      "Rôles et permissions d'accès",
      "Intégrations notifications",
      "Archivage intelligent"
    ]
  },
  'store': {
    id: 'store',
    title: "Votre boutique connectée.",
    subtitle: "Vendez en ligne relié à votre CRM, vos stocks et vos finances.",
    problem: "Vos clients doivent vous appeler ou vous envoyer un message pour commander. Vous gérez vos stocks manuellement. Vos ventes ne sont pas automatiquement enregistrées dans vos finances.",
    features: [
      {
        title: "Catalogue produits",
        description: "Créez votre boutique en ligne en quelques heures, sans développeur.",
        icon: ShoppingBag
      },
      {
        title: "Commandes en ligne",
        description: "Votre client commande, vous êtes notifié sur WhatsApp.",
        icon: Smartphone
      },
      {
        title: "Suivi des livraisons",
        description: "Statut mis à jour en temps réel, client informé automatiquement.",
        icon: Clock
      },
      {
        title: "Paiement mobile money",
        description: "Wave et Orange Money intégrés nativement.",
        icon: Wallet
      }
    ],
    connections: ["CRM (clients -> commandes)", "Finance (ventes -> CA)", "Projects (livraisons -> tâches)"],
    accentColor: "#F43F5E", // rose-500
    icon: ShoppingBag,
    customizationOptions: [
      "Design de boutique personnalisable",
      "Gestion de variantes produits",
      "Zones de livraison sur mesure",
      "Codes promos et fidélité"
    ]
  }
};

export default function MarketingPage() {
  const location = useLocation();
  const path = location.pathname.substring(1);
  const data = modules[path];
  const [selectedCustoms, setSelectedCustoms] = useState<string[]>([]);

  if (!data) {
    return (
      <div className="container mx-auto px-6 py-24 text-center bg-[#0A0A0F] min-h-screen text-white">
        <h1 className="text-4xl font-bold mb-6">Page non trouvée</h1>
        <Link to="/" className="text-[#6366F1] hover:underline">Retour à l'accueil</Link>
      </div>
    );
  }

  const toggleCustom = (opt: string) => {
    if (selectedCustoms.includes(opt)) {
      setSelectedCustoms(selectedCustoms.filter(o => o !== opt));
    } else {
      setSelectedCustoms([...selectedCustoms, opt]);
    }
  };

  return (
    <div className="bg-[#0A0A0F] text-gray-300 min-h-screen font-sans">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden bg-[#111116] border-b border-[#1F2937]">
        <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
          <div className="w-[600px] h-[600px] rounded-full blur-[150px] opacity-20" style={{ backgroundColor: data.accentColor }}></div>
        </div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center justify-center p-4 rounded-2xl bg-[#1E1E2E] shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-[#2d2d3d] mb-8"
              style={{ color: data.accentColor }}
            >
              <data.icon size={40} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight"
            >
              {data.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-[#9CA3AF] mb-10 leading-relaxed"
            >
              {data.subtitle}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row justify-center gap-4"
            >
              <Link
                to="/signup"
                className="bg-[#6366F1] text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              >
                Commander ce module <ArrowRight size={20} />
              </Link>
              <a
                href="#personalisation"
                className="bg-transparent text-white border border-[#2d2d3d] hover:bg-[#1E1E2E] hover:border-[#1F2937] px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Personnaliser mon besoin <Settings2 size={20} />
              </a>
            </motion.div>
          </div>
        </div>
        
        {/* Mockup Placeholder */}
        <div className="container mx-auto px-6 mt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#161622] rounded-3xl border border-[#2d2d3d] overflow-hidden aspect-video relative group shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-5xl mx-auto"
          >
            <div className="bg-[#1C1C28] px-4 py-3 border-b border-[#2d2d3d] flex items-center">
               <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
               </div>
               <div className="mx-auto text-xs text-[#9CA3AF] font-mono bg-[#0A0A0F] px-4 py-1.5 rounded-lg border border-[#2d2d3d]">app.infinitecore.ci / {data.id}</div>
            </div>
            <div className="absolute inset-0 top-[50px] bg-gradient-to-br from-[#111116] to-[#0A0A0F] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1E1E2E] border border-[#2d2d3d] rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ color: data.accentColor }}>
                  <LayoutDashboard size={32} />
                </div>
                <p className="text-[#9CA3AF] font-medium text-sm">Interface module {data.id} (simulation)</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-[#0A0A0F]">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[#6366F1] font-bold tracking-widest text-sm mb-6 uppercase inline-block border-b border-[#6366F1]/30 pb-2">Le Problème</h2>
            <p className="text-2xl text-white leading-relaxed font-medium italic">
              « {data.problem} »
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-[#111116] border-y border-[#1F2937]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Ce que ça fait</h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto">Chaque fonctionnalité est pensée pour résoudre une friction spécifique.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {data.features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-[#1E1E2E] p-8 rounded-2xl border border-[#2d2d3d] hover:border-[#6366F1]/50 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0A0A0F] border border-[#2d2d3d] flex items-center justify-center mb-6 transition-colors" style={{ color: data.accentColor }}>
                  <feature.icon size={20} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-[#9CA3AF] leading-relaxed text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Customization Section */}
      <section id="personalisation" className="py-24 bg-[#0A0A0F]">
        <div className="container mx-auto px-6">
          <div className="bg-[#1E1E2E] rounded-3xl border border-[#2d2d3d] p-8 md:p-12 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] blur-[150px] opacity-10 rounded-full" style={{ backgroundColor: data.accentColor }} />
            
            <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Personnalisez votre module</h2>
                <p className="text-[#9CA3AF] text-lg mb-8 leading-relaxed">
                  Chaque entreprise est unique. Sélectionnez les options spécifiques dont vous avez besoin pour adapter ce module à votre workflow.
                </p>
                
                <div className="space-y-4">
                  {data.customizationOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => toggleCustom(opt)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        selectedCustoms.includes(opt) 
                        ? 'border-[#6366F1] bg-[#6366F1]/10 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                        : 'border-[#2d2d3d] bg-[#0A0A0F] text-[#9CA3AF] hover:border-[#1F2937]'
                      }`}
                    >
                      <span className="font-medium">{opt}</span>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                        selectedCustoms.includes(opt) ? 'bg-[#6366F1] border-[#6366F1]' : 'border-[#2d2d3d] bg-[#1E1E2E]'
                      }`}>
                        {selectedCustoms.includes(opt) && <Check size={14} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-[#0A0A0F] rounded-2xl p-8 border border-[#2d2d3d]">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                  <Zap className="text-[#10B981]" size={20} />
                  Votre configuration
                </h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm py-2 border-b border-[#2d2d3d]">
                    <span className="text-[#9CA3AF]">Module de base</span>
                    <span className="text-white font-semibold">Inclus</span>
                  </div>
                  {selectedCustoms.map((opt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between text-sm py-2 border-b border-[#2d2d3d]/50"
                    >
                      <span className="text-[#9CA3AF]">{opt}</span>
                      <span className="text-[#6366F1] font-semibold">+ Sur mesure</span>
                    </motion.div>
                  ))}
                  {selectedCustoms.length === 0 && (
                    <p className="text-sm text-[#9CA3AF] italic py-4">Sélectionnez au moins une option pour enrichir votre module.</p>
                  )}
                </div>
                
                <div className="pt-4">
                  <p className="text-xs text-[#9CA3AF] mb-6 leading-relaxed">
                    Cette configuration sera transmise à notre équipe lors de votre inscription pour un déploiement 100% sur mesure, inclus dans le Pack Croissance ou Elite.
                  </p>
                  <Link
                    to="/signup"
                    className="w-full bg-[#6366F1] hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  >
                    Valider le déploiement <ArrowRight size={20} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connections Section */}
      <section className="py-20 bg-[#111116] border-t border-[#1F2937]">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-8 text-white">Ce module se connecte nativement à :</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {data.connections.map((conn, index) => (
                <div key={index} className="bg-[#1E1E2E] px-5 py-2.5 rounded-full border border-[#2d2d3d] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.accentColor }} />
                  <span className="font-medium text-[#9CA3AF] text-sm">{conn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#0A0A0F] border-t border-[#1F2937] text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0 flex justify-center items-center">
           <div className="w-[600px] h-[300px] bg-[#6366F1]/10 rounded-full blur-[100px]"></div>
        </div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">Déployé en 5 jours.</h2>
            <p className="text-xl text-[#9CA3AF] mb-12">
              Rejoignez les entreprises qui pilotent leur croissance avec The Operating System for African Business.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#6366F1] text-white px-10 py-5 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              Créer mon compte gratuitement <ArrowRight size={20} />
            </Link>
            <div className="mt-8 flex justify-center gap-4 text-sm text-[#9CA3AF] flex-wrap">
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#10B981]"/> Gratuit au départ</span>
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#10B981]"/> Sans CB requise</span>
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#10B981]"/> Prêt en 2 min</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
