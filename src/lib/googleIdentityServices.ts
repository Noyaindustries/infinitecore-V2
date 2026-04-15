/**
 * Charge **Google Identity Services** et ouvre le flux OAuth navigateur
 * (sélecteur de compte Google, comme sur accounts.google.com).
 *
 * Variable requise côté client : **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`**
 * (type « Application Web » dans Google Cloud Console, origines JS autorisées).
 */

let gsiLoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services indisponible côté serveur."));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;
  gsiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger Google Identity Services."));
    document.head.appendChild(s);
  });
  return gsiLoadPromise;
}

const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

/**
 * Affiche le sélecteur de compte Google et résout avec un **access_token** OAuth
 * (court terme), à échanger côté API via `/api/auth/google`.
 */
export function requestGoogleAccessToken(clientId: string): Promise<string> {
  return loadGoogleIdentityServices().then(
    () =>
      new Promise((resolve, reject) => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new Error("Google Identity Services indisponible."));
          return;
        }
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_OAUTH_SCOPES,
          prompt: "select_account",
          callback: (resp) => {
            if (resp.error) {
              const err = new Error(
                resp.error_description?.trim() || resp.error || "Connexion Google annulée."
              );
              const code =
                resp.error === "access_denied" || resp.error === "popup_closed_by_user"
                  ? "auth/popup-closed-by-user"
                  : "auth/credential-error";
              (err as Error & { code?: string }).code = code;
              reject(err);
              return;
            }
            if (!resp.access_token) {
              const err = new Error("Jeton Google manquant.");
              (err as Error & { code?: string }).code = "auth/credential-error";
              reject(err);
              return;
            }
            resolve(resp.access_token);
          },
        });
        client.requestAccessToken();
      })
  );
}
