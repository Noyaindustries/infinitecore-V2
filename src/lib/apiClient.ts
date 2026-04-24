import { apiUrl } from "./apiBase";
import { agentSessionLog } from "@/debug/agentSessionLog";

/**
 * Réponse `!response.ok` avec corps JSON typique `{ error?: string }`.
 * Permet aux écrans de distinguer 409 / 401 etc. sans parser le message.
 */
export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const AUTH_TOKEN_KEY = "ic_auth_token";
const USE_LEGACY_BEARER =
  typeof process !== "undefined" &&
  !!process.env &&
  process.env.NEXT_PUBLIC_USE_LEGACY_BEARER === "1";

function agentDebugLog(payload: Record<string, unknown>) {
  agentSessionLog(payload);
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
function resolveRequestTimeoutMs() {
  const raw = Number.parseInt(String(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || ""), 10);
  if (!Number.isFinite(raw)) return 45_000;
  return Math.min(120_000, Math.max(5_000, raw));
}

const DEFAULT_REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs();

const TIMEOUT_MESSAGE_BASE =
  "Délai dépassé : l’API ou la base de données ne répond pas. Vérifiez DATABASE_URL (Mongo, IP Atlas), le réseau, ou réessayez après un cold start Vercel.";

function buildTimeoutMessage(resolvedUrl: string, method?: string) {
  const safe = safeResolvedUrlForLog(resolvedUrl, method);
  return `${TIMEOUT_MESSAGE_BASE} [${safe.method} ${safe.pathname}]`;
}

export function getAuthToken(): string | null {
  if (!USE_LEGACY_BEARER) return null;
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (!USE_LEGACY_BEARER) return;
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

  const response = await fetch(url, {
    ...init,
    headers,
    signal: fetchSignal,
    credentials: init.credentials ?? "include",
  });
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
    const message = String(
      fromJson ||
        snippet ||
        (response.status === 502 || response.status === 503
          ? `API indisponible (${response.status}). Vercel : variables **DATABASE_URL** / secrets sur le projet, logs de la fonction \`/api\`. Local : \`npm run dev\`. Si API externe : **NEXT_PUBLIC_API_BASE_URL** + CORS.`
          : opaque500
            ? `Erreur serveur (500). Consultez le terminal « api » : souvent MongoDB injoignable (Atlas, TLS, IP autorisées) ou cache Next corrompu (supprimez le dossier .next puis relancez npm run dev).`
            : `Erreur API (${response.status})`)
    );
    throw new ApiHttpError(response.status, message, obj);
  }
  return parsed as T;
}

/** Conflit « compte / email déjà présent » (ex. inscription sur un email existant). */
export function isEmailAlreadyRegisteredError(error: unknown): boolean {
  if (error instanceof ApiHttpError && error.status === 409) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /existe déjà|déjà utilisé/i.test(msg);
}

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const resolvedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : apiUrl(url);

  const deadlineMs = DEFAULT_REQUEST_TIMEOUT_MS;
  const method = String(init.method || "GET").toUpperCase();
  const timeoutMessage = buildTimeoutMessage(resolvedUrl, init.method);
  const isTimeoutMessage = (msg: string) =>
    msg === TIMEOUT_MESSAGE_BASE || msg === timeoutMessage || msg.startsWith(`${TIMEOUT_MESSAGE_BASE} [`);

  const canRetry =
    method === "GET" ||
    method === "HEAD" ||
    method === "OPTIONS" ||
    (method === "POST" && (resolvedUrl.includes("/api/data/query") || resolvedUrl.includes("/api/data/doc?")));

  const runAttempt = async (attempt: number): Promise<T> => {
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
      data: {
        ...safeResolvedUrlForLog(resolvedUrl, init.method),
        deadlineMs,
        hasUpstreamSignal: !!upstream,
        attempt,
      },
    });
    // #endregion

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        outer.abort();
        reject(new Error(timeoutMessage));
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
        data: { ...safeResolvedUrlForLog(resolvedUrl, init.method), elapsedMs: Date.now() - startedAt, attempt },
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
        hypothesisId: name === "AbortError" || isTimeoutMessage(msg) ? "H1" : "H3",
        data: {
          ...safeResolvedUrlForLog(resolvedUrl, init.method),
          elapsedMs,
          deadlineMs,
          errorName: name,
          isTimeoutMessage: isTimeoutMessage(msg),
          messageSnippet: msg.slice(0, 120),
          attempt,
        },
      });
      // #endregion
      if (name === "AbortError") {
        throw new Error(timeoutMessage);
      }
      throw e;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  };

  try {
    return await runAttempt(1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!canRetry || !isTimeoutMessage(msg)) throw e;

    // Petite pause pour laisser un cold start API se terminer.
    await new Promise((resolve) => setTimeout(resolve, 350));
    return runAttempt(2);
  }
}
