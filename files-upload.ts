import { Handler } from "@netlify/functions";
import { randomUUID } from "crypto";
import { parseMultipartLambdaEvent } from "./multipart-netlify";
import { buildFileUrl, hasR2Config, putObject, sanitizeFolder } from "./_r2";
import { writeLocalObject } from "./_localUploads";

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method Not Allowed" });

  try {
    const parsed = await parseMultipartLambdaEvent(event);
    const file = parsed.files?.[0];
    if (!file?.content) return json(400, { success: false, error: "Aucun fichier reçu." });

    const folder = sanitizeFolder(String(parsed.folder || "misc"));
    const safeOriginal = String(file.filename || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${safeOriginal}`;
    const bodyBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(String(file.content), "binary");
    const contentType = file.contentType || "application/octet-stream";

    if (hasR2Config) {
      await putObject({
        key: objectKey,
        body: bodyBuffer,
        contentType,
        fileName: safeOriginal,
      });
    } else {
      try {
        await writeLocalObject(objectKey, bodyBuffer);
      } catch (e) {
        console.error("Stockage local impossible:", e);
        return json(503, {
          success: false,
          error:
            "R2 non configuré et écriture disque impossible (souvent le cas sur Netlify en prod). " +
            "Soit définissez les variables R2, soit en local lancez `npm run dev` (serveur Express) plutôt que seulement Vite / Netlify Dev sans disque projet.",
        });
      }
    }

    return json(200, {
      success: true,
      url: buildFileUrl(objectKey),
      publicId: objectKey,
      name: safeOriginal,
      size: bodyBuffer.length,
      mimetype: contentType,
    });
  } catch (error) {
    console.error("Erreur files-upload:", error);
    const message = error instanceof Error ? error.message : "Erreur interne du serveur.";
    return json(500, { success: false, error: message });
  }
};
