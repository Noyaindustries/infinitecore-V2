import { describe, expect, it, vi } from "vitest";
import { blobFolderIsPublic, hasBlobConfig } from "../../_blob";

describe("Vercel Blob storage", () => {
  it("détecte la config via BLOB_READ_WRITE_TOKEN", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
    expect(hasBlobConfig()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("app-catalog est public, le reste privé", () => {
    expect(blobFolderIsPublic("app-catalog")).toBe(true);
    expect(blobFolderIsPublic("app-catalog/erp-multi-ecole")).toBe(true);
    expect(blobFolderIsPublic("chats/usr_123")).toBe(false);
    expect(blobFolderIsPublic("misc")).toBe(false);
  });
});
