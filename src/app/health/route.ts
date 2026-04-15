import { NextResponse } from "next/server";

/** Santé pour Vercel / load-balancers (l’API Express expose aussi `/health` en dev unifié). */
export async function GET() {
  return NextResponse.json({ ok: true });
}
