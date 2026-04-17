import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../prismaClient";
import { runDatabaseHealthCheck } from "../../src/lib/runDatabaseHealthCheck";

export default async function healthCheck(_req: NextApiRequest, res: NextApiResponse) {
  const { statusCode, body } = await runDatabaseHealthCheck(prisma);
  return res.status(statusCode).json(body);
}
