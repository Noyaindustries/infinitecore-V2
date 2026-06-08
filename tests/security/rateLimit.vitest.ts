import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import {
  applySensitiveRateLimits,
  createRateLimiter,
  isRateLimitEnabled,
  resetRateLimitBucketsForTests,
} from "../../src/server/rateLimit";
import express from "express";
import http from "node:http";

function mockReq(ip = "127.0.0.1"): Request {
  return {
    headers: {},
    socket: { remoteAddress: ip },
  } as Request;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
  } as unknown as Response;
  return { res, getStatus: () => statusCode, getBody: () => body, headers };
}

describe("createRateLimiter", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
  });

  it("autorise jusqu’à max requêtes puis renvoie 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, scope: "test" });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    const { res: res1 } = mockRes();
    limiter(mockReq(), res1, next);
    const { res: res2 } = mockRes();
    limiter(mockReq(), res2, next);
    expect(nextCalls).toBe(2);

    const { res: res3, getStatus, getBody } = mockRes();
    limiter(mockReq(), res3, next);
    expect(getStatus()).toBe(429);
    expect(getBody()).toEqual({ success: false, error: "Trop de requêtes. Réessayez plus tard." });
  });
});

describe("isRateLimitEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reste actif en production même si RATE_LIMIT_DISABLED=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    expect(isRateLimitEnabled()).toBe(true);
  });

  it("peut être désactivé en développement", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    expect(isRateLimitEnabled()).toBe(false);
  });
});

describe("applySensitiveRateLimits", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("monte le middleware auth en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = express();
    app.use(express.json());
    applySensitiveRateLimits(app);
    app.post("/api/auth/login", (_req, res) => res.status(200).json({ ok: true }));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    let lastStatus = 0;
    for (let i = 0; i < 45; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST" });
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    server.close();
    expect(lastStatus).toBe(429);
  });
});
