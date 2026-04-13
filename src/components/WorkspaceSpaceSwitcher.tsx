import { Link, useLocation } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './FirebaseProvider';
import {
  detectWorkspaceFromPath,
  getAccessibleWorkspaces,
  isMarketingPublicZone,
} from '../lib/workspaceSpaces';

type SwitcherVariant = 'noya-dark' | 'surface';

const variantStyles: Record<
  SwitcherVariant,
  { wrap: string; title: string; link: string; linkActive: string; icon: string }
> = {
  'noya-dark': {
    wrap: 'border-t border-white/10 pt-4 mt-2',
    title: 'text-[10px] font-black uppercase tracking-widest text-[#5E6E84]',
    link: 'flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#8E9EAE] transition-colors hover:bg-white/5 hover:text-[#F5F7FF]',
    linkActive: 'bg-white/[0.06] text-[#F5F7FF] border border-white/10',
    icon: 'text-[#6EA7EA]',
  },
  surface: {
    wrap: 'border-t border-border-subtle pt-4 mt-2',
    title: 'text-[10px] font-black uppercase tracking-widest text-text-muted',
    link: 'flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary',
    linkActive: 'bg-noya-orange/10 text-noya-orange border border-noya-orange/20',
    icon: 'text-noya-orange',
  },
};

interface WorkspaceSpaceSwitcherProps {
  variant: SwitcherVariant;
  className?: string;
  onNavigate?: () => void;
}

/**
 * Bloc « Tous les espaces » : liens vers chaque espace autorisé pour le rôle connecté.
 */
export default function WorkspaceSpaceSwitcher({ variant, className, onNavigate }: WorkspaceSpaceSwitcherProps) {
  const { userData } = useAuth();
  const location = useLocation();
  const spaces = getAccessibleWorkspaces(userData?.role);
  const styles = variantStyles[variant];
  const current = detectWorkspaceFromPath(location.pathname);

  if (spaces.length === 0) {
    return null;
  }

  return (
    <div className={cn(styles.wrap, className)}>
      <p className={cn('mb-2 px-1 flex items-center gap-2', styles.title)}>
        <Layers size={12} className={styles.icon} aria-hidden />
        Tous les espaces
      </p>
      <div className="space-y-0.5">
        {spaces.map((space) => {
          const wid = space.id;
          const active =
            wid === 'marketing'
              ? isMarketingPublicZone(location.pathname)
              : current === wid;
          return (
            <Link
              key={space.id}
              to={space.to}
              onClick={onNavigate}
              className={cn(styles.link, active && styles.linkActive)}
            >
              <span className="truncate">{space.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
