// Shared upload limits, used by both the client upload components (friendly
// pre-checks) and the server actions (authoritative validation). Keep in sync
// with the project-files bucket limits in
// supabase/migrations/0009_storage_bucket_limits.sql.
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB
export const MAX_UPLOAD_LABEL = '100 MB'

// Supabase Free plan caps total file storage at 1 GB (shared across all
// buckets). Drives the Dashboard storage meter.
export const FREE_STORAGE_BYTES = 1024 ** 3 // 1 GB

// GB-scale formatter for the storage meter (the MB-scale formatBytes in
// FileList.tsx is for individual files).
export function formatGB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// Cheap magic-byte sniff: a real PDF starts with the bytes "%PDF-". Catches
// files that pass the name/extension check but aren't actually PDFs (e.g. a JPG
// renamed to .pdf) before they ever reach pdf.js. Browser-only (uses File).
export async function looksLikePdf(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d //    -
  )
}
