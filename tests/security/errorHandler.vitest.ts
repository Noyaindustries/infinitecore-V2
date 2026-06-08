import { describe, expect, it } from "vitest";
import { formatClientErrorMessage, resolveErrorStatus } from "../../src/server/errorHandler";

describe("errorHandler — pas de fuite de détails", () => {
  it("masque les messages d’erreur internes", () => {
    expect(formatClientErrorMessage(new Error("secret database failure"))).toBe(
      "Erreur interne du serveur."
    );
  });

  it("mappe 413 et 429", () => {
    expect(formatClientErrorMessage({ status: 413 })).toBe("Payload trop volumineux.");
    expect(formatClientErrorMessage({ status: 429 })).toBe("Trop de requêtes. Réessayez plus tard.");
  });

  it("résout le status HTTP", () => {
    expect(resolveErrorStatus({ status: 400 })).toBe(400);
    expect(resolveErrorStatus(new Error("boom"))).toBe(500);
  });
});
