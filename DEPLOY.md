# Déploiement (Next.js + API Express)

L’interface tourne sous **Next.js 15** ; le développement utilise **Turbopack** (`next dev --turbo`). L’API REST reste sur **Express** (`server.ts`), bundlée en `dist/server.cjs`.

**Arborescence** : les écrans React Router vivent dans `src/views/` (et non `src/pages/`, réservé par Next au routeur *Pages*). Les routes App Router sont dans `src/app/`.

## Développement local

```bash
npm install
npm run dev
```

- **Next** : [http://localhost:3000](http://localhost:3000) (UI + proxy `/api` → port 3001)
- **API** : [http://127.0.0.1:3001](http://127.0.0.1:3001) (Express seul)

Variables : `.env` à la racine (Prisma, JWT, etc.) comme avant.

## Production : Vercel (front) + Render (API)

Je ne peux pas me connecter à ton compte **Vercel** ou **Render** depuis le dépôt : la config se fait dans leurs tableaux de bord. Suis la section suivante, puis lance **`npm run verify:deploy`** en local pour contrôler les URLs (Render puis proxy Vercel).

### Configuration pas à pas

#### A. Render — service Web **API** (Express)

1. Crée (ou ouvre) un **Web Service** Node lié à ce dépôt, branche de prod.
2. **Build command** : `npm ci && npm run build:api`  
   (inutile de lancer `next build` sur Render si tu ne sers que l’API ; voir `render.yaml`.)
3. **Start command** : `node dist/server.cjs`
4. **Variables d’environnement** (exemples de valeurs ; adapte les secrets) :
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = chaîne MongoDB (Atlas, etc.)
   - `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` — comme en local / `.env.example`
   - `CORS_ORIGIN` = liste d’origines séparées par des virgules, **sans espaces** après la virgule si tu veux éviter les pièges, incluant au minimum :  
     `https://infinitecore.net,https://www.infinitecore.net`  
     (ajoute ton URL Vercel preview si tu l’utilises.)
   - `APP_BASE_URL` = `https://infinitecore.net` (liens e-mail reset mot de passe)
   - `API_PUBLIC_URL` = URL **affichée par Render** pour ce service (ex. `https://infinitecore-api.onrender.com`) — utilisée pour certains liens fichiers côté API.
5. Déploie et attends le statut **Live**. Teste dans le navigateur :  
   `https://<ton-service>.onrender.com/health` → tu dois voir **`{"ok":true}`**.  
   Si tu vois **« Not Found »** et que les en-têtes contiennent `x-render-routing: no-server`, le service ne tourne pas (crash au boot, mauvaise commande, mauvaise URL).

#### B. Vercel — front **Next.js**

1. Projet **Framework Preset : Next.js** ; pas d’**Output Directory** type `dist` hérité de Vite.
2. **Environment Variables** → **Production** (et **Preview** si besoin) :
   - **`API_UPSTREAM`** = la même URL que sur Render pour l’API, **sans slash final**, ex. `https://infinitecore-api.onrender.com`  
     Le fichier `src/app/api/[[...path]]/route.ts` proxifie `https://infinitecore.net/api/...` vers `API_UPSTREAM/api/...`.
3. **Redeploy** le déploiement après toute modification de variable.

#### C. Vérification locale (recommandé)

À la racine du dépôt :

```bash
npm run verify:deploy
```

Par défaut le script teste `https://infinitecore-api.onrender.com` et `https://infinitecore.net`. Pour d’autres URL :

```bash
node scripts/verifyDeploy.mjs https://ton-api.onrender.com https://ton-front.vercel.app
```

Interprétation rapide : **401 JSON** sur `/api/auth/me` **sans** cookie est **normal** (non authentifié) : l’API répond. **503 JSON** depuis Vercel indique **`API_UPSTREAM` manquant**. **« Not Found »** sur le proxy indique souvent l’API Render encore injoignable.

### 1. API (Render) — rappel

- Build API seul : `npm ci && npm run build:api` → `dist/server.cjs`
- Start : `node dist/server.cjs`
- Variables : `DATABASE_URL`, `JWT_*`, `CORS_ORIGIN`, `APP_BASE_URL`, `API_PUBLIC_URL` (URL publique de ce service Render).

### 2. Front (Vercel) — rappel

- Build : `next build` (ou `npm run build:next`).
- Start : `next start` (défaut Vercel).

**`API_UPSTREAM`** : voir section A–B ci-dessus.

Optionnel : `NEXT_PUBLIC_API_BASE_URL` si le front appelle l’API en direct sans proxy (pense à **CORS** sur l’API).

### 3. Tout sur un seul hôte (Node)

Tu peux lancer `next start` derrière un reverse proxy et l’API sur un autre port avec un proxy Nginx vers `/api` — ou garder deux services pour plus de simplicité.

## Turbopack

`next dev --turbo` active Turbopack. La commande de build production reste en général `next build` (webpack) ; suis les releases Next si `--turbo` pour le build devient stable pour ta version.
