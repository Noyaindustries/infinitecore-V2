import { apiRequest, setAuthToken, getAuthToken } from "./apiClient";
import { openGoogleEmailDialog } from "./googleSignInUI";
import { agentSessionLog } from "@/debug/agentSessionLog";
import { publicGoogleClientId } from "@/config/publicEnv";
import { requestGoogleAccessToken } from "./googleIdentityServices";

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
const SESSION_HINT_KEY = "ic_has_session_hint";

function agentDebugLog(payload: Record<string, unknown>) {
  agentSessionLog(payload);
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

function getSessionHint(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SESSION_HINT_KEY) === "1";
}

function setSessionHint(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem(SESSION_HINT_KEY, "1");
    return;
  }
  localStorage.removeItem(SESSION_HINT_KEY);
}

function isAuthEntryPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname || "";
  return p.startsWith("/login") || p.startsWith("/signup") || p.startsWith("/reset-password");
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
    const hasSessionHint = getSessionHint();
    if (!token) {
      // #region agent log
      agentDebugLog({
        runId: "initial",
        hypothesisId: "H8",
        location: "mongoAuth.ts:bootstrapAuthState:no_token",
        message: "auth_bootstrap_no_token",
        data: {},
      });
      // #endregion
    }
    if (!token && !hasSessionHint) {
      authState.currentUser = null;
      emitAuthState();
      return;
    }
    if (!token && hasSessionHint && isAuthEntryPath()) {
      // Evite un appel /api/auth/me sur les écrans d'auth quand aucun token client n'est présent.
      // Cela supprime le 401 bruité en console si l'indice de session est périmé.
      setSessionHint(false);
      authState.currentUser = null;
      emitAuthState();
      return;
    }
    try {
      const data = await apiRequest<{
        success: boolean;
        user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
      }>("/api/auth/me");
      authState.currentUser = toUser(data.user);
      setSessionHint(true);
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
      if (token) setAuthToken(null);
      setSessionHint(false);
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

/** Champs attendus par `AuthRegisterSchema` côté serveur (prénom / nom obligatoires). */
export type RegisterEmailPasswordExtras = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  referredBy?: string | null;
  referredByPartnerId?: string | null;
  referredByPartnerName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyDescription?: string | null;
  industry?: string | null;
  size?: string | null;
};

