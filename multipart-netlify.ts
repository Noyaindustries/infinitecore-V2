import busboy from "busboy";

type LambdaLikeEvent = {
  headers: Record<string, string | undefined | string[]>;
  body: string | null;
  isBase64Encoded?: boolean | null;
};

export type ParsedMultipartFile = {
  fieldname: string;
  filename: string;
  content: Buffer;
  contentType: string;
  encoding: string;
};

export type ParsedMultipart = {
  files: ParsedMultipartFile[];
} & Record<string, string | ParsedMultipartFile[]>;

function headerContentType(
  headers: LambdaLikeEvent["headers"],
): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "content-type") continue;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
  }
  return undefined;
}

function bodyBuffer(event: LambdaLikeEvent): Buffer {
  if (!event.body) return Buffer.alloc(0);
  if (event.isBase64Encoded) return Buffer.from(event.body, "base64");
  return Buffer.from(event.body, "latin1");
}

/** Parse multipart/form-data for Netlify / API Gateway–style events (sans dépendance obsolète). */
export function parseMultipartLambdaEvent(
  event: LambdaLikeEvent,
): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const contentType = headerContentType(event.headers);
    if (!contentType) {
      reject(new Error("Content-Type manquant."));
      return;
    }

    const buf = bodyBuffer(event);
    const bb = busboy({
      headers: { "content-type": contentType },
    });

    const result: ParsedMultipart = { files: [] };
    const fileDone: Promise<void>[] = [];

    bb.on("file", (fieldname, stream, info) => {
      fileDone.push(
        new Promise((res, rej) => {
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.once("error", rej);
          stream.once("close", () => {
            result.files.push({
              fieldname,
              filename: info.filename,
              content: Buffer.concat(chunks),
              contentType: info.mimeType,
              encoding: info.encoding,
            });
            res();
          });
        }),
      );
    });

    bb.on("field", (name, value) => {
      result[name] = value;
    });

    bb.once("error", reject);

    bb.on("close", () => {
      void Promise.all(fileDone)
        .then(() => resolve(result))
        .catch(reject);
    });

    try {
      bb.write(buf);
      bb.end();
    } catch (e) {
      reject(e);
    }
  });
}
