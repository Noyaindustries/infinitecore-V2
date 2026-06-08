import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logHttpRequest, logger } from "../../src/server/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("écrit du JSON structuré", () => {
    logger.info("test_event", { foo: "bar" });
    expect(console.log).toHaveBeenCalled();
    const line = String((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe("test_event");
    expect(parsed.level).toBe("info");
    expect(parsed.foo).toBe("bar");
  });

  it("classifie les requêtes HTTP en warn pour 4xx", () => {
    logHttpRequest({
      method: "GET",
      path: "/api/x",
      statusCode: 404,
      durationMs: 12,
      requestId: "req-1",
    });
    const line = String((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("warn");
    expect(parsed.msg).toBe("http_request");
  });
});
