import { expect, test } from '@playwright/test';
import { authHeaders } from '../helpers/authToken';

const minimalCatalogPayload = {
  apps: [
    {
      id: 'erp-multi-ecole',
      moduleKey: 'erp-multi-ecole',
      title: 'ERP Multi-École',
      desc: 'Test sécurité',
      deliveryLabel: 'Sur devis',
      pricing: [{ type: 'license', price: 350_000, durationDays: 0 }],
      onlineCheckout: true,
    },
  ],
};

test('PUT /api/apps/catalog sans authentification → 401', async ({ request }) => {
  const response = await request.put('/api/apps/catalog', {
    data: minimalCatalogPayload,
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.success).toBe(false);
});

test('PUT /api/apps/catalog en tant que client → 403', async ({ request }) => {
  const response = await request.put('/api/apps/catalog', {
    headers: authHeaders('client'),
    data: minimalCatalogPayload,
  });
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error).toMatch(/administrateur/i);
});

test('PUT /api/apps/catalog admin avec catalogue valide → 200', async ({ request }) => {
  const response = await request.put('/api/apps/catalog', {
    headers: authHeaders('admin'),
    data: minimalCatalogPayload,
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
});

test('PUT /api/apps/catalog sans clé apps → 400', async ({ request }) => {
  const response = await request.put('/api/apps/catalog', {
    headers: authHeaders('admin'),
    data: {},
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/invalide/i);
});

// Validation RDV : couverte par tests/security/appointment.vitest.ts (parseAppointmentBody).
// L’e2e HTTP peut renvoyer 500 si le serveur local réutilisé n’a pas rechargé Express.

test('GET /api/apps/catalog ne fuit pas de secrets', async ({ request }) => {
  const response = await request.get('/api/apps/catalog');
  const text = await response.text();
  expect(text).not.toMatch(/STRIPE_SECRET|sk_live|sk_test|JWT_SECRET|password/i);
});
