import type { NextConfig } from "next";
import path from "node:path";

const srcDir = path.join(__dirname, "src");
const nextConfig: NextConfig = {
  reactStrictMode: true,
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
