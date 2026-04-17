import { useEffect, useState, type ComponentType } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import {
  Home,
  AlertTriangle,
  Puzzle,
  LayoutDashboard,
  Quote,
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * Barre de navigation verticale « bâtons » de la page d'accueil.
 * - Positionnée à droite du viewport.
 * - **Optionnelle** : un bouton chevron permet de la réduire / rouvrir.
 *   La préférence est mémorisée dans `localStorage` (`ic_home_sidenav_open`).
 * - Un **rail vertical** derrière les bâtons affiche la progression de scroll globale.
 * - Mode **compact sur tablette** (`md` : icône + bâton) et **étendu sur desktop** (`lg+` : icône + bâton + libellé).
 * - Desktop uniquement (`md:` et plus), scrollspy via IntersectionObserver.
 */
type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;

const HOME_SECTIONS: { id: string; label: string; Icon: IconComponent }[] = [
  { id: 'accueil', label: 'Accueil', Icon: Home },
  { id: 'probleme', label: 'Le problème', Icon: AlertTriangle },
  { id: 'solutions', label: 'Solutions', Icon: Puzzle },
  { id: 'system', label: 'Infinite System', Icon: LayoutDashboard },
  { id: 'temoignages', label: 'Témoignages', Icon: Quote },
  { id: 'tarifs', label: 'Tarifs', Icon: Sparkles },
  { id: 'contact', label: 'Contact', Icon: Send },
];

const STORAGE_KEY = 'ic_home_sidenav_open';

function readInitialOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true; // Visible par défaut à la première visite.
    return raw === '1';
  } catch {
    return true;
  }
}

export default function HomeSideNavBars() {
  const [activeId, setActiveId] = useState<string>(HOME_SECTIONS[0]?.id ?? '');
  const [open, setOpen] = useState<boolean>(readInitialOpen);

  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    const nodes = HOME_SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const first = visible[0];
        if (first?.target instanceof HTMLElement && first.target.id) {
          setActiveId(first.target.id);
        }
      },
      {
        rootMargin: '-35% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* no-op : localStorage indisponible (mode privé, quota…) */
    }
  }, [open]);

  const handleJump = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  if (!open) {
    return (
      <div
        className="pointer-events-none fixed right-4 top-1/2 z-[920] hidden -translate-y-1/2 md:block lg:right-6"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Afficher la navigation verticale"
          aria-expanded="false"
          aria-controls="home-side-nav"
          title="Afficher la navigation"
          className="pointer-events-auto grid h-10 w-8 place-items-center rounded-l-xl border border-white/[0.08] border-r-0 bg-black/40 text-[#8E9EAE] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EA7EA]/45"
        >
          <ChevronLeft size={16} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <nav
      id="home-side-nav"
      aria-label="Navigation verticale de la page d'accueil"
      className="pointer-events-none fixed right-4 top-1/2 z-[920] hidden -translate-y-1/2 md:block lg:right-6"
    >
      <div className="pointer-events-auto relative flex items-stretch gap-3 rounded-2xl border border-white/[0.06] bg-black/35 p-3 pr-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md lg:pr-4">
        {/* Bouton de fermeture — coin supérieur droit */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Masquer la navigation verticale"
          aria-expanded="true"
          aria-controls="home-side-nav"
          title="Masquer la navigation"
          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-white/[0.08] bg-black/70 text-[#8E9EAE] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EA7EA]/45"
        >
          <ChevronRight size={12} strokeWidth={2} aria-hidden />
        </button>

        {/* Rail de progression */}
        <div className="relative flex w-[3px] shrink-0 flex-col overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span
            aria-hidden
            style={{ scaleY: smoothProgress }}
            className="absolute inset-0 origin-top rounded-full bg-linear-to-b from-[#FFB332] via-[#6EA7EA] to-[#FFB332]"
          />
        </div>

        <ul className="flex flex-col justify-between gap-0.5">
          {HOME_SECTIONS.map(({ id, label, Icon }) => {
            const active = id === activeId;
            return (
              <li key={id} className="group/bar">
                <a
                  href={`#${id}`}
                  onClick={handleJump(id)}
                  aria-current={active ? 'location' : undefined}
                  aria-label={label}
                  className="flex items-center gap-2.5 rounded-md px-1 py-1.5 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EA7EA]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors duration-150 ${
                      active
                        ? 'bg-[#FFB332]/18 text-[#FFB332]'
                        : 'text-[#5E6E84] group-hover/bar:text-[#8E9EAE]'
                    }`}
                  >
                    <Icon size={13} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span
                    aria-hidden
                    className={`block h-[3px] shrink-0 rounded-full transition-all duration-300 ease-out ${
                      active
                        ? 'w-8 bg-[#FFB332] shadow-[0_0_14px_rgba(255,179,50,0.55)] lg:w-10'
                        : 'w-4 bg-[#4A5568] group-hover/bar:w-6 group-hover/bar:bg-[#8E9EAE] lg:w-5 lg:group-hover/bar:w-8'
                    }`}
                  />
                  <span
                    aria-hidden
                    className={`hidden whitespace-nowrap text-[11px] font-medium tracking-wide transition-colors duration-150 lg:inline ${
                      active
                        ? 'text-[#F5F7FF]'
                        : 'text-[#8E9EAE] group-hover/bar:text-[#F5F7FF]'
                    }`}
                  >
                    {label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
