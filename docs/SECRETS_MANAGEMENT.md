# Gestion et rotation des secrets — Infinite Core V2

Ce document décrit où vivent les secrets, comment les générer, les valider et les **faire tourner** sans interruption de service.

## Principes

1. **Jamais** committer `.env`, `.env.local` ou des clés dans le code (vérification : `npm run verify:git-env`).
2. **Production** : secrets uniquement dans **Vercel → Environment Variables** (ou votre hôte API).
3. **Rotation** : préparer la nouvelle valeur → déployer → révoquer l’ancienne → vérifier les intégrations.
4. **Longueur minimale** : 32 caractères pour les secrets partagés (webhooks, bridge SaaS, JWT).

---

## Inventaire des secrets

| Variable | Rôle | Rotation typique |
|----------|------|-------------------|
| `DATABASE_URL` | MongoDB Atlas | Lors d’un changement de mot de passe DB ou cluster |
| `NEXTAUTH_SECRET` / `JWT_SECRET` | Signature JWT sessions | Tous les 90–180 jours ou après incident |
| `PADDE_WEBHOOK_SECRET` | HMAC webhooks PADDE-CI | Tous les 6–12 mois ; synchroniser avec padde-ci.com |
| `NOYA_RECRUTEMENT_WEBHOOK_SECRET` | Webhooks Noya | Idem |
| `SAAS_BRIDGE_API_KEY` | Bridge apps SaaS (optionnel) | Tous les 6–12 mois |
| `STRIPE_SECRET_KEY` | API Stripe | Rolling keys dans le Dashboard Stripe |
| `STRIPE_WEBHOOK_SECRET` | Signature webhooks Stripe | À chaque endpoint webhook recréé |
| `BLOB_READ_WRITE_TOKEN` | Stockage fichiers Vercel Blob | Rotation via dashboard Vercel → Storage → Blob |
| `R2_*` | Stockage fichiers Cloudflare (secours si Blob absent) | Rotation clés API R2 |
| `SMTP_*` | Envoi d’e-mails | Mot de passe d’application Gmail / provider |

Templates sans secrets : `.env.example`, `.env.vercel.example`, `.env.netlify.example`.

Voir aussi : [`CSRF.md`](./CSRF.md), [`PENTESTING.md`](./PENTESTING.md).

---

## Génération

```bash
# JWT / NEXTAUTH_SECRET (32+ caractères)
npm run generate:nextauth-secret

# Webhooks / bridge (64 caractères hex)
openssl rand -hex 32

# Validation locale avant déploiement
npm run validate:secrets
npm run validate:env
npm run verify:git-env
```

---

## Rotation par secret

### `NEXTAUTH_SECRET` (JWT)

1. Générer une nouvelle clé : `npm run generate:nextauth-secret`.
2. Ajouter sur **Vercel Production** (remplacer l’ancienne).
3. Redéployer l’application.
4. **Effet** : toutes les sessions JWT existantes sont invalidées → les utilisateurs se reconnectent (cookies + éventuellement Bearer legacy).
5. Planifier la rotation en heure creuse.

### `PADDE_WEBHOOK_SECRET` / `NOYA_RECRUTEMENT_WEBHOOK_SECRET`

1. Générer une nouvelle clé (`openssl rand -hex 32`).
2. Mettre à jour **Vercel** et **l’application appelante** (padde-ci.com, Netlify relay, etc.) **dans la même fenêtre**.
3. Tester : `npm run test:padde-webhook` ou `npm run diagnose:padde`.
4. Révoquer l’ancienne valeur côté appelant une fois les 200 confirmés.

### `STRIPE_SECRET_KEY`

1. Dashboard Stripe → Developers → API keys → **Roll key** (ou créer une restricted key).
2. Mettre à jour `STRIPE_SECRET_KEY` sur Vercel.
3. Redéployer ; tester un checkout test (`npm run test:stripe-checkout`).
4. Révoquer l’ancienne clé dans Stripe après validation.

### `STRIPE_WEBHOOK_SECRET`

1. Stripe → Webhooks → endpoint `https://www.infinitecore.net/api/stripe/webhook`.
2. « Roll secret » ou recréer l’endpoint.
3. Copier le nouveau `whsec_...` dans Vercel → `STRIPE_WEBHOOK_SECRET`.
4. Redéployer ; déclencher un événement test depuis Stripe.

### `DATABASE_URL`

1. Atlas → Database Access → modifier le mot de passe utilisateur.
2. Encoder les caractères spéciaux dans l’URL (`@` → `%40`).
3. Mettre à jour Vercel ; redéployer.
4. Vérifier : `https://www.infinitecore.net/api/health-check`.

### `SAAS_BRIDGE_API_KEY`

Optionnel. Si présente, doit faire ≥ 32 caractères. Rotation : nouvelle clé sur Vercel + dans chaque app SaaS consommatrice du bridge.

---

## Checklist déploiement secrets (Production)

- [ ] `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET` (≥ 32 car.)
- [ ] `NEXTAUTH_URL` = `https://www.infinitecore.net`
- [ ] `CORS_ORIGIN` inclut le domaine public HTTPS
- [ ] `PADDE_WEBHOOK_SECRET` (≥ 32 car.)
- [ ] `STRIPE_SECRET_KEY` = `sk_live_...` ou `sk_test_...` (**pas** `pk_`)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...`
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] `npm run validate:secrets` OK en local avec les mêmes valeurs (copie temporaire)

Diagnostic en ligne :

- `GET /api/config-check` — variables présentes + validation démarrage
- `GET /api/health-check` — MongoDB
- `GET /health` — flags `config.*`

---

## Logs d’audit

Les événements d’**authentification** et de **modification de données** sont journalisés en JSON (`audit: true`) dans les logs Vercel.

Persistance MongoDB optionnelle :

```env
AUDIT_LOG_PERSIST=1
```

Collection : `security_audit_logs` (documents `data_documents`). Ne pas activer sans politique de rétention (TTL / export).

---

## Scan des dépendances

- **npm** : `npm audit --audit-level=high` (CI : `npm run test:security:audit`)
- **Dependabot** : `.github/dependabot.yml` (PR hebdomadaires npm + GitHub Actions)
- **Snyk** : workflow `.github/workflows/snyk.yml` (nécessite le secret `SNYK_TOKEN` dans GitHub)

---

## En cas de fuite suspectée

1. Révoquer immédiatement le secret concerné (Stripe, Atlas, webhooks).
2. Générer et déployer une nouvelle valeur.
3. Vérifier les logs d’audit (`audit_event`) sur la période.
4. Forcer la déconnexion (rotation `NEXTAUTH_SECRET`).
5. Documenter l’incident et mettre à jour la date de prochaine rotation planifiée.
