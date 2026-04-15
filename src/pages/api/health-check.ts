import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../prismaClient";
import { agentSessionLog } from "@/debug/agentSessionLog";
import { appEnv } from "@/config/env";

export default async function healthCheck(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();

  try {
    // Test simple : compter les comptes utilisateurs
    // timeout court pour ne pas faire pendre le navigateur indéfiniment
    const userCount = await Promise.race([
      prisma.userAccount.count(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Prisma (10s)")), 10000))
    ]);

    const duration = Date.now() - start;
    const payload = {
      status: "DATABASE_CONNECTED",
      durationMs: duration,
      message: "La connexion à MongoDB est opérationnelle."
    };

    if (appEnv.node.isProduction) {
      return res.status(200).json(payload);
    }

    return res.status(200).json({
      ...payload,
      userCount,
      env: {
        DATABASE_URL_PRESENT: !!appEnv.database.url,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV || "local",
      }
    });
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error("[health-check] Erreur:", error);
    agentSessionLog({
      runId: "initial",
      hypothesisId: "H7",
      location: "src/pages/api/health-check.ts",
      message: "health_check_db_failed",
      data: {
        durationMs: duration,
        errMessage: error?.message || String(error),
        databaseUrlPresent: !!appEnv.database.url,
      },
    });

    const payload = {
      status: "DATABASE_ERROR",
      durationMs: duration,
      message: "Échec de la connexion à MongoDB. Vérifiez DATABASE_URL et l'IP Whitelist d'Atlas."
    };

    if (appEnv.node.isProduction) {
      return res.status(503).json(payload);
    }

    return res.status(503).json({
      ...payload,
      error: error.message || String(error),
      env: {
        DATABASE_URL_PRESENT: !!appEnv.database.url,
      },
    });
  }
}
