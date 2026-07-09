-- ============================================================================
-- 0011_logos_bucket_limits.sql — Type + size limits on the logos bucket
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) for BOTH staging and
-- production. Idempotent — safe to re-run.
--
-- WHY:
--   * Logo uploads go browser → Supabase Storage DIRECTLY (SettingsForm.tsx),
--     so the client-side "PNG or JPG only / under 2MB" checks are UX only and
--     bypassable with the anon key + a session. 0009 added this floor for
--     project-files; the logos bucket was left unlimited.
--   * logos is a PUBLIC bucket (invoice/header rendering uses getPublicUrl),
--     so anything uploaded is world-readable — the type allowlist keeps
--     HTML/SVG/scripts from ever being publicly served from our origin.
--     (No image/svg+xml on purpose: SVG can carry scripts.)
-- ============================================================================

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg'],
    file_size_limit    = 2097152  -- 2 MB (2 * 1024 * 1024), matches SettingsForm.tsx client check
where id = 'logos';
