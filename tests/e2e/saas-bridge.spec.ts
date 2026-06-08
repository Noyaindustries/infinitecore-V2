import { test, expect } from '@playwright/test';

test('GET /api/saas/verify-token rejette un jeton invalide', async ({ request }) => {
  const response = await request.get('/api/saas/verify-token?token=invalid');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.valid).toBeFalsy();
});

test('POST /api/saas/webhooks/subscription-active exige userId et appId', async ({ request }) => {
  const response = await request.post('/api/saas/webhooks/subscription-active', {
    data: { userId: '', appId: '' },
  });
  expect([400, 401]).toContain(response.status());
});
