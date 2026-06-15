import { apiUrl } from "../lib/apiBase";
import { mutationAuthHeaderEntries } from "../lib/apiClient";

export interface UploadResult {
  url: string;
  publicId: string;
  name?: string;
  size?: number;
  mimetype?: string;
}

export function uploadFile(
  file: File,
  folder = "misc",
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/files/upload"));
    xhr.withCredentials = true;
    for (const [name, value] of mutationAuthHeaderEntries()) {
      xhr.setRequestHeader(name, value);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      let errBody: { error?: string } = {};
      try {
        errBody = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* ignore */
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 401) {
          reject(new Error("Session expirée. Reconnectez-vous puis réessayez l'upload."));
          return;
        }
        if (xhr.status === 403 && /csrf/i.test(String(errBody?.error || ""))) {
          reject(
            new Error(
              "Upload refusé (jeton CSRF). Rechargez la page ou reconnectez-vous, puis réessayez."
            )
          );
          return;
        }
        const detail = errBody?.error ? ` ${errBody.error}` : "";
        reject(new Error(`Upload échoué (${xhr.status}).${detail}`));
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (!data?.success || !data?.url || !data?.publicId) {
          reject(new Error(data?.error || "Réponse upload invalide."));
          return;
        }
        resolve({
          url: data.url,
          publicId: data.publicId,
          name: data.name,
          size: data.size,
          mimetype: data.mimetype,
        });
      } catch (error) {
        reject(error);
      }
    };

    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.send(formData);
  });
}

export async function deleteUploadedFile(publicId: string): Promise<void> {
  if (!publicId) return;
  const headers = new Headers();
  for (const [name, value] of mutationAuthHeaderEntries()) {
    headers.set(name, value);
  }
  const response = await fetch(apiUrl(`/api/files?publicId=${encodeURIComponent(publicId)}`), {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error("Suppression du fichier impossible.");
  }
}
