import { apiUrl } from "./apiBase";

const AUTH_TOKEN_KEY = "ic_auth_token";

function agentDebugLog(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // #region agent log
  fetch("http://127.0.0.1:27772/ingest/9581a084-44fc-4752-b649-5a3388314469", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "73b87a" },
    body: JSON.stringify({ sessionId: "73b87a", timestamp: Date.now(), ...payload }),
  }).catch(() => {});
  // #endregion
}

function safeResolvedUrlForLog(resolvedUrl: string, method: string | undefined) {
  try {
    const u = new URL(resolvedUrl, window.location.origin);
    return { host: u.host, pathname: u.pathname, method: method || "GET" };
  } catch {
    return { host: "invalid-url", pathname: String(resolvedUrl).slice(0, 96), method: method || "GET" };
  }
}

/**
 * Plafond pour toute la requête (fetch + lecture du corps).
 * `AbortController` seul ne garantit pas l’arrêt si le TCP reste bloqué ou si `response.text()` pend.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;

const TIMEOUT_MESSAGE =
  "Délai dépassé : l’API ou la base de données ne répond pas. Vérifiez DATABASE_URL (Mongo, IP Atlas), le réseau, ou réessayez après un cold start Vercel.";

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

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const merged = new AbortController();
  const onAbort = () => merged.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return merged.signal;
}

async function fetchAndParse<T>(url: string, init: RequestInit, fetchSignal: AbortSignal): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers, signal: fetchSignal });
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

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const resolvedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : apiUrl(url);

  const deadlineMs = DEFAULT_REQUEST_TIMEOUT_MS;
  const outer = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();

  const upstream = init.signal;
  const fetchSignal = upstream ? mergeAbortSignals(outer.signal, upstream) : outer.signal;

  // #region agent log
  agentDebugLog({
    location: "apiClient.ts:apiRequest:start",
    message: "apiRequest_start",
    runId: "initial",
    hypothesisId: "H2",
    data: { ...safeResolvedUrlForLog(resolvedUrl, init.method), deadlineMs, hasUpstreamSignal: !!upstream },
  });
  // #endregion

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      outer.abort();
      reject(new Error(TIMEOUT_MESSAGE));
    }, deadlineMs);
  });

  try {
    const out = await Promise.race([fetchAndParse<T>(resolvedUrl, init, fetchSignal), timeoutPromise]);
    // #region agent log
    agentDebugLog({
      location: "apiClient.ts:apiRequest:success",
      message: "apiRequest_success",
      runId: "initial",
      hypothesisId: "H1",
      data: { ...safeResolvedUrlForLog(resolvedUrl, init.method), elapsedMs: Date.now() - startedAt },
    });
    // #endregion
    return out;
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    const elapsedMs = Date.now() - startedAt;
    // #region agent log
    agentDebugLog({
      location: "apiClient.ts:apiRequest:catch",
      message: "apiRequest_error",
      runId: "initial",
      hypothesisId: name === "AbortError" || msg === TIMEOUT_MESSAGE ? "H1" : "H3",
      data: {
        ...safeResolvedUrlForLog(resolvedUrl, init.method),
        elapsedMs,
        deadlineMs,
        errorName: name,
        isTimeoutMessage: msg === TIMEOUT_MESSAGE,
        messageSnippet: msg.slice(0, 120),
      },
    });
    // #endregion
    if (name === "AbortError") {
      throw new Error(TIMEOUT_MESSAGE);
    }
    throw e;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
