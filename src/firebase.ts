import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp({});
export const db = initializeFirestore(app);
export const auth = getAuth(app);
