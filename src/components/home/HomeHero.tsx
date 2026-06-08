import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, animate } from 'framer-motion';
import { ArrowRight, LayoutDashboard, Lock, Users, Wallet, FileSignature, Briefcase, Zap } from 'lucide-react';

const STATS = [
  { val: '97+', label: 'entreprises actives', accent: 'text-text-primary' },
  { val: '7', label: 'modules intégrés', accent: 'text-[#6EA7EA]' },
  { val: '5j', label: 'déploiement', accent: 'text-noya-orange' },
  { val: '24h', label: 'contact après inscription', accent: 'text-text-primary' },
] as const;

const MODULE_PILLS = ['CRM', 'Finance', 'RH', 'Projets', 'Academy', 'Comms', 'Store'] as const;

function HeroCounter({ value, accent }: { value: string; accent: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(nodeRef, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!isInView || !nodeRef.current) return;
    const numericValue = Number.parseInt(value, 10) || 0;
    const suffix = value.replace(/[0-9]/g, '');
    const prefix = value.match(/^[^\d]+/)?.[0] || '';
    const controls = animate(0, numericValue, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(latest) {
        if (nodeRef.current) {
          nodeRef.current.textContent = `${prefix}${Math.round(latest)}${suffix}`;
        }
      },
    });
    return () => controls.stop();
  }, [value, isInView]);

  return (
    <span ref={nodeRef} className={`home-stat-value ${accent}`}>
      0
    </span>
  );
}

export default function HomeHero() {
  return (
    <main id="accueil" className="home-hero relative z-10 flex w-full flex-col items-center px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-10 md:pb-24 md:pt-12">
      <div className="home-hero-aurora pointer-events-none absolute inset-0" aria-hidden />

      <div className="container relative mx-auto max-w-[1120px] text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="home-hero-badge mx-auto mb-8"
        >
          <span className="home-hero-badge-dot" aria-hidden />
          Le système d&apos;exploitation des entreprises africaines
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.65 }}
          className="home-hero-title"
        >
          Gérez toute votre
          <br />
          <span className="home-text-gradient-gold">entreprise</span>
          <br />
          <span className="home-text-gradient-blue">sans limites.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.6 }}
          className="home-hero-lead mx-auto mt-6 max-w-2xl px-2 sm:mt-8"
        >
          Infinite Core unifie CRM, Finance, RH, Projets, Academy, Comms et Store dans un système unique —
          modulaire, personnalisable et pensé pour votre croissance en Afrique.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.6 }}
          className="mx-auto mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center"
        >
          <Link to="/signup" className="home-btn-primary group">
            Créer mon compte gratuitement
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a href="#system" className="home-btn-secondary group">
            <LayoutDashboard className="h-4 w-4 text-text-secondary" aria-hidden />
            Infinite System
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32, duration: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          {MODULE_PILLS.map((mod) => (
            <span key={mod} className="home-module-pill">
              {mod}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.7 }}
        className="container relative mx-auto mt-14 max-w-[1000px] sm:mt-16"
      >
        <div className="home-stat-panel">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/5 md:grid-cols-4 md:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center justify-center px-4 py-7 text-center sm:px-6 sm:py-8">
                <HeroCounter value={stat.val} accent={stat.accent} />
                <span className="home-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.48, duration: 1 }}
        className="container relative z-10 mx-auto mt-12 max-w-sm perspective-[2000px] sm:max-w-md md:max-w-lg lg:max-w-2xl"
      >
        <div className="home-dashboard-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="home-dashboard-shell">
          <div className="home-dashboard-inner flex h-[340px] flex-col sm:h-[380px] md:h-[400px]">
            <div className="relative flex items-center border-b border-white/5 bg-[#06080D]/70 px-4 py-2.5 backdrop-blur-md">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#E15B64]/50 bg-[#E15B64]" />
                <span className="h-2.5 w-2.5 rounded-full border border-[#F5C04E]/50 bg-[#F5C04E]" />
                <span className="h-2.5 w-2.5 rounded-full border border-noya-green/50 bg-noya-green" />
              </div>
              <div className="absolute left-1/2 flex max-w-[calc(100%-5rem)] -translate-x-1/2 items-center gap-2 truncate rounded-full border border-white/10 bg-white/5 px-4 py-1 font-mono text-[9px] text-text-secondary">
                <Lock size={9} className="shrink-0 text-[#6EA7EA]" aria-hidden />
                <span className="truncate">app.infinitecore.ci / dashboard</span>
              </div>
            </div>

            <div className="flex flex-1 gap-3 p-3">
              <div className="hidden w-36 flex-col gap-1 md:flex lg:w-40">
                <div className="flex items-center gap-1.5 rounded-lg border border-noya-orange/25 bg-noya-orange/10 px-2.5 py-1.5 text-[11px] font-bold text-noya-orange shadow-[0_0_12px_rgba(255,179,50,0.08)]">
                  <Zap size={12} aria-hidden /> Tableau de bord
                </div>
                {[
                  { Icon: Users, label: 'CRM' },
                  { Icon: Wallet, label: 'Finance' },
                  { Icon: FileSignature, label: 'RH' },
                  { Icon: Briefcase, label: 'Projets' },
                ].map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    <Icon size={12} aria-hidden /> {label}
                  </div>
                ))}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-text-primary sm:text-base">Bonjour, Client</h3>
                  <span className="flex items-center gap-1.5 rounded-full border border-noya-green/25 bg-noya-green/10 px-2 py-0.5 text-[9px] font-bold text-noya-green">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-noya-green" aria-hidden />
                    ACTIF
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {[
                    { label: 'REVENUS MENSUELS', val: '18.4M', sub: '+12.5%', up: true },
                    { label: 'CLIENTS ACTIFS', val: '246', sub: '+15', up: true },
                    { label: 'TICKETS OUVERTS', val: '12', sub: '3 prioritaires', up: false },
                    { label: 'IMPAYÉS', val: '4', sub: '2.1M total', up: false },
                  ].map((kpi) => (
                    <div key={kpi.label} className="home-kpi-tile">
                      <p className="mb-1 text-[8px] font-bold tracking-wider text-text-muted sm:text-[9px]">{kpi.label}</p>
                      <p className="text-lg font-bold text-text-primary sm:text-xl">{kpi.val}</p>
                      <p className={`text-[9px] font-medium ${kpi.up ? 'text-noya-green' : 'text-noya-red'}`}>{kpi.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="flex min-h-[100px] flex-1 flex-col rounded-xl border border-white/5 bg-surface-tertiary p-3">
                  <p className="mb-2 text-[9px] font-bold tracking-wider text-text-muted">ÉVOLUTION TRÉSORERIE</p>
                  <div className="relative flex flex-1 items-end justify-between gap-2">
                    {[35, 50, 40, 65, 80, 100].map((h, i) => (
                      <div
                        key={i}
                        className={`w-1/6 rounded-t transition-all duration-700 ${
                          i % 2 === 0
                            ? 'bg-gradient-to-t from-[#6EA7EA]/20 to-[#6EA7EA]'
                            : 'bg-gradient-to-t from-noya-orange/20 to-noya-orange'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