/** `extras` est obligatoire : le serveur valide avec `AuthRegisterSchema` (prénom + nom min. 1 caractère). */
export async function createUserWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string,
  extras: RegisterEmailPasswordExtras,
) {
  const payload: Record<string, unknown> = {
    email,
    password,
    firstName: String(extras.firstName || "").trim(),
    lastName: String(extras.lastName || "").trim(),
  };
  if (extras.phone != null && String(extras.phone).trim()) {
    payload.phone = String(extras.phone).trim();
  }
  if (extras.referredBy != null && String(extras.referredBy).trim()) {
    payload.referredBy = String(extras.referredBy).trim();
  }
  if (extras.referredByPartnerId != null && String(extras.referredByPartnerId).trim()) {
    payload.referredByPartnerId = String(extras.referredByPartnerId).trim();
  }
  if (extras.referredByPartnerName != null && String(extras.referredByPartnerName).trim()) {
    payload.referredByPartnerName = String(extras.referredByPartnerName).trim();
  }
  if (extras.companyId != null && String(extras.companyId).trim()) {
    payload.companyId = String(extras.companyId).trim();
  }
  if (extras.companyName != null && String(extras.companyName).trim()) {
    payload.companyName = String(extras.companyName).trim();
  }
  if (extras.companyDescription != null && String(extras.companyDescription).trim()) {
    payload.companyDescription = String(extras.companyDescription).trim();
  }
  if (extras.industry != null && String(extras.industry).trim()) {
    payload.industry = String(extras.industry).trim();
  }
  if (extras.size != null && String(extras.size).trim()) {
    payload.size = String(extras.size).trim();
  }
  const data = await apiRequest<{
    success: boolean;
    token?: string;
    verificationRequired?: boolean;
    challengeId?: string;
    user?: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data.verificationRequired) {
    return {
      verificationRequired: true as const,
      challengeId: data.challengeId || "",
      email: String(email || "").trim().toLowerCase(),
    };
  }
  if (!data.user) {
    throw new Error("Réponse d'inscription invalide.");
  }
  setAuthToken(data.token || null);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function verifyEmailSignupCode(_auth: Auth, payload: { email: string; challengeId: string; code: string }) {
  const data = await apiRequest<{
    success: boolean;
    token?: string;
    user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuthToken(data.token || null);
  setSessionHint(true);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, pass: string) {
  const data = await apiRequest<{
    success: boolean;
    token?: string;
    verificationRequired?: boolean;
    challengeId?: string;
    user?: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: pass }),
  });
  if (data.verificationRequired) {
    return {
      verificationRequired: true as const,
      challengeId: data.challengeId || "",
      email: String(email || "").trim().toLowerCase(),
    };
  }
  if (!data.user) {
    throw new Error("Réponse de connexion invalide.");
  }
  setAuthToken(data.token || null);
  setSessionHint(true);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function verifyEmailLoginCode(_auth: Auth, payload: { email: string; challengeId: string; code: string }) {
  const data = await apiRequest<{
    success: boolean;
    token?: string;
    user: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/login/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuthToken(data.token || null);
  setSessionHint(true);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export type SignInWithGoogleOptions = {
  /** Si renseigné, pas de modale (email déjà saisi sur login / signup). */
  email?: string;
  /** Connexion page équipe : refuse les comptes non admin/commando. */
  staffOnly?: boolean;
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
  const googleClientId = publicGoogleClientId();

  if (googleClientId && typeof window !== "undefined") {
    const accessToken = await requestGoogleAccessToken(googleClientId);
    const data = await apiRequest<{
      success: boolean;
      token?: string;
      verificationRequired?: boolean;
      challengeId?: string;
      email?: string;
      role?: string;
      isNew: boolean;
      user?: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
    }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({
        accessToken,
        staffOnly: Boolean(options?.staffOnly),
        displayName: options?.displayName,
        companyName: options?.companyName,
        industry: options?.industry,
        size: options?.size,
        referredBy: options?.referredBy,
        referredByPartnerId: options?.referredByPartnerId,
        referredByPartnerName: options?.referredByPartnerName,
      }),
    });
    if (data.verificationRequired) {
      const emailOut = String(data.email || "").trim().toLowerCase();
      return {
        verificationRequired: true as const,
        challengeId: data.challengeId || "",
        email: emailOut,
        role: String(data.role || "client"),
        isNew: Boolean(data.isNew),
      };
    }
    if (!data.user) {
      throw new Error("Réponse Google invalide.");
    }
    setAuthToken(data.token || null);
    setSessionHint(true);
    authState.currentUser = toUser(data.user);
    emitAuthState();
    return { user: authState.currentUser, isNew: data.isNew };
  }

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
    token?: string;
    verificationRequired?: boolean;
    challengeId?: string;
    email?: string;
    role?: string;
    isNew: boolean;
    user?: { uid: string; email: string; role: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({
      email: trimmed,
      staffOnly: Boolean(options?.staffOnly),
      displayName: display,
      companyName: options?.companyName,
      industry: options?.industry,
      size: options?.size,
      referredBy: options?.referredBy,
      referredByPartnerId: options?.referredByPartnerId,
      referredByPartnerName: options?.referredByPartnerName,
    }),
  });
  if (data.verificationRequired) {
    return {
      verificationRequired: true as const,
      challengeId: data.challengeId || "",
      email: String(data.email || trimmed).trim().toLowerCase(),
      role: String(data.role || "client"),
      isNew: Boolean(data.isNew),
    };
  }
  if (!data.user) {
    throw new Error("Réponse Google invalide.");
  }
  setAuthToken(data.token || null);
  setSessionHint(true);
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
  setSessionHint(false);
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
