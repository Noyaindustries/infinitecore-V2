import { apiUrl } from './apiBase';
import { getAuthToken } from './apiClient';

/** Télécharge un fichier via l’API (auth cookie ou Bearer) et enregistre en local. */
export async function downloadAuthFile(fileUrl: string, filename = 'fichier'): Promise<void> {
  const href = fileUrl.startsWith('http') ? fileUrl : apiUrl(fileUrl);
  const token = getAuthToken();
  const response = await fetch(href, {
    method: 'GET',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status}).`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function isInternalDownloadUrl(url: string): boolean {
  return url.includes('/api/files/download');
}
