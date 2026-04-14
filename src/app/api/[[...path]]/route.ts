import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEV_UPSTREAM = "http://127.0.0.1:3001";

/** URL de l’API Express (sans slash final). En dev, défaut : port 3001 (`npm run dev`). */
function resolveExpressOrigin(): string {
  const fromEnv = process.env.API_UPSTREAM?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return DEV_UPSTREAM;
  return "";
}

function buildTargetUrl(pathSegments: string[] | undefined, search: string): string | null {
  const base = resolveExpressOrigin();
  if (!base) return null;
  const subpath = pathSegments?.length ? pathSegments.join("/") : "";
  const suffix = subpath ? `api/${subpath}` : "api";
  return `${base}/${suffix}${search}`;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

async function proxyToExpress(req: NextRequest, pathSegments: string[] | undefined) {
  const target = buildTargetUrl(pathSegments, req.nextUrl.search);
  if (!target) {
    return NextResponse.json(
      {
        success: false,
        error:
          "API indisponible : définissez API_UPSTREAM (URL publique de l’API Express) pour ce déploiement, ou utilisez `npm run dev` avec l’API sur le port 3001.",
      },
      { status: 503 }
    );
  }

  const outHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "host") return;
    outHeaders.set(key, value);
  });

  const method = req.method;
  const init: RequestInit = {
    method,
    headers: outHeaders,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible de joindre l’API Express. En local : lancez `npm run dev` (Next + API) ou `npm run dev:api` sur le port 3001.",
      },
      { status: 502 }
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    resHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToExpress(req, path);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
