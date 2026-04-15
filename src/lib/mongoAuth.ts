import { apiRequest, setAuthToken, getAuthToken } from "./apiClient";
import { openGoogleEmailDialog } from "./googleSignInUI";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: Array<{
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }>;
  role: string;
  delete: () => Promise<void>;
}

export interface Auth {
  currentUser: User | null;
  signOut: () => Promise<void>;
}

type AuthListener = (user: User | null) => void;

export class GoogleAuthProvider {
  private params: Record<string, string> = {};

  setCustomParameters(params: Record<string, string>) {
    this.params = { ...this.params, ...params };
  }

  getCustomParameters() {
    return { ...this.params };
  }
}

export const inMemoryPersistence = "in-memory";

const authState: Auth = {
  currentUser: null,
  signOut: async () => {
    await signOut(authState);
  },
};
const listeners = new Set<AuthListener>();
let bootstrapPromise: Promise<void> | null = null;

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

function toUser(raw: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null }): User {
  return {
    uid: raw.uid,
    email: raw.email || null,
    displayName: raw.displayName || raw.email || null,
    photoURL: raw.photoURL || null,
    role: raw.role || "client",
    phoneNumber: null,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [],
    delete: async () => {
      await signOut(authState);
    },
  };
}

function emitAuthState() {
  for (const listener of listeners) listener(authState.currentUser);
}

async function bootstrapAuthState() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    // #region agent log
    agentDebugLog({
      runId: "initial",
      hypothesisId: "H8",
      location: "mongoAuth.ts:bootstrapAuthState:start",
      message: "auth_bootstrap_start",
      data: {},
    });
    // #endregion
    const token = getAuthToken();
    if (!token) {
      authState.currentUser = null;
      // #region agent log
      agentDebugLog({
        runId: "initial",
        hypothesisId: "H8",
        location: "mongoAuth.ts:bootstrapAuthState:no_token",
        message: "auth_bootstrap_no_token",
        data: {},
      });
      // #endregion
      emitAuthState();
      return;
    }
    try {
      const data = await apiRequest<{
        success: boolean;
        user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
      }>("/api/auth/me");
      authState.currentUser = toUser(data.user);
      // #region agent log
      agentDebugLog({
        runId: "initial",
        hypothesisId: "H8",
        location: "mongoAuth.ts:bootstrapAuthState:me_ok",
        message: "auth_bootstrap_me_ok",
        data: { uid: data.user?.uid || "unknown" },
      });
      // #endregion
    } catch {
      setAuthToken(null);
      authState.currentUser = null;
      // #region agent log
      agentDebugLog({
        runId: "initial",
        hypothesisId: "H9",
        location: "mongoAuth.ts:bootstrapAuthState:me_fail",
        message: "auth_bootstrap_me_fail",
        data: {},
      });
      // #endregion
    }
    emitAuthState();
  })();
  return bootstrapPromise;
}

export function getAuth(_app?: unknown): Auth {
  void bootstrapAuthState();
  return authState;
}

export function onAuthStateChanged(_auth: Auth, callback: AuthListener) {
  listeners.add(callback);
  // #region agent log
  agentDebugLog({
    runId: "initial",
    hypothesisId: "H10",
    location: "mongoAuth.ts:onAuthStateChanged:subscribed",
    message: "auth_listener_subscribed",
    data: { listenersCount: listeners.size },
  });
  // #endregion
  void bootstrapAuthState().then(() => callback(authState.currentUser));
  return () => {
    listeners.delete(callback);
  };
}

export async function createUserWithEmailAndPassword(_auth: Auth, email: string, password: string) {
  const data = await apiRequest<{
    success: boolean;
    token: string;
    user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, pass: string) {
  const data = await apiRequest<{
    success: boolean;
    token: string;
    user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: pass }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export type SignInWithGoogleOptions = {
  /** Si renseigné, pas de modale (email déjà saisi sur login / signup). */
  email?: string;
  /** Nom affiché côté API (sinon dérivé de la partie locale de l’email). */
  displayName?: string;
  /** Métadonnées d’inscription (optionnel) */
  companyName?: string;
  industry?: string;
  size?: string;
  referredBy?: string | null;
  referredByPartnerId?: string | null;
  referredByPartnerName?: string | null;
};

export async function signInWithPopup(
  _auth: Auth,
  provider: GoogleAuthProvider,
  options?: SignInWithGoogleOptions
) {
  const fromOptions = String(options?.email || "").trim();
  const fromHint = String(provider.getCustomParameters().login_hint || "").trim();
  let email = fromOptions || fromHint;
  if (!email) {
    if (typeof window === "undefined") {
      const error = new Error("Connexion Google indisponible côté serveur.");
      (error as Error & { code?: string }).code = "auth/operation-not-supported-in-this-environment";
      throw error;
    }
    const fromDialog = await openGoogleEmailDialog(fromHint);
    email = (fromDialog || "").trim();
  }
  if (!email.trim()) {
    const error = new Error("Connexion Google annulée.");
    (error as Error & { code?: string }).code = "auth/popup-closed-by-user";
    throw error;
  }
  const trimmed = email.trim();
  const display =
    String(options?.displayName || "").trim() || trimmed.split("@")[0] || trimmed;

  const data = await apiRequest<{
    success: boolean;
    token: string;
    isNew: boolean;
    user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({
      email: trimmed,
      displayName: display,
      companyName: options?.companyName,
      industry: options?.industry,
      size: options?.size,
      referredBy: options?.referredBy,
      referredByPartnerId: options?.referredByPartnerId,
      referredByPartnerName: options?.referredByPartnerName,
    }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser, isNew: data.isNew };
}

export async function signOut(_auth: Auth) {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch {
    // no-op
  }
  setAuthToken(null);
  authState.currentUser = null;
  emitAuthState();
}

export async function sendPasswordResetEmail(_auth: Auth, _email: string) {
  const email = String(_email || "").trim().toLowerCase();
  if (!email) return Promise.resolve();
  const data = await apiRequest<{ success: boolean; resetTokenPreview?: string }>("/api/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (data.resetTokenPreview && typeof window !== "undefined") {
    // En dev, on expose un aperçu du token pour tester le flux sans provider mail.
    console.info("[password-reset][dev] token:", data.resetTokenPreview);
  }
  return Promise.resolve();
}

export async function confirmPasswordReset(
  _auth: Auth,
  email: string,
  token: string,
  newPassword: string
) {
  await apiRequest<{ success: boolean; message?: string }>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      token: String(token || "").trim(),
      newPassword: String(newPassword || ""),
    }),
  });
}

export async function updateProfile(user: User, updates: { displayName?: string | null; photoURL?: string | null }) {
  await apiRequest<{
    success: boolean;
    user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: updates.displayName ?? user.displayName,
      photoURL: updates.photoURL ?? user.photoURL,
    }),
  });
  authState.currentUser = {
    ...user,
    displayName: updates.displayName ?? user.displayName,
    photoURL: updates.photoURL ?? user.photoURL,
    delete: user.delete,
  };
  emitAuthState();
}

export async function setPersistence(_auth: Auth, _persistence: string) {
  return Promise.resolve();
}
