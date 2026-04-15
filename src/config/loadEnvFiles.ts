import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseDotEnvFile(raw: string, overrideExisting: boolean) {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (overrideExisting || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

let loaded = false;

/** Charge `.env` puis `.env.local` (priorité au local), une seule fois — aligné sur Next.js. */
export function ensureEnvFilesLoaded(): void {
  if (loaded) return;
  loaded = true;
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const localPath = path.join(root, ".env.local");
  if (existsSync(envPath)) {
    parseDotEnvFile(readFileSync(envPath, "utf8"), false);
  }
  if (existsSync(localPath)) {
    parseDotEnvFile(readFileSync(localPath, "utf8"), true);
  }
}
