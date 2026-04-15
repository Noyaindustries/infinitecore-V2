import { apiUrl } from "./apiBase";

const AUTH_TOKEN_KEY = "ic_auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resolvedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : apiUrl(url);
  const response = await fetch(resolvedUrl, { ...init, headers });
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // Réponse HTML ou tronquée (ex. proxy Next après ECONNRESET) : pas de JSON exploitable.
    }
  }
  const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  if (!response.ok) {
    const errObj = obj as { error?: string; message?: string };
    const fromJson = errObj.error || errObj.message;
    const snippet =
      !fromJson && text && !text.trimStart().startsWith("<")
        ? text.trim().slice(0, 240)
        : "";
    const opaque500 =
      response.status === 500 &&
      (!fromJson || /^internal server error$/i.test(String(fromJson).trim())) &&
      (!snippet || /^internal server error$/i.test(snippet.trim()));
    throw new Error(
      fromJson ||
        snippet ||
        (response.status === 502 || response.status === 503
          ? `API indisponible (${response.status}). Vercel : variables **DATABASE_URL** / secrets sur le projet, logs de la fonction \`/api\`. Local : \`npm run dev\`. Si API externe : **NEXT_PUBLIC_API_BASE_URL** + CORS.`
          : opaque500
            ? `Erreur serveur (500). Consultez le terminal « api » : souvent MongoDB injoignable (Atlas, TLS, IP autorisées) ou cache Next corrompu (supprimez le dossier .next puis relancez npm run dev).`
            : `Erreur API (${response.status})`)
    );
  }
  return parsed as T;
}
