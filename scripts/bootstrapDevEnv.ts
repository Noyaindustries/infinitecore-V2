/** Doit être importé en premier par `devUnified.ts` (avant `src/config/env.ts`). */
const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
env.NODE_ENV ??= "development";
