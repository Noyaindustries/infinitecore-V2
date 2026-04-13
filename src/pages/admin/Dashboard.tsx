import { Link } from 'react-router-dom';
import { useAuth } from '../../components/FirebaseProvider';
import {
  FolderOpen,
  KanbanSquare,
  MessageCircle,
  Users,
  Briefcase,
  Wallet,
  Copy,
} from 'lucide-react';

const shortcuts: {
  to: string;
  title: string;
  description: string;
  icon: typeof FolderOpen;
  highlight?: boolean;
}[] = [
  {
    to: '/admin/dossiers',
    title: 'Dossiers clients',
    description:
      'Déposer les documents du parcours (audit, proposition, contrat, facture) pour un client — ce n’est pas sur cette page d’accueil, mais ici.',
    icon: FolderOpen,
    highlight: true,
  },
  {
    to: '/admin/pipeline',
    title: 'Pipeline Noya',
    description: 'Kanban des missions et tâches opérationnelles.',
    icon: KanbanSquare,
  },
  {
    to: '/admin/clients',
    title: 'CRM clients',
    description: 'Fiches et suivi des comptes clients.',
    icon: Users,
  },
  {
    to: '/admin/messagerie',
    title: 'Messagerie',
    description: 'Échanges avec les clients.',
    icon: MessageCircle,
  },
  {
    to: '/admin/operations',
    title: 'Opérations',
    description: 'Vue opérationnelle consolidée.',
    icon: Briefcase,
  },
  {
    to: '/admin/finance',
    title: 'Finance',
    description: 'Indicateurs et suivi financier.',
    icon: Wallet,
  },
  {
    to: '/admin/instances',
    title: 'Clonage d’instances',
    description: 'Duplication et gestion des instances.',
    icon: Copy,
  },
];

export default function AdminDashboard() {
  const { userData } = useAuth();
  const isCommandoOnly = userData?.role === 'commando';

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-5 md:p-8">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-text-primary md:text-3xl">
          Infinite Commando
        </h1>
        <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
          <span className="rounded-full bg-noya-orange/15 px-2.5 py-1 text-noya-orange">
            {isCommandoOnly ? 'Vue Commando' : 'Vue équipe (admin ou commando)'}
          </span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary md:text-base">
          {isCommandoOnly ? (
            <>
              Vous êtes connecté avec un compte <strong className="text-text-primary">Commando</strong> : tout se passe
              sous <strong className="text-noya-orange">/admin</strong> (cette interface). Le dépôt des livrables du
              dossier client (audit → facture) se fait dans{' '}
              <strong className="text-noya-orange">Dossiers clients</strong>, pas ici — cette page liste les raccourcis.
            </>
          ) : (
            <>
              Accueil opérationnel (admin général ou commando). Le dépôt des livrables du dossier client se fait dans{' '}
              <strong className="text-noya-orange">Dossiers clients</strong> ; les admins ont aussi SuperAdmin, Dev,
              Partenaire via le menu « Tous les espaces ».
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map(({ to, title, description, icon: Icon, highlight }) => (
          <Link
            key={to}
            to={to}
            className={`group flex flex-col rounded-2xl border p-5 shadow-sm transition-all ${
              highlight
                ? 'border-noya-orange/40 bg-linear-to-br from-noya-orange/10 to-surface-secondary ring-1 ring-noya-orange/20 hover:border-noya-orange/60 hover:shadow-[0_12px_40px_-16px_rgba(255,179,50,0.25)]'
                : 'border-border-subtle bg-surface-secondary hover:border-border-medium hover:bg-surface-tertiary'
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  highlight
                    ? 'bg-noya-orange/20 text-noya-orange'
                    : 'bg-surface-primary text-text-muted group-hover:text-noya-orange'
                }`}
              >
                <Icon size={22} aria-hidden />
              </div>
              {highlight ? (
                <span className="rounded-full bg-noya-orange/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-noya-orange">
                  Dépôt fichiers
                </span>
              ) : null}
            </div>
            <h2 className="font-bold text-text-primary">{title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary">{description}</p>
            <span
              className={`mt-4 inline-flex text-xs font-bold uppercase tracking-wider ${
                highlight ? 'text-noya-orange' : 'text-text-muted group-hover:text-noya-orange'
              }`}
            >
              Ouvrir →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
