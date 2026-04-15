import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../prismaClient";
import { appEnv } from "../../src/config/env";

export default async function healthCheck(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();
  console.log("[health-check] Début du test de santé...");

  try {
    const dbUrl = appEnv.database.url || "NON_DEFINIE";
    const dbMasked = dbUrl.length > 20 ? `${dbUrl.slice(0, 15)}...${dbUrl.slice(-10)}` : dbUrl;

    // Test simple : compter les comptes utilisateurs
    // timeout court pour ne pas faire pendre le navigateur indéfiniment
    const userCount = await Promise.race([
      prisma.userAccount.count(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Prisma (10s)")), 10000))
    ]);

    const duration = Date.now() - start;

    return res.status(200).json({
      status: "DATABASE_CONNECTED",
      durationMs: duration,
      userCount,
      env: {
        DATABASE_URL_PRESENT: !!appEnv.database.url,
        DATABASE_URL_MASKED: dbMasked,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV || "local",
      },
      message: "La connexion à MongoDB est opérationnelle."
    });
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error("[health-check] Erreur:", error);

    return res.status(503).json({
      status: "DATABASE_ERROR",
      durationMs: duration,
      error: error.message || String(error),
      env: {
        DATABASE_URL_PRESENT: !!appEnv.database.url,
      },
      message: "Échec de la connexion à MongoDB. Vérifiez DATABASE_URL et l'IP Whitelist d'Atlas."
    });
  }
}
