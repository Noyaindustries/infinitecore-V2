/**
 * Point d’entrée client : « db » + « auth » (API MongoDB / JWT), sans SDK Firebase.
 */
import { initializeApp } from "./mongoApp";
import { getAuth } from "./mongoAuth";
import { initializeFirestore } from "./mongoFirestore";

const app = initializeApp({});
export const db = initializeFirestore(app);
export const auth = getAuth(app);
