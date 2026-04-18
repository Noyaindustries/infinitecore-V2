/**
 * Fonction Netlify : relaie les demandes PADDE-CI vers l’API Infinite Core (MongoDB),
 * sans aucun SDK Firebase.
 *
 * Variables Netlify (voir **.env.netlify.example** dans le dépôt) :
 * - INFINITE_CORE_API_URL : URL de l’API Express, sans slash final (ex. https://api.example.com)
 * - PADDE_WEBHOOK_SECRET : optionnel mais recommandé — même valeur que sur l’API
 */
import type { Handler } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { appEnv } from "./src/config/env";

const ALLOWED_ORIGINS = ["https://padde-ci.com", "https://www.padde-ci.com"];

function normalizeHost(raw: string | undefined): string {
  if (!raw) return "";
  const first = raw.split(",")[0].trim();
  return first.replace(/:\d+$/, "").toLowerCase();
}

/** Base HTTPS de l’API (sans slash final). Une seule URL ; si plusieurs sont collées par erreur, on garde la première. */
function apiBase(): string {
  let raw = (appEnv.integrations.infiniteCoreApiUrl || appEnv.http.apiPublicUrl || "").trim();
  if (raw.includes(",")) {
    raw = raw.split(",")[0].trim();
  }
  if (!/^https?:\/\//i.test(raw)) {
    return "";
  }
  return raw.replace(/\/$/, "");
}

export const handler: Handler = async (event) => {
  const reqOrigin = event.headers.origin ?? event.headers.Origin ?? "";
  const corsOrigin =
    reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const base = apiBase();
  if (!base) {
    console.error("padde-ci: INFINITE_CORE_API_URL (ou API_PUBLIC_URL) non défini ou URL invalide (https://… requis).");
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        success: false,
        error:
          "API Infinite Core non configurée : sur Netlify définissez INFINITE_CORE_API_URL (ou API_PUBLIC_URL) = URL HTTPS de l’API Vercel/Express, sans slash final — pas une liste séparée par des virgules.",
      }),
    };
  }

  const incomingHost = normalizeHost(
    String(
      event.headers["x-forwarded-host"] ||
        event.headers["X-Forwarded-Host"] ||
        event.headers.host ||
        event.headers.Host ||
        ""
    )
  );
  let targetHost = "";
  try {
    targetHost = normalizeHost(new URL(base).hostname);
  } catch {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        success: false,
        error: "INFINITE_CORE_API_URL / API_PUBLIC_URL n’est pas une URL HTTP(S) valide.",
      }),
    };
  }
  if (incomingHost && targetHost && incomingHost === targetHost) {
    console.error("padde-ci: boucle — INFINITE_CORE_API_URL pointe vers ce même hôte Netlify.", { incomingHost });
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        success: false,
        error:
          "Configuration Netlify : INFINITE_CORE_API_URL ne doit pas être l’URL de ce site Netlify (boucle infinie). Mettez l’URL où tourne réellement l’API (ex. https://www.infinitecore.net).",
      }),
    };
  }

  const secret = appEnv.webhooks.paddeWebhookSecret.trim();
  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) forwardHeaders["X-Webhook-Secret"] = secret;

  try {
    const target = `${base}/api/webhooks/padde-ci`;

    if (event.httpMethod === "POST") {
      const body = event.body || "{}";
      const res = await fetch(target, {
        method: "POST",
        headers: forwardHeaders,
        body,
      });
      const text = await res.text();
      return { statusCode: res.status, headers, body: text || JSON.stringify({ success: res.ok }) };
    }

    if (event.httpMethod === "GET") {
      const res = await fetch(target, { method: "GET", headers: secret ? { "X-Webhook-Secret": secret } : {} });
      const text = await res.text();
      let audits: unknown = [];
      try {
        audits = JSON.parse(text) as unknown;
      } catch {
        audits = [];
      }
      const normalized = Array.isArray(audits)
        ? audits.map((row: Record<string, unknown>) => ({
            id: row.id ?? randomUUID().slice(0, 8),
            type_audit: row.type_audit ?? row.serviceName ?? "audit",
            date: row.date ?? row.createdAt ?? new Date().toISOString(),
            statut: row.statut ?? row.status ?? "",
            client: row.client ?? row.clientName ?? "",
            donnees_completes: row.donnees_completes ?? row.details ?? row.payload ?? {},
          }))
        : [];
      return {
        statusCode: res.ok ? 200 : res.status,
        headers,
        body: JSON.stringify(normalized),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  } catch (error) {
    console.error("Erreur Netlify Function PADDE-CI:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Erreur interne du serveur." }),
    };
  }
};
