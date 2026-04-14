import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { apiRequest } from '../lib/apiClient';

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
  /** Champs additionnels Firestore */
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

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AuthUserData | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        void apiRequest<{ success: boolean; userData?: AuthUserData }>('/api/auth/me')
          .then((payload) => {
            setUserData(payload.userData || null);
          })
          .catch((error) => {
            console.error('Error fetching user data:', error);
            setUserData(null);
          })
          .finally(() => {
            setIsAuthReady(true);
          });
      } else {
        setUserData(null);
        setIsAuthReady(true);
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
        .catch(() => {
          // Ignorer les erreurs temporaires réseau
        });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
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
