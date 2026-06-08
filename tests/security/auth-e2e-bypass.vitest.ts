import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __authE2eTestUtils } from '../../mongoApi';

const { isE2eTestAccountEmail, shouldSkipLoginVerificationForE2e } = __authE2eTestUtils;

describe('sécurité — contournement 2FA e2e', () => {
  const prevSkip = process.env.E2E_SKIP_LOGIN_VERIFICATION;
  const prevDisable = process.env.E2E_DISABLE_TEST_LOGIN_BYPASS;

  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.E2E_SKIP_LOGIN_VERIFICATION;
    delete process.env.E2E_DISABLE_TEST_LOGIN_BYPASS;
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (prevSkip === undefined) delete process.env.E2E_SKIP_LOGIN_VERIFICATION;
    else process.env.E2E_SKIP_LOGIN_VERIFICATION = prevSkip;
    if (prevDisable === undefined) delete process.env.E2E_DISABLE_TEST_LOGIN_BYPASS;
    else process.env.E2E_DISABLE_TEST_LOGIN_BYPASS = prevDisable;
  });

  it('identifie les e-mails de test seed', () => {
    expect(isE2eTestAccountEmail('admin.test@infinitecore.local')).toBe(true);
    expect(isE2eTestAccountEmail('user@example.com')).toBe(false);
  });

  it('contourne la 2FA en dev pour les comptes seed', () => {
    expect(shouldSkipLoginVerificationForE2e('admin.test@infinitecore.local')).toBe(true);
    expect(shouldSkipLoginVerificationForE2e('admin@company.com')).toBe(false);
  });

  it('respecte E2E_DISABLE_TEST_LOGIN_BYPASS=1', () => {
    process.env.E2E_DISABLE_TEST_LOGIN_BYPASS = '1';
    expect(shouldSkipLoginVerificationForE2e('admin.test@infinitecore.local')).toBe(false);
  });

  it("n’active jamais le bypass 2FA en production, même avec E2E_SKIP_LOGIN_VERIFICATION=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.E2E_SKIP_LOGIN_VERIFICATION = "1";
    expect(shouldSkipLoginVerificationForE2e("admin.test@infinitecore.local")).toBe(false);
  });
});
