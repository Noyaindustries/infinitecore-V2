import { describe, expect, it, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { createRateLimiter, resetRateLimitBucketsForTests } from "../../src/server/rateLimit";

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
