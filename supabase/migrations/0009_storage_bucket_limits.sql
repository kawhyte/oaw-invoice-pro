-- ============================================================================
-- 0009_storage_bucket_limits.sql — Type + size limits on the project-files bucket
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) for BOTH staging and
-- production. Idempotent — safe to re-run.
--
-- WHY:
--   * Uploads go browser → Supabase Storage DIRECTLY; the file bytes never pass
--     through the Next.js server. So the React "PDF only" checks are UX only and
--     are trivially bypassable by anyone with a session + the public anon key.
--   * These bucket limits are enforced by Storage itself no matter what the
--     client sends: they cap file size and keep dangerous types (HTML, SVG,
--     scripts, executables) from ever landing in the bucket.
--
-- WHY image/jpeg is allowed (i.e. NOT PDF-only):
--   * The Drawings flow rasterizes each page into watermarked preview + zoom
--     JPEGs and uploads them into THIS SAME bucket. A PDF-only bucket would
--     break preview generation. The PDF-only *product* rule stays enforced in
--     app code (client guard + server action); the bucket is the security floor
--     (allowed types + size), not the product rule.
--
-- NOTE: Supabase also enforces a PROJECT-WIDE "global file size limit"
--   (Dashboard → Project Settings → Storage). A bucket limit cannot exceed the
--   global one, so ensure the global limit is >= 100 MB or large PDFs still fail.
-- ============================================================================

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg'],
    file_size_limit    = 104857600  -- 100 MB (100 * 1024 * 1024)
where id = 'project-files';
