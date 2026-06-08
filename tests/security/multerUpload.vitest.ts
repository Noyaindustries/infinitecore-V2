import { describe, expect, it } from "vitest";
import { isAllowedUploadMeta } from "../../src/server/multerUpload";

describe("multerUpload — restrictions", () => {
  it("accepte PDF avec bon MIME", () => {
    expect(isAllowedUploadMeta("facture.pdf", "application/pdf")).toBe(true);
  });

  it("rejette une extension exécutable", () => {
    expect(isAllowedUploadMeta("virus.exe", "application/octet-stream")).toBe(false);
  });

  it("rejette un MIME non whitelisté", () => {
    expect(isAllowedUploadMeta("doc.pdf", "application/x-msdownload")).toBe(false);
  });

  it("accepte octet-stream uniquement avec extension autorisée", () => {
    expect(isAllowedUploadMeta("archive.zip", "application/octet-stream")).toBe(true);
  });
});
