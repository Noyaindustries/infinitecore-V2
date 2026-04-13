import path from "path";
import { promises as fs } from "fs";
import { resolveLocalUploadFile } from "./storageUtils";

export { resolveLocalUploadFile };

export async function writeLocalObject(key: string, body: Buffer): Promise<void> {
  const abs = resolveLocalUploadFile(key);
  if (!abs) throw new Error("Chemin de fichier invalide.");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const abs = resolveLocalUploadFile(key);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw e;
  }
}

export async function unlinkLocalObject(key: string): Promise<void> {
  const abs = resolveLocalUploadFile(key);
  if (!abs) throw new Error("Chemin de fichier invalide.");
  await fs.unlink(abs);
}
