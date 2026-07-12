// DigitalOcean Spaces (S3-compatible) — the right home for large media so the
// Postgres DB never has to store/stream video bytes. Configured purely via env;
// when unset, the app falls back to DB storage (see the /upload handler).
//
// The AWS SDK is imported LAZILY (dynamic import inside uploadToSpaces) so a
// missing/broken dependency can never crash the server at boot — at worst an
// upload fails gracefully while login/leads/site keep working.
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

function toOrigin(u) {
  try { return new URL(u).origin; } catch { return null; }
}
/**
 * Origins that public media URLs actually use — feed these to the CSP img/media
 * allowlist. uploadToSpaces returns `${SPACES_CDN || `${endpoint}/${bucket}`}/…`,
 * so the host is either the CDN origin or the (often region-derived) endpoint
 * origin. Reading raw SPACES_ENDPOINT env missed the derived host, so the CSP
 * blocked the embedded <img>/<video> even though the file opened fine on its own.
 */
export const spacesMediaHosts = spacesEnabled
  ? [...new Set([SPACES_CDN, endpoint].map(toOrigin).filter(Boolean))]
  : [];

const EXT = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    clientPromise = import('@aws-sdk/client-s3').then(
      ({ S3Client }) =>
        new S3Client({
          region: SPACES_REGION,
          endpoint,
          forcePathStyle: false,
          credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
        })
    );
  }
  return clientPromise;
}

/** Upload bytes to Spaces and return their public URL. */
export async function uploadToSpaces(buffer, mime) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getClient();
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
