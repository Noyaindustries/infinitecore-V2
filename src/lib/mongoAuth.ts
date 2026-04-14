import { apiRequest, setAuthToken, getAuthToken } from "./apiClient";

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

function toUser(raw: { uid: string; email: string; displayName?: string | null; photoURL?: string | null }): User {
  return {
    uid: raw.uid,
    email: raw.email || null,
    displayName: raw.displayName || raw.email || null,
    photoURL: raw.photoURL || null,
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
    const token = getAuthToken();
    if (!token) {
      authState.currentUser = null;
      emitAuthState();
      return;
    }
    try {
      const data = await apiRequest<{
        success: boolean;
        user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null };
      }>("/api/auth/me");
      authState.currentUser = toUser(data.user);
    } catch {
      setAuthToken(null);
      authState.currentUser = null;
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
  void bootstrapAuthState().then(() => callback(authState.currentUser));
  return () => listeners.delete(callback);
}

export async function createUserWithEmailAndPassword(_auth: Auth, email: string, password: string) {
  const data = await apiRequest<{
    success: boolean;
    token: string;
    user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, password: string) {
  const data = await apiRequest<{
    success: boolean;
    token: string;
    user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
}

export async function signInWithPopup(_auth: Auth, provider: GoogleAuthProvider) {
  const hint = provider.getCustomParameters().login_hint || "";
  const email = window.prompt("Adresse Google à utiliser", hint) || "";
  if (!email.trim()) {
    const error = new Error("Connexion Google annulée.");
    (error as Error & { code?: string }).code = "auth/popup-closed-by-user";
    throw error;
  }
  const data = await apiRequest<{
    success: boolean;
    token: string;
    user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null };
  }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), displayName: email.split("@")[0] }),
  });
  setAuthToken(data.token);
  authState.currentUser = toUser(data.user);
  emitAuthState();
  return { user: authState.currentUser };
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
