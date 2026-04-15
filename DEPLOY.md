# Déploiement

Analyse d’hébergement (prérequis, tableaux de variables, checklists) : **[HEBERGEMENT.md](HEBERGEMENT.md)**. Les clés lues au runtime sont définies dans **`src/config/env.ts`** (aligné sur **`.env.example`** / **`.env.vercel.example`**).

- **Vercel (recommandé)** : ce fichier + **`vercel.json`** + variables (voir ci‑dessous) — l’API Express est montée **sur le même projet** via **`pages/api/[[...path]].ts`** et `serverless-http` (pas d’hôte API séparé obligatoire).
- **Tout sur un processus Node** (VPS, autre PaaS) : `npm run build` puis `npm start` — voir fin de page.

En local : **`npm run dev`** — Next + Express sur le même port (`scripts/devUnified.ts`).

## Déploiement Vercel (pas à pas) — tout sur Vercel

1. **Dépôt Git** : pousse ce repo sur GitHub / GitLab / Bitbucket.
2. **[vercel.com](https://vercel.com)** → *Add New…* → *Project* → importe le dépôt. Laisse **Root Directory** à la racine ; le build utilise **`vercel.json`** (`npm ci` puis `npm run build:vercel` = `next build`).
3. **Variables d’environnement** (onglet *Settings* → *Environment Variables*) pour **Production** et **Preview** — recopier le contenu utile de **`.env.example`** sur le projet Vercel (voir **`.env.vercel.example`** pour un modèle commenté). Indispensables en prod :
   - **`DATABASE_URL`**, **`NEXTAUTH_SECRET`** (ou **`JWT_SECRET`**)
   - **`NEXTAUTH_URL`** = URL publique du site (ex. `https://ton-projet.vercel.app`)
   - **`API_PUBLIC_URL`** = en général la **même** base HTTPS que le site (ex. `https://ton-projet.vercel.app`) pour les liens et intégrations
   - **`CORS_ORIGIN`** : inclure au minimum l’origine exacte du site Vercel (souvent identique à `NEXTAUTH_URL` sans chemin)
   - **R2 / SMTP / webhooks** : comme sur **`.env.example`** si tu utilises ces fonctions
4. **Deploy** : *Deployments* → *Redeploy* si tu changes des variables.

En CLI (à la racine du projet, après `npm i -g vercel` ou `npx vercel`) : `vercel` pour un preview, `vercel --prod` pour la production (connexion compte requise).

Routes utiles après déploiement :

- **`GET /health`** (route App Next) — sonde légère.
- **`GET /api/...`** — Express (auth, données, etc.) ; cold start possible.

**Limites** : fonctions serverless (durée max **`vercel.json`** → `maxDuration`), pas de disque persistant pour les uploads — utiliser **R2** (ou équivalent S3) en prod.

## Vercel + API Express sur un autre hôte (optionnel)

Si tu préfères garder l’API sur Render / Railway / un VPS et **ne servir que le front** depuis un autre dépôt ou une autre config, ce n’est **plus** le scénario par défaut de ce repo : ici l’API intégrée à Vercel répond sous **`/api/*`**. Pour un front qui appelle une API **externe**, configure plutôt **`NEXT_PUBLIC_API_BASE_URL`** (URL visible navigateur) et **`CORS_ORIGIN`** sur l’API distante — ou un reverse proxy côté hébergeur.

## Déploiement monolithique (sans Vercel)

`npm run build` → `next build` + `dist/server.cjs` + `dist/startUnified.cjs`, puis **`npm start`** (`node dist/startUnified.cjs`). Variables : voir **`.env.example`** (y compris `DATABASE_URL` sur ce même hôte).

Exemple de blueprint PaaS : **`render.yaml`** (commandes de build/start à aligner avec `package.json`).

## Turbopack

`npm run dev` active Turbopack. Le build prod Vercel utilise **`next build`** (webpack).
