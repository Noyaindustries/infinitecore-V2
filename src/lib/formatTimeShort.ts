/** Heure locale FR (HH:mm) pour fils de discussion. */
export function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
