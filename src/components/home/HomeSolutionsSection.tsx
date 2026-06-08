import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Users,
  Wallet,
  FileSignature,
  Briefcase,
  GraduationCap,
  ShoppingCart,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import HomeSectionLabel from './HomeSectionLabel';
import { homeContainerVariants, homeItemVariants } from './homeMotion';

type Accent = 'gold' | 'blue';

type ModuleCard = {
  id: string;
  title: string;
  desc: string;
  link: string;
  Icon: LucideIcon;
  accent: Accent;
  col: string;
};

const CRM_PIPELINE = [
  { cat: 'PROSPECT', name: 'Ets Koffi', amt: '1.2M FCFA', status: 'Chaud', tone: 'home-pipeline-warm' },
  { cat: 'DEVIS', name: 'Sté Coulibaly', amt: '2.4M FCFA', status: 'En cours', tone: 'home-pipeline-blue' },
  { cat: 'GAGNÉ', name: 'SARL Diomandé', amt: '4.1M FCFA', status: 'Signé', tone: 'home-pipeline-green' },
  { cat: 'FACTURÉ', name: 'Groupe Ouattara', amt: '6.8M FCFA', status: 'Payé', tone: 'home-pipeline-green' },
] as const;

const FINANCE_BARS = [30, 45, 35, 60, 85, 100];

const MODULES: ModuleCard[] = [
  {
    id: 'rh',
    title: 'Infinite RH',
    desc: 'Fiches employés, paie CNPS, congés et contrats selon le Code du Travail ivoirien.',
    link: '/rh',
    Icon: FileSignature,
    accent: 'gold',
    col: 'md:col-span-6 lg:col-span-4',
  },
  {
    id: 'projects',
    title: 'Infinite Projects',
    desc: 'Kanban, assignation de tâches, deadlines et rapports de livraison automatiques.',
    link: '/projects',
    Icon: Briefcase,
    accent: 'gold',
    col: 'md:col-span-6 lg:col-span-4',
  },
  {
    id: 'academy',
    title: 'Infinite Academy',
    desc: 'Formations internes, quiz, certifications et bibliothèque de ressources d\'entreprise.',
    link: '/academy',
    Icon: GraduationCap,
    accent: 'gold',
    col: 'md:col-span-6 lg:col-span-4',
  },
  {
    id: 'store',
    title: 'Infinite Store',
    desc: 'Boutique connectée à votre CRM, vos stocks et Wave/Orange Money nativement.',
    link: '/store',
    Icon: ShoppingCart,
    accent: 'gold',
    col: 'md:col-span-6 lg:col-span-6',
  },
  {
    id: 'comms',
    title: 'Infinite Comms',
    desc: 'Messagerie sécurisée par projet, client ou département — intégrée, archivée et contrôlée.',
    link: '/comms',
    Icon: MessageSquare,
    accent: 'blue',
    col: 'md:col-span-6 lg:col-span-6',
  },
];

function ModuleLink({ to, accent }: { to: string; accent: Accent }) {
  return (
    <Link
      to={to}
      className={`home-module-link ${accent === 'blue' ? 'home-module-link--blue' : 'home-module-link--gold'}`}
    >
      Découvrir le module
      <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function ModuleIcon({ Icon, accent }: { Icon: LucideIcon; accent: Accent }) {
  return (
    <div className={`home-module-icon ${accent === 'blue' ? 'home-module-icon--blue' : 'home-module-icon--gold'}`}>
      <Icon className="h-6 w-6 text-text-primary" aria-hidden />
    </div>
  );
}

export default function HomeSolutionsSection() {
  return (
    <section id="solutions" className="home-solutions-section relative z-10 py-16 md:py-24">
      <div className="container mx-auto max-w-[1200px] px-6">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <HomeSectionLabel accent="blue">Solutions</HomeSectionLabel>
            <h2 className="home-section-title flex flex-col gap-2 md:gap-3">
              <span>Un système. Sept modules.</span>
              <span className="home-text-gradient-gold">Zéro friction.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
              Commencez avec ce dont vous avez besoin. Activez les autres modules en un clic — sans perdre de données, sans changer d&apos;outil.
            </p>
          </div>
          <Link to="/signup" className="home-btn-primary hidden md:inline-flex">
            Créer mon compte
          </Link>
        </div>

        <motion.div
          variants={homeContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 gap-5 md:grid-cols-12"
        >
          {/* CRM — carte vedette */}
          <motion.article
            variants={homeItemVariants}
            className="home-module-card home-module-card--gold md:col-span-12 lg:col-span-8"
          >
            <div className="home-module-card-glow home-module-card-glow--gold" aria-hidden />
            <div className="relative z-10 flex flex-col justify-between">
              <div>
                <ModuleIcon Icon={Users} accent="gold" />
                <h3 className="home-module-title">Infinite CRM</h3>
                <p className="home-module-desc max-w-lg">
                  Pipeline visuel, devis en 30 secondes, facturation automatique et signature électronique OHADA. Transformez vos prospects en clients fidèles.
                </p>
                <ModuleLink to="/infinite-crm" accent="gold" />
              </div>
              <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {CRM_PIPELINE.map((item) => (
                  <div key={item.cat} className="home-pipeline-tile">
                    <p className="home-pipeline-cat">{item.cat}</p>
                    <p className="home-pipeline-name">{item.name}</p>
                    <p className="home-pipeline-amt">{item.amt}</p>
                    <span className={`home-pipeline-badge ${item.tone}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.article>

          {/* Finance */}
          <motion.article
            variants={homeItemVariants}
            className="home-module-card home-module-card--blue md:col-span-12 lg:col-span-4"
          >
            <div className="home-module-card-glow home-module-card-glow--blue" aria-hidden />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <ModuleIcon Icon={Wallet} accent="blue" />
                <h3 className="home-module-title">Infinite Finance</h3>
                <p className="home-module-desc">
                  Trésorerie en temps réel. Relances automatiques. Rapports P&amp;L sans comptable.
                </p>
                <ModuleLink to="/infinite-finance" accent="blue" />
              </div>
              <div className="home-finance-chart mt-10 flex h-20 items-end gap-2 px-1">
                {FINANCE_BARS.map((h, i) => (
                  <div
                    key={i}
                    className="home-finance-bar flex-1"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </motion.article>

          {/* Autres modules */}
          {MODULES.map((m) => (
            <motion.article
              key={m.id}
              variants={homeItemVariants}
              className={`home-module-card home-module-card--${m.accent} flex flex-col justify-between ${m.col}`}
            >
              <div className={`home-module-card-glow home-module-card-glow--${m.accent}`} aria-hidden />
              <div className="relative z-10 flex flex-1 flex-col">
                <ModuleIcon Icon={m.Icon} accent={m.accent} />
                <h3 className="home-module-title text-xl">{m.title}</h3>
                <p className="home-module-desc mb-8 flex-1">{m.desc}</p>
                <ModuleLink to={m.link} accent={m.accent} />
              </div>
            </motion.article>
          ))}
        </motion.div>

        <div className="mt-10 flex justify-center md:hidden">
          <Link to="/signup" className="home-btn-primary w-full max-w-sm justify-center">
            Créer mon compte
          </Link>
        </div>
      </div>
    </section>
  );
}
