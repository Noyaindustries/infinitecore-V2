# Guide d’installation — Infinite Core V2

## Prérequis

- **Node.js** 18+ (idéalement 20+) et **npm**
- **MongoDB** — local ou [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) ; détail dans [MONGODB_SETUP.md](MONGODB_SETUP.md)
- **Git** (optionnel)

## Installation

### 1. Installer les dépendances

```bash
npm install
```

(`postinstall` exécute `prisma generate`.)

### 2. MongoDB

Suis [MONGODB_SETUP.md](MONGODB_SETUP.md), puis prépare l’URL dans l’étape suivante.

### 3. Variables d’environnement

À la racine, copie **`.env.example`** vers **`.env`** et/ou crée **`.env.local`** pour tes secrets (non versionnés).

Minimum pour le développement :

```env
DATABASE_URL="mongodb://127.0.0.1:27017/infinitecore?retryWrites=true&w=majority"
# ou chaîne mongodb+srv://… Atlas — voir MONGODB_SETUP.md

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="remplace-par-une-cle-longue-et-aleatoire"
```

Générer un secret :

```bash
openssl rand -base64 32
```

Variables : **`.env.example`**, **`.env.vercel.example`**, implémentation **`src/config/env.ts`** (+ **`src/config/publicEnv.ts`** pour le client). Détails : [HEBERGEMENT.md](HEBERGEMENT.md) et [DEPLOY.md](DEPLOY.md).

### 4. Initialiser la base de données

```bash
npm run db:generate
npm run db:push
```

Optionnel — données de démonstration (comptes de test + documents liés) :

```bash
npm run seed:test-data
```

Mot de passe commun des comptes seed : variable **`SEED_TEST_PASSWORD`** si tu veux la fixer, sinon défaut **`Test1234!`** (affiché en console à la fin du seed).

### 5. Lancer l’application

```bash
npm run dev
```

Un **seul** processus sert Next.js et l’API Express sur [http://localhost:3000](http://localhost:3000) (`scripts/devUnified.ts`) : `/api/*` et `/health` → Express, le reste → Next.

En cas d’erreurs Next bizarres, supprime le dossier **`.next`** puis relance `npm run dev`.

## Comptes de test (après `seed:test-data`)

| Rôle        | Email |
|-------------|--------|
| admin       | `admin.test@infinitecore.local` |
| commando    | `commando.test@infinitecore.local` |
| developer   | `dev.test@infinitecore.local` |
| partner     | `partner.test@infinitecore.local` |
| client      | `client.test@infinitecore.local` |

Mot de passe : **`SEED_TEST_PASSWORD`** ou **`Test1234!`** par défaut.

Les **nouveaux** comptes créés via l’UI doivent respecter la politique de mot de passe forte (12+ caractères, majuscule, minuscule, chiffre, symbole).

## Structure du dépôt (aperçu)

```
infinitecoreV2/
├── prisma/              # Schéma Prisma (MongoDB)
├── scripts/             # dev unifié, seed, migrations utilitaires
├── src/config/          # Chargement .env + schéma central (env.ts, publicEnv.ts)
├── src/
│   ├── app/             # App Router Next (layout, relais /api sur Vercel, etc.)
│   ├── views/           # Écrans React Router (app métier)
│   ├── components/
│   └── lib/             # Client API, auth « maison », Firestore API-compat
├── server.ts            # Application Express (API)
├── mongoApi.ts          # Routes /api (auth, données…)
└── DEPLOY.md            # Vercel + API séparée, ou déploiement monolithique
```

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Next + API sur le port 3000 (développement) |
| `npm run build` | Build production complet (Next + bundles API + start unifié) |
| `npm run build:vercel` | Next seul (déploiement Vercel, voir `vercel.json`) |
| `npm run start` | Production unifiée (`dist/startUnified.cjs`) |
| `npm run start:api` | API Express seule (`dist/server.cjs` après `build:api`) |
| `npm run db:generate` | Client Prisma |
| `npm run db:push` | Appliquer le schéma sur MongoDB |
| `npm run db:studio` | Prisma Studio |
| `npm run seed:test-data` | Données de test |
| `npm run lint` | `tsc --noEmit` |
| `npm run verify:deploy` | Vérifications HTTP front / API (voir script) |

Il n’y a pas de `db:migrate` classique type SQL : le provider est **MongoDB** (`db:push`).

## Déploiement

Résumé dans **[DEPLOY.md](DEPLOY.md)** ; variables Vercel (même style que `.env.example`) : **[.env.vercel.example](.env.vercel.example)**.

- **Vercel** (Next + Express sous **`/api`**) : variables comme **`.env.example`** sur le projet Vercel — voir **`.env.vercel.example`** et **[DEPLOY.md](DEPLOY.md)**.
- **Un seul serveur Node** : `npm run build` puis `npm start`.

## Dépannage

### Erreurs liées à `node_modules` ou à Next

Réinstalle à la racine du projet :

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache clean --force
npm install
npm run dev
```

Si besoin, régénère le lockfile (attention : versions peuvent bouger) :

```powershell
Remove-Item -Force package-lock.json
npm install
```

### Prisma / MongoDB

Vérifie **`DATABASE_URL`**, les IP autorisées sur Atlas, et que `npm run db:push` a bien été exécuté après un changement de schéma.

## Support

Pour la configuration avancée (e-mail, stockage R2, webhooks), voir **`.env.example`** et le code dans `server.ts` / `mongoApi.ts`.
