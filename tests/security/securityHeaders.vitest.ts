import { describe, expect, it } from "vitest";
import {
  buildApiContentSecurityPolicyDirectives,
  buildWebContentSecurityPolicyDirectives,
  formatCspHeader,
} from "../../src/server/securityHeaders";

describe("securityHeaders CSP", () => {
  it("API : default-src none", () => {
    const api = buildApiContentSecurityPolicyDirectives();
    expect(api.defaultSrc).toEqual(["'none'"]);
    expect(formatCspHeader(api)).toContain("default-src 'none'");
  });

  it("Web prod : inclut Google OAuth et Stripe", () => {
    const web = buildWebContentSecurityPolicyDirectives(true);
    expect(web.scriptSrc).toContain("https://accounts.google.com");
    expect(web.formAction).toContain("https://checkout.stripe.com");
    expect(formatCspHeader(web)).toContain("upgrade-insecure-requests");
  });

  it("Web dev : autorise unsafe-eval pour Next", () => {
    const web = buildWebContentSecurityPolicyDirectives(false);
    expect(web.scriptSrc).toContain("'unsafe-eval'");
  });
});
