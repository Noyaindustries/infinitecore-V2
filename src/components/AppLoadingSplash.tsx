/**
 * Splash screen affiché pendant l'hydratation de l'app (Suspense fallback)
 * et au chargement de chaque route lazy.
 *
 * Composition :
 *  - médaillon circulaire contenant le symbole Infinite Core,
 *  - arc de chargement orange qui tourne *autour* du logo (rotation infinie),
 *  - signature textuelle « INFINITE CORE » sous le médaillon.
 */

export default function AppLoadingSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Chargement d'Infinite Core"
      className="fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center gap-7 bg-[#2B547E] text-[#F5F0E4]"
    >
      {/* Halo orange diffus en arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,rgba(217,138,44,0.18),transparent_65%)]"
      />

      {/* Médaillon + arc rotatif */}
      <div className="relative flex h-[200px] w-[200px] items-center justify-center">
        {/* Rail circulaire discret — donne du repère visuel à l'arc actif */}
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="47"
            stroke="rgba(245,240,228,0.12)"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>

        {/* Arc de chargement rotatif (~30 % de circonférence) */}
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full animate-[ic-splash-rotate_1.6s_linear_infinite]"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="ic-splash-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D98A2C" stopOpacity="0" />
              <stop offset="50%" stopColor="#D98A2C" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#D98A2C" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="47"
            stroke="url(#ic-splash-grad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="88 295"
            style={{
              filter: "drop-shadow(0 0 4px rgba(217,138,44,0.55))",
            }}
          />
        </svg>

        {/* Logo badge — cercle intérieur, même style que le favicon */}
        <div className="relative z-10 h-[148px] w-[148px] overflow-hidden rounded-full border-[3px] border-[#D98A2C]/60 bg-[#2B547E] shadow-[0_14px_40px_-12px_rgba(0,0,0,0.55)]">
          <img
            src="/infinite-core-icon.png"
            alt=""
            aria-hidden
            draggable={false}
            className="h-full w-full select-none object-cover animate-[ic-splash-pulse_2.4s_ease-in-out_infinite]"
          />
        </div>
      </div>

      {/* Signature */}
      <div className="relative flex flex-col items-center gap-2">
        <p className="text-[20px] font-semibold tracking-[0.28em] text-[#F5F0E4]">
          INFINITE CORE
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#F5F0E4]/60">
          Chargement en cours
        </p>
      </div>

      <style>{`
        @keyframes ic-splash-rotate {
          to { transform: rotate(360deg); }
        }
        @keyframes ic-splash-pulse {
          0%, 100% { opacity: 0.92; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.015); }
        }
      `}</style>
    </div>
  );
}
