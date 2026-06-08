/**
 * Test local du flux Stripe (catalogue + sessions checkout licence / abonnement).
 *
 * Prérequis :
 *   1) `npm run dev` (API sur http://localhost:3000 par défaut)
 *   2) `STRIPE_SECRET_KEY` dans .env / .env.local (clé test sk_test_...)
 *   3) Compte seed : client.test@infinitecore.local / Test1234! (ou SEED_TEST_PASSWORD)
 *
 * Usage (Node 20+) :
 *   npm run dev
 *   node --env-file=.env.local scripts/testStripeCheckout.mjs
 *
 * Webhook local (autre terminal) :
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   Copier whsec_... dans STRIPE_WEBHOOK_SECRET puis redémarrer l'API.
 */

const BASE = String(process.env.API_PUBLIC_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.STRIPE_TEST_EMAIL || "client.test@infinitecore.local";
const PASSWORD = process.env.SEED_TEST_PASSWORD || "Test1234!";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${json.error || text}`);
  }
  return json;
}

async function main() {
  console.log("=== Test Stripe Infinite Core ===\n");
  console.log(`API : ${BASE}`);

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    console.warn("\n⚠ STRIPE_SECRET_KEY absent ou invalide — les checkout échoueront avec 503.");
    console.warn("  Ajoutez une clé test Stripe dans .env.local\n");
  } else {
    console.log("✓ STRIPE_SECRET_KEY détectée");
  }

  const catalog = await request("/api/apps/catalog");
  const sample = catalog.apps?.find((a) => a.id === "erp-multi-ecole") || catalog.apps?.[0];
  if (!sample) throw new Error("Aucune application dans le catalogue.");
  console.log(`✓ Catalogue : ${catalog.apps.length} apps — ${sample.title} licence ${sample.pricing?.find((p) => p.type === "license")?.price ?? "?"} FCFA`);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  if (login.verificationRequired) {
    throw new Error("Connexion 2FA requise — désactivez-la pour le compte test ou utilisez un autre compte.");
  }
  const token = login.token;
  if (!token) throw new Error("Token JWT absent après login.");
  console.log(`✓ Connecté : ${EMAIL}`);

  const licensePricing = sample.pricing.find((p) => p.type === "license");
  if (licensePricing) {
    const licenseCheckout = await request("/api/stripe/checkout/license", {
      method: "POST",
      token,
      body: {
        appId: sample.id,
        appName: sample.title,
        moduleKey: sample.moduleKey || sample.id,
        amount: licensePricing.price,
        licenseDurationDays: licensePricing.durationDays ?? 0,
      },
    });
    console.log("\n--- Licence (one-shot) ---");
    console.log("Order :", licenseCheckout.orderId);
    console.log("URL   :", licenseCheckout.checkoutUrl);
    console.log("→ Ouvrez l'URL et payez avec 4242 4242 4242 4242 (carte test Stripe)");
  }

  const subPricing = sample.pricing.find((p) => p.type === "subscription");
  if (subPricing) {
    const subCheckout = await request("/api/stripe/checkout/subscription", {
      method: "POST",
      token,
      body: {
        serviceId: sample.id,
        serviceName: sample.title,
        moduleKey: sample.moduleKey || sample.id,
        amount: subPricing.price,
        billingCycle: subPricing.billingCycle || "month",
      },
    });
    console.log("\n--- Abonnement ---");
    console.log("Order :", subCheckout.orderId);
    console.log("URL   :", subCheckout.checkoutUrl);
  }

  console.log("\n--- Webhook ---");
  console.log("stripe listen --forward-to localhost:3000/api/stripe/webhook");
  console.log("Puis définir STRIPE_WEBHOOK_SECRET et redémarrer npm run dev.");
  console.log("\nAprès paiement : licence visible dans /dashboard → Mes applications.\n");
}

main().catch((err) => {
  console.error("\nÉchec :", err.message || err);
  process.exit(1);
});
