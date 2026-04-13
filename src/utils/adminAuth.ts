import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize a secondary Firebase app instance to avoid logging out the current user
// when creating a new user account (e.g., for admins creating commando/developer accounts).
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export const createUserAsAdmin = async (email: string, password?: string) => {
  // Generate a random password if not provided
  const generatedPassword = password || (() => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  })();
  
  try {
    // Set persistence to in-memory so it doesn't affect the main app's auth state
    await setPersistence(secondaryAuth, inMemoryPersistence);
    
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, generatedPassword);
    const uid = userCredential.user.uid;
    
    // Sign out the secondary auth instance immediately
    await signOut(secondaryAuth);
    
    return {
      uid,
      password: generatedPassword,
      success: true
    };
  } catch (error: any) {
    console.error("Error creating user in secondary app:", error);
    let errorMessage = error.message;
    if (error.code === 'auth/email-already-in-use' || (error.message && error.message.includes('auth/email-already-in-use'))) {
      errorMessage = "Cet email est déjà utilisé par un autre compte.";
    }
    return {
      uid: null,
      password: null,
      success: false,
      error: errorMessage
    };
  }
};
