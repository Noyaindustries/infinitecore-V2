import { describe, expect, it } from 'vitest';
import { signSaasAccessToken, verifySaasAccessToken } from '../../src/server/saasAccessToken';

describe('saasAccessToken', () => {
  it('signe et vérifie un jeton SaaS', () => {
    const token = signSaasAccessToken({
      uid: 'user-1',
      appId: 'crm-pro',
      moduleKey: 'crm-pro',
      tenantId: 'user-1__crm-pro',
      email: 'client@test.com',
      stripeSubscriptionId: 'sub_123',
    });
    const payload = verifySaasAccessToken(token);
    expect(payload).toMatchObject({
      uid: 'user-1',
      appId: 'crm-pro',
      moduleKey: 'crm-pro',
      tenantId: 'user-1__crm-pro',
      email: 'client@test.com',
      stripeSubscriptionId: 'sub_123',
    });
  });

  it('rejette un jeton invalide', () => {
    expect(verifySaasAccessToken('not-a-jwt')).toBeNull();
  });
});
