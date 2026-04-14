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

### 1. API (Render)

- Build : `npm ci && npm run build` (génère `.next` + `dist/server.cjs` ; seul l’API est nécessaire sur Render).
- Start : `node dist/server.cjs`
- `DATABASE_URL`, `JWT_*`, `CORS_ORIGIN` (inclure `https://ton-domaine.vercel.app` et le domaine prod), `APP_BASE_URL`, `API_PUBLIC_URL` (URL publique de ce service Render).

### 2. Front (Vercel)

- Framework : Next.js (détection auto).
- Build : `next build` (ou `npm run build:next`).
- Start : `next start` (par défaut sur Vercel).

Dans **Vercel** → *Environment Variables* :

- `API_UPSTREAM` = URL de l’API Render (ex. `https://infinitecore-api.onrender.com`), sans slash final. Next réécrit `/api/*` vers ce backend.

Optionnel : `NEXT_PUBLIC_API_BASE_URL` si tu n’utilises pas le proxy et que le front appelle l’API en direct (pense à **CORS** sur l’API).

### 3. Tout sur un seul hôte (Node)

Tu peux lancer `next start` derrière un reverse proxy et l’API sur un autre port avec un proxy Nginx vers `/api` — ou garder deux services pour plus de simplicité.

## Turbopack

`next dev --turbo` active Turbopack. La commande de build production reste en général `next build` (webpack) ; suis les releases Next si `--turbo` pour le build devient stable pour ta version.
