/**
 * Point d’entrée Netlify — le code source partagé est à la racine du dépôt (`padde-ci.ts`).
 * Sans ce fichier, Netlify ne déploie pas la fonction (dossier par défaut : `netlify/functions`).
 */
export { handler } from "../../padde-ci";
