import { Handler } from "@netlify/functions";
import { getSignedObjectUrl, hasR2Config, sanitizeObjectKey } from "./_r2";
import { readLocalObject } from "./_localUploads";
import { mimeFromStorageKey } from "./storageUtils";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Method Not Allowed" }),
    };
  }

  try {
    const publicId = event.queryStringParameters?.publicId || "";
    if (!publicId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "publicId manquant." }),
      };
    }

    const key = sanitizeObjectKey(publicId);

    if (!hasR2Config) {
      const buf = await readLocalObject(key);
      if (!buf) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: false, error: "Fichier introuvable (stockage local)." }),
        };
      }
      const filename = key.split("/").pop()?.replace(/"/g, "") || "document";
      return {
        statusCode: 200,
        headers: {
          "Content-Type": mimeFromStorageKey(key),
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "private, max-age=3600",
        },
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    }

    const signedUrl = await getSignedObjectUrl(key);
    return {
      statusCode: 302,
      headers: {
        Location: signedUrl,
        "Cache-Control": "no-store",
      },
      body: "",
    };
  } catch (error) {
    console.error("Erreur files-download:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Erreur interne du serveur." }),
    };
  }
};
