import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const cleanEnv = (value?: string) =>
  (value || "").trim().replace(/^['"]+|['"]+$/g, "");

const normalizeUrl = (value: string) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};

const accountId = cleanEnv(process.env.R2_ACCOUNT_ID);
const accessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID);
const secretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY);
const bucket = cleanEnv(process.env.R2_BUCKET_NAME);
const publicBaseUrl = normalizeUrl(cleanEnv(process.env.R2_PUBLIC_BASE_URL));
/** URL publique de l’API (ex. https://infinitecore-api.onrender.com) — pour les liens /api/files/download quand le front est sur un autre domaine. */
const apiPublicBase = normalizeUrl(cleanEnv(process.env.API_PUBLIC_URL)).replace(/\/$/, "");
const endpoint = normalizeUrl(
  cleanEnv(process.env.R2_ENDPOINT) || (accountId ? `${accountId}.r2.cloudflarestorage.com` : "")
);

export const hasR2Config = Boolean(endpoint && accessKeyId && secretAccessKey && bucket);

export const r2Client = hasR2Config
  ? new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

export const r2Bucket = bucket;

export function sanitizeFolder(input: string): string {
  return (
    input
      .replace(/\.\./g, "")
      .replace(/[^a-zA-Z0-9/_-]/g, "")
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "") || "misc"
  );
}

export function sanitizeObjectKey(input: string): string {
  return input.replace(/\.\./g, "").replace(/^\/+/, "");
}

export function buildFileUrl(publicId: string): string {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${publicId}`;
  }
  const q = `?publicId=${encodeURIComponent(publicId)}`;
  if (apiPublicBase) {
    return `${apiPublicBase}/api/files/download${q}`;
  }
  return `/api/files/download${q}`;
}

export async function putObject(params: {
  key: string;
  body: Uint8Array;
  contentType?: string;
  fileName: string;
}) {
  if (!r2Client) throw new Error("R2 non configuré");
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType || "application/octet-stream",
      ContentDisposition: `inline; filename="${params.fileName}"`,
    })
  );
}

export async function deleteObject(key: string) {
  if (!r2Client) throw new Error("R2 non configuré");
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: r2Bucket,
      Key: key,
    })
  );
}

export async function getSignedObjectUrl(key: string): Promise<string> {
  if (!r2Client) throw new Error("R2 non configuré");
  const command = new GetObjectCommand({
    Bucket: r2Bucket,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 60 * 10 });
}
