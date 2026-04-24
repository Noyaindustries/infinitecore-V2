import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from '@/lib/mongoAuth';
import { auth } from '@/lib/clientSdk';
import { apiRequest, ApiHttpError } from '../lib/apiClient';
import { agentSessionLog } from '@/debug/agentSessionLog';
import toast from 'react-hot-toast';

function agentDebugLog(payload: Record<string, unknown>) {
  agentSessionLog(payload);
}

/** Profil `users/*` — champs courants typés, le reste en index signature. */
export type AuthUserData = {
  role?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  photoURL?: string;
  companyId?: string;
  referredBy?: string | null;
  referralCode?: string;
  partnerCode?: string;
  uid?: string;
  phone?: string;
  /** Champs additionnels côté document utilisateur */
  [key: string]: string | number | boolean | null | undefined;
};

interface AuthContextType {
  user: User | null;
  userData: AuthUserData | null;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 15000;
const LAST_ACTIVITY_KEY = 'ic_last_activity_at';
const SESSION_EXPIRED_TOAST_ID = 'session-expired';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AuthUserData | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // #region agent log
      agentDebugLog({
        runId: "initial",
        hypothesisId: "H10",
        location: "AuthProvider.tsx:onAuthStateChanged:callback",
        message: "auth_provider_listener_called",
        data: { hasCurrentUser: !!currentUser },
      });
      // #endregion
      setUser(currentUser);

      if (currentUser) {
        void apiRequest<{ success: boolean; userData?: AuthUserData }>('/api/auth/me')
          .then((payload) => {
            setUserData(payload.userData || null);
          })
          .catch((error) => {
            // 401 = session/cookie expiré(e) ; ce n'est pas une erreur "bruyante" en prod.
            if (error instanceof ApiHttpError && error.status === 401) {
              toast.error('Session expirée, reconnectez-vous.', { id: SESSION_EXPIRED_TOAST_ID });
              void signOut(auth);
              return;
            }
            console.error('Error fetching user data:', error);
            setUserData(null);
          })
          .finally(() => {
            setIsAuthReady(true);
            // #region agent log
            agentDebugLog({
              runId: "initial",
              hypothesisId: "H10",
              location: "AuthProvider.tsx:onAuthStateChanged:finally_user",
              message: "auth_provider_ready_after_me",
              data: {},
            });
            // #endregion
          });
      } else {
        setUserData(null);
        setIsAuthReady(true);
        // #region agent log
        agentDebugLog({
          runId: "initial",
          hypothesisId: "H10",
          location: "AuthProvider.tsx:onAuthStateChanged:no_user",
          message: "auth_provider_ready_no_user",
          data: {},
        });
        // #endregion
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const intervalId = window.setInterval(() => {
      void apiRequest<{ success: boolean; userData?: AuthUserData }>('/api/auth/me')
        .then((payload) => {
          setUserData(payload.userData || null);
        })
        .catch((error) => {
          if (error instanceof ApiHttpError && error.status === 401) {
            toast.error('Session expirée, reconnectez-vous.', { id: SESSION_EXPIRED_TOAST_ID });
            void signOut(auth);
            return;
          }
          // Ignorer les erreurs temporaires réseau
        });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    const readLastActivity = () => {
      const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || "0");
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    };

    let lastPersistedAt = 0;
    const persistActivity = (force = false) => {
      const now = Date.now();
      if (!force && now - lastPersistedAt < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastPersistedAt = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    };

    const logoutForInactivity = () => {
      void signOut(auth);
    };

    const enforceIdleTimeout = () => {
      const lastActivity = readLastActivity();
      const idleMs = Date.now() - lastActivity;
      if (lastActivity > 0 && idleMs >= IDLE_TIMEOUT_MS) {
        logoutForInactivity();
      }
    };

    const initialLastActivity = readLastActivity();
    if (initialLastActivity > 0 && Date.now() - initialLastActivity >= IDLE_TIMEOUT_MS) {
      logoutForInactivity();
      return;
    }
    persistActivity(initialLastActivity <= 0);

    const markActivity = () => persistActivity(false);
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        enforceIdleTimeout();
        persistActivity(false);
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const timerId = window.setInterval(enforceIdleTimeout, 30 * 1000);

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity);
      }
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.clearInterval(timerId);
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        isAuthReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
