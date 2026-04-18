# Potentiel d’hébergement — Infinite Core V2

Ce document décrit les **prérequis, contraintes et options d’hébergement** pour ce dépôt : **Next.js 15** (interface) + **API Express** (`server.ts` / `mongoApi.ts`) + **MongoDB** (Prisma). Ce n’est **pas** le même produit que l’exemple « immobilier / NextAuth / CinetPay / Expo » : ici l’auth est un **JWT maison** (variables nommées comme NextAuth par habitude), les webhooks métier concernent surtout **PADDE-CI**, et les fichiers vont vers **Cloudflare R2** (ou stockage local en dev).

---

## 1. Vue d’ensemble

| Composant | Technologie | Où ça tourne |
|-----------|-------------|--------------|
| **Interface web** | Next.js 15 + React Router (`src/views/`) | Même processus que l’API en dev / monolithe ; sur **Vercel** = `next build` + Express sous **`/api/*`** (fonction serverless) |
| **API métier** | Express 5, Prisma, JWT | **Même** runtime que le front sur Vercel (`pages/api/...`) ; sinon **`npm start`** ou **`start:api`** (`node dist/server.cjs`) sur un autre hôte |
| **Base de données** | MongoDB (Prisma) | **Sur tout hôte qui exécute Prisma** — y compris **Vercel** en mode tout-en-un (`DATABASE_URL` sur le projet) |
| **Auth** | JWT (`Authorization: Bearer`), `localStorage` | Signé sur l’**API** avec `NEXTAUTH_SECRET` / `JWT_SECRET` |
| **Fichiers** | R2 (S3) ou `.local-uploads/` en dev | Config **R2_*** sur l’hôte qui exécute l’API |
| **Clients externes** | Webhooks, app mobile éventuelle | URL **HTTPS** publique de l’**API** ; **CORS** (`CORS_ORIGIN`) si origine différente |

---

## 2. Variables d’environnement

### 2.1 Obligatoires en production (hôte API ou monolithe)

Ces clés sont lues dans le code via **`src/config/env.ts`** (`appEnv.database`, `getJwtSecret()`, `resetAppBaseUrl()`, etc.) — les noms restent alignés sur **`.env.example`**.

| Variable | Rôle |
|----------|------|
| **`DATABASE_URL`** | URI MongoDB (Atlas ou autre). **Uniquement sur l’hôte qui exécute Prisma** (API ou monolithe). Sans elle : erreurs 500 sur auth / données. |
| **`NEXTAUTH_SECRET`** | Secret de signature JWT (nom historique ; repli : **`JWT_SECRET`**). En prod, **obligatoire** sur tout hôte qui signe les tokens (Vercel tout-en-un, API seule, ou monolithe). |
| **`NEXTAUTH_URL`** | URL **publique du site web** vue par l’utilisateur (liens e-mail de reset mot de passe). Ex. `https://ton-app.vercel.app` si le front est sur Vercel, ou `https://www.tondomaine.ci` en prod — **pas** l’URL de l’API seule. En monolithe, c’est souvent la même URL que le service unique. |

### 2.2 Fortement recommandées

| Variable | Rôle |
|----------|------|
| **`JWT_ISSUER`**, **`JWT_AUDIENCE`** | Claims JWT (défauts dans `.env.example`). |
| **`CORS_ORIGIN`** | Liste d’origines séparées par des virgules. Si le front est sur un autre domaine que l’API, **inclure l’origine exacte** (`https://…`). |
| **`API_PUBLIC_URL`** | URL HTTPS **de l’API** (sans `/` final) — liens téléchargement / fichiers ; intégrations (`padde-ci`, etc.). |

### 2.3 Fichiers (production)

