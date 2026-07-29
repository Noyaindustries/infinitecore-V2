import type { Handler } from "@netlify/functions";
import { netlifyFilesDisabledResponse, netlifyFilesOptionsResponse } from "./_netlifyFilesGuard";

/** Désactivé : uploads uniquement via Express authentifié (server.ts). */
export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return netlifyFilesOptionsResponse("POST");
  return netlifyFilesDisabledResponse("POST");
};
