-- ============================================================================
-- 0012_hot_path_indexes.sql — Indexes for hot filter paths
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) for BOTH staging and
-- production. Idempotent — safe to re-run.
--
-- Every invoices query filters by user_id (and the RLS policies re-check it);
-- project detail loads notes/files by project_id; combined-invoice screens
-- filter invoices by project_id. None of these had indexes.
-- ============================================================================

create index if not exists idx_invoices_user_id        on public.invoices (user_id);
create index if not exists idx_invoices_project_id     on public.invoices (project_id);
create index if not exists idx_project_notes_project_id on public.project_notes (project_id);
create index if not exists idx_project_files_project_id on public.project_files (project_id);
