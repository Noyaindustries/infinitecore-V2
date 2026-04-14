import type { NextConfig } from "next";
import path from "node:path";

const srcDir = path.join(__dirname, "src");
const firebaseAlias = {
  "firebase/app": "./src/lib/mongoApp.ts",
  "firebase/auth": "./src/lib/mongoAuth.ts",
  "firebase/firestore": "./src/lib/mongoFirestore.ts",
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      "@": srcDir,
      ...firebaseAlias,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": srcDir,
      ...firebaseAlias,
    };
    return config;
  },
  /** Le proxy `/api/*` → Express est géré par `src/app/api/[[...path]]/route.ts` (runtime). En prod, définir `API_UPSTREAM`. */
};

export default nextConfig;
