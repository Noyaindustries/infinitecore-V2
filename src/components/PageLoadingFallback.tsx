/**
 * Affichage pendant le chargement des chunks (Suspense) — évite un écran blanc
 * si le réseau ou le disque est lent, ou lors des navigations lazy.
 */
export function PageLoadingFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center bg-noya-black text-text-secondary gap-3 px-4 py-16 ${
        fullScreen ? "min-h-screen" : "min-h-[50vh]"
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-9 w-9 rounded-full border-2 border-luxe-champagne/35 border-t-luxe-champagne animate-spin"
        aria-hidden
      />
      <p className="text-sm font-medium tracking-wide">Chargement…</p>
    </div>
  );
}
