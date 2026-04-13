/** Taille fichier lisible (o, Ko, Mo, Go) — une seule implémentation pour tout le front. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
