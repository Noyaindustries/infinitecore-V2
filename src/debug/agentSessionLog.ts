const AGENT_DEBUG_ENABLED = process.env.ENABLE_AGENT_DEBUG_LOGS === "1";
const AGENT_DEBUG_ENDPOINT =
  "http://127.0.0.1:27772/ingest/9581a084-44fc-4752-b649-5a3388314469";
const AGENT_DEBUG_SESSION_ID = "73b87a";
const AGENT_DEBUG_TIMEOUT_MS = 250;

/**
 * Debug logs are opt-in only.
 * In serverless production, posting to localhost can hang sockets for tens of seconds.
 */
export function agentSessionLog(payload: Record<string, unknown>): void {
  if (!AGENT_DEBUG_ENABLED) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AGENT_DEBUG_TIMEOUT_MS);

  void fetch(AGENT_DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": AGENT_DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: AGENT_DEBUG_SESSION_ID,
      timestamp: Date.now(),
      ...payload,
    }),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeoutId);
    });
}
