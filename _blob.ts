import { del, get, put } from "@vercel/blob";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

function readBlobToken(): string {
  return (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

export function hasBlobConfig(): boolean {
  return Boolean(readBlobToken());
}

/** Visuels catalogue / branding : URL publique directe (CDN Vercel). */
export function blobFolderIsPublic(folder: string): boolean {
  const normalized = folder.trim().toLowerCase();
  return (
    normalized === "app-catalog" ||
    normalized.startsWith("app-catalog/") ||
    normalized === "branding" ||
    normalized.startsWith("branding/")
  );
}

function blobToken(): string {
  const token = readBlobToken();
  if (!token) throw new Error("Vercel Blob non configuré (BLOB_READ_WRITE_TOKEN).");
  return token;
}

export async function putBlobObject(params: {
  pathname: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  publicAccess: boolean;
}): Promise<{ url: string; pathname: string }> {
  const body = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body);
  const blob = await put(params.pathname, body, {
    access: params.publicAccess ? "public" : "private",
    token: blobToken(),
    contentType: params.contentType || "application/octet-stream",
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteBlobObject(url: string): Promise<void> {
  await del(url, { token: blobToken() });
}

export async function streamBlobObject(url: string): Promise<{
  stream: Readable;
  contentType: string;
}> {
  const result = await get(url, { access: "private", token: blobToken() });
  if (!result) {
    throw new Error("Fichier Blob introuvable.");
  }
  const webStream = result.stream as WebReadableStream<Uint8Array>;
  return {
    stream: Readable.fromWeb(webStream),
    contentType: result.blob.contentType || "application/octet-stream",
  };
}
