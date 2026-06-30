-- ============================================================================
-- 0008_project_files_visibility.sql — Per-file "visible to client" control
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) BEFORE deploying the
-- app code that reads this column.
--
-- WHY:
--   * Until now EVERY file in project_files was automatically downloadable by
--     the client on the share link (including saved invoice PDFs). This adds a
--     per-file switch so the owner controls exactly what's shared.
--   * default true backfills every existing file as visible, so current sharing
--     behavior is UNCHANGED and no data is lost. The share page filters on this
--     column; the owner UI exposes a toggle per file.
-- ============================================================================

alter table public.project_files
  add column if not exists is_client_visible boolean not null default true;
