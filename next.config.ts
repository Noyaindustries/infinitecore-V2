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
  /** En dev, proxy /api vers Express (port 3001). En prod Vercel, définir API_UPSTREAM vers l’API Node. */
  async rewrites() {
    const upstream =
      process.env.API_UPSTREAM?.trim() ||
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "");
    if (!upstream) return [];
    const base = upstream.replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${base}/api/:path*` }];
  },
};

export default nextConfig;
