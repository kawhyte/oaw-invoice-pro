-- ============================================================================
-- 0005_invoice_saved_pdf.sql — Link saved invoice PDFs back to their invoice
-- ============================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) BEFORE deploying
-- the app code that reads the new column.
--
-- WHY:
--   * The "Save for client" flow generates an invoice PDF and uploads it
--     straight into the project's Files (project_files), skipping the old
--     download-then-reupload round-trip.
--   * invoice_id ties each saved file to the invoice it came from so the flow
--     can REPLACE its own copy on re-save (no stale duplicates) and CLEAN UP
--     when an invoice is deleted, separated, or absorbed into a combined one.
--   * on delete cascade guarantees no orphaned project_files rows even if an
--     invoice is removed by a path we don't touch. Storage objects are NOT
--     covered by DB cascade, so the server actions delete storage explicitly.
-- ============================================================================

alter table public.project_files
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade;

create index if not exists project_files_invoice_id_idx on public.project_files(invoice_id);
