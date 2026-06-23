import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// DigitalOcean Spaces (S3-compatible) — the right home for large media so the
// Postgres DB never has to store/stream video bytes. Configured purely via env;
// when unset, the app falls back to DB storage (see the /upload handler).
const {
  SPACES_KEY,
  SPACES_SECRET,
  SPACES_BUCKET,
  SPACES_REGION,
  SPACES_ENDPOINT, // optional — defaults to https://<region>.digitaloceanspaces.com
  SPACES_CDN, // optional public/CDN base, e.g. https://<bucket>.<region>.cdn.digitaloceanspaces.com
} = process.env;

export const spacesEnabled = Boolean(SPACES_KEY && SPACES_SECRET && SPACES_BUCKET && SPACES_REGION);

const endpoint = SPACES_ENDPOINT || (SPACES_REGION ? `https://${SPACES_REGION}.digitaloceanspaces.com` : undefined);

const client = spacesEnabled
  ? new S3Client({
      region: SPACES_REGION,
      endpoint,
      forcePathStyle: false,
      credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
    })
  : null;

const EXT = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Upload bytes to Spaces and return their public URL. */
export async function uploadToSpaces(buffer, mime) {
  const key = `media/${Date.now()}-${Math.round(Math.random() * 1e9)}${EXT[mime] || ''}`;
  await client.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  const base = SPACES_CDN || `${endpoint}/${SPACES_BUCKET}`;
  return `${base}/${key}`;
}