| Variable | Rôle |
|----------|------|
| **`R2_ACCOUNT_ID`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`**, **`R2_BUCKET_NAME`** | Stockage objet Cloudflare R2. |
| **`R2_PUBLIC_BASE_URL`** | URL publique du bucket (CDN / domaine R2). |
| **`R2_ENDPOINT`** | Optionnel (dérivé de `R2_ACCOUNT_ID` si absent). |

Sans R2, le serveur peut utiliser un mode fichiers **local** (non adapté à plusieurs instances ou au serverless pur).

### 2.4 E-mail (optionnel)

| Variable | Rôle |
|----------|------|
| **`SMTP_*`**, **`SMTP_FROM`** | Envoi réel des e-mails (reset mot de passe). Sans SMTP, le flux peut rester utilisable en dev avec aperçu de lien. |

### 2.5 Webhooks PADDE-CI (optionnel)

| Variable | Rôle |
|----------|------|
| **`PADDE_WEBHOOK_SECRET`** | Vérification des appels entrants vers l’API. |
| **`INFINITE_CORE_API_URL`** / **`API_PUBLIC_URL`** | Côté **Netlify** (`padde-ci.ts`) pour relayer vers l’API. |

### 2.6 Déploiement **Vercel** (Next + Express intégré)

| Variable | Rôle |
|----------|------|
| **`DATABASE_URL`**, **`NEXTAUTH_SECRET`**, **`NEXTAUTH_URL`**, **`API_PUBLIC_URL`**, **`CORS_ORIGIN`** | Même logique que **§2.1–2.3** : le projet Vercel exécute Prisma et Express (voir **`.env.vercel.example`**). |
| **`NEXT_PUBLIC_API_BASE_URL`** | Utile seulement si le **navigateur** doit parler à une API sur **un autre domaine** (CORS requis) — ce n’est pas le modèle par défaut. |

Après chaque changement de variables Vercel : **Redeploy** (Production **et** Preview).

### 2.7 Clients mobiles ou SPA externes

S’ils appellent l’**API** sur un domaine dédié :

- Définir **`CORS_ORIGIN`** sur l’API avec l’origine du client (ou mécanisme équivalent).
- Utiliser l’URL HTTPS de l’API (souvent la même que **`API_PUBLIC_URL`**).

Pas de variable `EXPO_PUBLIC_*` dans ce dépôt : à ajouter côté projet mobile si besoin.

### 2.8 Développement / outils

| Variable | Rôle |
|----------|------|
| **`SEED_TEST_PASSWORD`** | Mot de passe des comptes créés par `npm run seed:test-data`. |
| **`PORT`**, **`HOST`** | Port / interface d’écoute (`startUnified`, dev unifié). |
| **`VERIFY_API_URL`**, **`VERIFY_FRONT_URL`** | Script `npm run verify:deploy`. |

Références groupées : **`.env.example`**, **`.env.vercel.example`**. **Schéma unique dans le code** : `src/config/env.ts` (serveur / API / scripts) et `src/config/publicEnv.ts` (`NEXT_PUBLIC_*` uniquement, importable côté client).

---

## 3. Contraintes techniques

### Runtime

- **Node.js** 18+ (idéalement 20+), aligné avec `package.json` / esbuild.
- **Rate limiting auth** : logique en mémoire dans `mongoApi.ts` (fenêtres par IP / e-mail). En **plusieurs instances** sans sticky sessions, le blocage n’est pas partagé ; pour un rate limit global, prévoir **Redis** (ex. Upstash) dans une évolution future.

### Base de données

- **MongoDB** + Prisma : `db:push` (pas de migrations SQL classiques).
- **Atlas** : autoriser les IP sortantes de l’hôte API (ou `0.0.0.0/0` pour tests, à resserrer).

### Fichiers

- **Production scalable** : **R2** (ou autre S3-compatible). Le disque du conteneur **Vercel** n’est pas un stockage persistant pour les uploads métier.
- En **monolithe** un seul nœud, R2 reste la option la plus sûre si tu scales horizontalement plus tard.

### Webhooks

- Toute URL de callback (PADDE, etc.) doit pointer vers l’**API** en **HTTPS** publique.

### CORS

- Géré dans **`server.ts`** (Express). Pas de `Access-Control-Allow-Origin: *` imposé par ce dépôt : les origines sont listées dans **`CORS_ORIGIN`**.

---

## 4. Options d’hébergement

| Modèle | Description |
|--------|-------------|
| **Vercel tout-en-un** | `vercel.json`, `npm run build:vercel`. Variables §2.1–2.5 sur le **projet Vercel** (Prisma + Express serverless sous `/api`). |
| **Vercel + API séparée** | Possible en architecture custom (front qui appelle une autre origine) ; ce dépôt vise par défaut l’intégration sous **`/api`**. |
| **Un seul processus Node** | `npm run build` puis **`npm start`** (`dist/startUnified.cjs`) — Railway, Render, Fly, VPS, etc. Toutes les variables §2.1–2.5 sur **ce** service. |
| **VPS + Nginx** | Reverse proxy TLS vers `PORT` interne ; même binaire unifié ou API seule + front statique (hors scope si tu retires Next). |
| **Docker** | Aucun `Dockerfile` fourni par défaut ; tu peux image `node:20-alpine`, copier le repo, `npm ci && npm run build`, `CMD ["node","dist/startUnified.cjs"]`, variables d’env injectées. |

---

## 5. Vercel — inscription / connexion qui échouent

| Cause fréquente | Vérification |
|-----------------|--------------|
| Variables manquantes sur Vercel | **`DATABASE_URL`**, **`NEXTAUTH_SECRET`**, **`NEXTAUTH_URL`**, **`API_PUBLIC_URL`**, **`CORS_ORIGIN`** (Production **et** Preview). |
| Timeout / cold start | Requêtes longues ou Mongo lent ; voir **`vercel.json`** (`maxDuration`). |
| CORS | **`CORS_ORIGIN`** doit inclure l’origine **exacte** du site (`https://xxx.vercel.app`). |
| Après login, pas de redirection | **`GET /api/auth/me`** doit répondre (401 si non connecté). Sinon JWT, cookies, ou erreur 500 (logs Vercel / fonction). |

Détail opérationnel : **[DEPLOY.md](DEPLOY.md)**.

---

