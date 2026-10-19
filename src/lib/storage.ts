import 'server-only'
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// The ONLY module that talks to object storage. Provider (Backblaze B2 or
// Cloudflare R2) is chosen purely by env vars — both are S3-compatible.
// Object keys are the existing storage_path values ("<userId>/<projectId>/...")
// plus "logos/<userId>/logo-<ts>.<ext>" for logos.

const bucket = () => {
  const b = process.env.STORAGE_BUCKET
  if (!b) throw new Error('STORAGE_BUCKET is not set')
  return b
}

let _client: S3Client | null = null
function client(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
    // AWS SDK >= 3.729 adds CRC32 checksum headers by default; B2 and R2
    // reject them on presigned browser PUTs (surfaces as a 400/403).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return _client
}

/** Presigned GET. `downloadName` forces a download with that filename. */
export async function signedGetUrl(key: string, expiresInSec: number, downloadName?: string): Promise<string> {
  if (!key) return ''
  return getSignedUrl(client(), new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ...(downloadName ? { ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, '')}"` } : {}),
  }), { expiresIn: expiresInSec })
}

/** Presigned PUT. Content-Type and Content-Length are SIGNED, so the browser
 *  cannot upload a different type or a bigger file than the server approved. */
export async function signedPutUrl(key: string, contentType: string, contentLength: number): Promise<string> {
  return getSignedUrl(client(), new PutObjectCommand({
    Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: contentLength,
  }), { expiresIn: 600, signableHeaders: new Set(['content-type', 'content-length']) })
}

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }))
}

export async function removeObjects(keys: string[]): Promise<void> {
  const list = keys.filter(Boolean)
  for (let i = 0; i < list.length; i += 1000) {
    await client().send(new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: list.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
    }))
  }
}

/** Total bytes stored in the bucket (drives the Dashboard storage meter).
 *  Each page of 1000 objects is one Class C call (2,500/day free) — call it
 *  only from the Dashboard. */
export async function totalBytes(): Promise<number> {
  let total = 0
  let token: string | undefined
  do {
    const res = await client().send(new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token }))
    for (const o of res.Contents ?? []) total += o.Size ?? 0
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return total
}

/** Logo column holds either a legacy absolute URL or a storage key. */
export async function resolveLogoUrl(logo: string | null | undefined): Promise<string | null> {
  if (!logo) return null
  if (/^https?:\/\//.test(logo)) return logo.split('?')[0]
  return signedGetUrl(logo, 3600)
}
