import { describe, expect, it } from "vitest";
import { normalizeSmtpPass } from "../../src/server/smtpTransport";

describe("normalizeSmtpPass", () => {
  it("retire les espaces des mots de passe d’application Gmail", () => {
    expect(normalizeSmtpPass("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop");
  });

  it("retire les guillemets copiés depuis .env", () => {
    expect(normalizeSmtpPass('"abcd efgh ijkl mnop"')).toBe("abcdefghijklmnop");
  });

  it("conserve un mot de passe sans espaces", () => {
    expect(normalizeSmtpPass("abcdefghijklmnop")).toBe("abcdefghijklmnop");
  });
});
