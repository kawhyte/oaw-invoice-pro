// One-time: copy Supabase Storage → S3 bucket (Backblaze B2 or Cloudflare R2), keeping
// every object key, then rewrite business_settings.logo_url from a Supabase public URL
// to a storage key. Idempotent: keys already in the bucket are skipped, so it can be
// re-run after the deploy to catch uploads made in between.
//
// Usage:
//   npx dotenv -e .env.staging.local -- node scripts/migrate-storage.mjs --dry-run
//   npx dotenv -e .env.staging.local -- node scripts/migrate-storage.mjs
//   ... --skip-logo   copy files only; leave logo_url alone (use BEFORE deploying the
//                     new code, so the live app's logo keeps working until then)
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const dry = process.argv.includes('--dry-run')
const skipLogo = process.argv.includes('--skip-logo')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const s3 = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  region: process.env.STORAGE_REGION || 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})
const Bucket = process.env.STORAGE_BUCKET

async function listAll(bucket, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null) out.push(...await listAll(bucket, path)) // folder
      else out.push({ path, size: e.metadata?.size ?? 0, type: e.metadata?.mimetype })
    }
    if (data.length < 1000) break
  }
  return out
}

async function exists(Key) {
  try { await s3.send(new HeadObjectCommand({ Bucket, Key })); return true } catch { return false }
}

console.log(`${dry ? '[dry run] ' : ''}Supabase ${process.env.NEXT_PUBLIC_SUPABASE_URL} → ${Bucket}`)
let copied = 0, skipped = 0, bytes = 0, found = 0, foundBytes = 0
for (const [bucket, keyPrefix] of [['project-files', ''], ['logos', 'logos/']]) {
  const objects = await listAll(bucket)
  found += objects.length
  foundBytes += objects.reduce((n, o) => n + o.size, 0)
  console.log(`${bucket}: ${objects.length} objects`)
  for (const o of objects) {
    const Key = keyPrefix + o.path
    if (await exists(Key)) { skipped++; continue }
    if (dry) { copied++; bytes += o.size; continue }
    const { data, error } = await sb.storage.from(bucket).download(o.path)
    if (error) throw new Error(`download ${bucket}/${o.path}: ${error.message}`)
    const body = Buffer.from(await data.arrayBuffer())
    await s3.send(new PutObjectCommand({ Bucket, Key, Body: body, ContentType: o.type || data.type || 'application/octet-stream' }))
    copied++; bytes += body.length
  }
}

// Rewrite logo_url public URLs → storage keys.
const { data: rows, error: rowsErr } = await sb.from('business_settings').select('user_id, logo_url')
if (rowsErr) throw rowsErr
let logos = 0
for (const r of skipLogo ? [] : rows ?? []) {
  const m = r.logo_url && r.logo_url.match(/\/object\/public\/logos\/(.+?)(\?|$)/)
  if (!m) continue
  const key = 'logos/' + decodeURIComponent(m[1])
  logos++
  if (dry) continue
  const { error } = await sb.from('business_settings').update({ logo_url: key }).eq('user_id', r.user_id)
  if (error) throw error
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'
console.log({ found, foundSize: mb(foundBytes), [dry ? 'wouldCopy' : 'copied']: copied, copiedSize: mb(bytes), skippedAlreadyThere: skipped, logoRowsRewritten: skipLogo ? 'skipped' : logos })