## 6. Checklist avant mise en production

- [ ] **`NEXTAUTH_URL`** = URL publique HTTPS du site (sans `/` final sauf besoin réel).
- [ ] **`NEXTAUTH_SECRET`** (ou `JWT_SECRET`) fort, jamais commité.
- [ ] **`DATABASE_URL`** sur l’hôte qui exécute Prisma (API ou monolithe).
- [ ] **`CORS_ORIGIN`** aligné avec le(s) domaine(s) du front (et Preview Vercel si utile).
- [ ] **Vercel** : variables **§2.6** + redeploy ; Preview **et** Production.
- [ ] **Fichiers** : R2 (ou stratégie objet) si plus d’une instance ou hébergement éphémère.
- [ ] **`API_PUBLIC_URL`** cohérent avec l’URL réelle de l’API pour les liens et webhooks.

---

## 7. Résumé

| Critère | Infinite Core V2 |
|---------|------------------|
| PaaS type Vercel (Next + API) | Oui — **un seul projet** avec Prisma/Express sur **`/api`**. |
| Monolithe Node | Oui (`npm start`). |
| MongoDB | Externe (Atlas recommandé). |
| Fichiers prod | **R2** recommandé. |
| Webhooks | HTTPS public vers l’API ; secrets dédiés. |

**Conclusion** : le projet est hébergeable en **Vercel tout-en-un**, **monolithe Node**, ou architectures **split** sur mesure. Les points critiques sont : **variables complètes sur l’hôte qui exécute Prisma**, **CORS**, **MongoDB + secret JWT**, et **stockage objet** (R2) pour les fichiers en serverless.

---

## 8. Dépannage — webhooks PADDE-CI « rien ne passe »

### 8.1 Formulaire padde-ci.com : où envoyer le POST ?

Deux modèles valides (ne pas mélanger sans le vouloir) :

| Modèle | URL à configurer côté formulaire | Variables |
|--------|-----------------------------------|-----------|
| **A — Direct vers l’API Vercel** | `https://www.infinitecore.net/api/webhooks/padde-ci` (ou `/direct` depuis le navigateur padde-ci.com) | **`PADDE_WEBHOOK_SECRET`** identique sur **Vercel** et dans le formulaire / header `X-Webhook-Secret`. Netlify **non utilisé** pour ce flux. |
| **B — Relais Netlify** | `https://VOTRE-SITE.netlify.app/api/webhooks/padde-ci` | Sur **Netlify** : **`INFINITE_CORE_API_URL`** = base **Vercel** (ex. `https://www.infinitecore.net`), **pas** l’URL Netlify elle-même. **`PADDE_WEBHOOK_SECRET`** = même valeur que sur Vercel. |

### 8.2 Causes fréquentes

1. **Boucle Netlify** : `INFINITE_CORE_API_URL` pointe vers le même hôte que le site Netlify → le handler `padde-ci` relaie vers lui-même. Corriger vers l’URL Vercel (voir message d’erreur JSON renvoyé par la fonction).
2. **`PADDE_WEBHOOK_SECRET`** différent entre l’appelant et Vercel → **401** sur l’API (corps souvent `Webhook non autorisé`).
3. **`DATABASE_URL`** absent ou erroné sur **Vercel** → **503** ou **500** après réception du POST (Prisma ne peut pas écrire).
4. **Liste d’URL dans une variable** (virgules dans `INFINITE_CORE_API_URL` ou `NEXTAUTH_URL`) → URL invalide ; utiliser **une seule** URL pour ces clés (sauf `CORS_ORIGIN` qui est prévu multi-origines).
5. **Admin « Audits PADDE-CI » vide** alors que le webhook répond 200 : déployer la version qui liste via **`GET /api/webhooks/padde-ci`** (table `padde_ci_audits`) ; vérifier que vous êtes connecté **admin** ou **commando** sur le **même domaine** que l’API.

### 8.3 Vérification rapide

**État de la config sur l’API (sans secret, sans auth)** — ouvrir dans le navigateur ou `curl` :

`https://www.infinitecore.net/api/webhooks/padde-ci/config-check`

Réponse JSON : `databaseConfigured`, `webhookSecretConfigured`, `vercelEnv` (sur Vercel : `production` vs `preview` — les variables d’environnement **ne sont pas les mêmes** entre Preview et Production).

**Script tout-en-un** (config-check + POST test + option relais Netlify) :

```bash
npm run diagnose:padde -- --api https://www.infinitecore.net
# avec relais Netlify :
npm run diagnose:padde -- --api https://www.infinitecore.net --netlify https://VOTRE-SITE.netlify.app
```

Test webhook seul (corps complet) :

```bash
node --env-file=.env scripts/testPaddeWebhook.mjs --url https://www.infinitecore.net/api/webhooks/padde-ci
```

Si **200** + `success: true` : l’API enregistre. Si **401** : secret différent ou mauvais environnement Vercel (Preview vs Production). Si **timeout / 5xx** : Mongo, cold start, ou URL incorrecte.
