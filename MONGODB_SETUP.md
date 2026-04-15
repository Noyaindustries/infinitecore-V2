# MongoDB — installation et connexion

Infinite Core utilise **MongoDB** avec **Prisma** (`prisma/schema.prisma`). La variable **`DATABASE_URL`** doit pointer vers une base accessible depuis ta machine (local) ou depuis l’hôte de l’API (production).

## Option 1 : MongoDB local

1. Installe MongoDB Community : [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Démarre le service (Windows : Services ; macOS/Linux : `mongod` selon ton installation).
3. Exemple d’URL dans `.env` ou `.env.local` :

```env
DATABASE_URL="mongodb://127.0.0.1:27017/infinitecore?retryWrites=true&w=majority"
```

Remplace `infinitecore` par le nom de base souhaité.

## Option 2 : MongoDB Atlas (recommandé hors machine locale)

1. Compte sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crée un cluster (gratuit possible)
3. **Network Access** : autorise ton IP (dev) ou `0.0.0.0/0` pour tester (à resserrer en prod si possible)
4. **Database User** : utilisateur + mot de passe
5. **Connect** → driver **Node.js** → copie l’URI, remplace `<password>` et le nom du cluster si besoin :

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/infinitecore?retryWrites=true&w=majority"
```

## Vérification

Après configuration :

```bash
npm run db:generate
npm run db:push
```

Si `db:push` échoue, vérifie l’URI, le réseau Atlas et que Prisma pointe bien sur `provider = "mongodb"` dans `schema.prisma`.
