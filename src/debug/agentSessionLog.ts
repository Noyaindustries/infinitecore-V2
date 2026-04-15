/** Logs debug session via ingest endpoint (compatible navigateur + Node). */
export function agentSessionLog(payload: Record<string, unknown>): void {
  // #region agent log
  fetch("http://127.0.0.1:27772/ingest/9581a084-44fc-4752-b649-5a3388314469", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "73b87a" },
    body: JSON.stringify({ sessionId: "73b87a", timestamp: Date.now(), ...payload }),
  }).catch(() => {});
  // #endregion
}
