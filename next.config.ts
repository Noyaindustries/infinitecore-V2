import type { NextConfig } from "next";
import path from "node:path";

const srcDir = path.join(__dirname, "src");
const distDir = process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next");
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir,
  turbopack: {
    resolveAlias: {
      "@": srcDir,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": srcDir,
    };
    return config;
  },
  /** API Express sur Vercel : `pages/api/[[...path]].ts` + `serverless-http`. */
};

export default nextConfig;
