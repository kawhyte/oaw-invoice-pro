-- ============================================================================
-- 0007_project_deliverables.sql — Payment-gated draft/final client deliverables
-- ============================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) BEFORE deploying
-- the app code that reads this table.
--
-- WHY:
--   * The architect uploads a large, print-ready ArchiCAD PDF ONCE. Clients
--     review a lightweight, watermarked, low-res page preview (generated on the
--     uploader's device) that loads fast on slow connections and is useless for
--     printing. The clean original unlocks only when the linked invoice is paid
--     (or via a manual override switch).
--   * This is a NEW table — NOT an extension of project_files — because a single
--     deliverable owns MANY storage objects (1 original PDF + N preview images),
--     whereas project_files assumes exactly one storage_path per row. Keeping
--     deliverables separate also leaves the existing "Save for client" /
--     project_files cleanup paths completely untouched.
--   * linked_invoice_id uses ON DELETE SET NULL (NOT cascade): deleting an
--     invoice must never destroy the architect's drawing — it simply detaches
--     the auto-unlock link, and the file stays controllable via manual_unlock.
--   * storage_path + preview_paths point into the existing private
--     `project-files` bucket. Storage objects are NOT covered by DB cascade, so
--     the delete server action removes them explicitly.
-- ============================================================================

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  storage_path text not null,                          -- original final PDF
  preview_paths jsonb not null default '[]'::jsonb,    -- ordered watermarked page images (~1000px, inline)
  zoom_paths jsonb not null default '[]'::jsonb,       -- ordered high-res page images (~2000px, on-demand zoom)
  page_count int,
  size_bytes int8,
  linked_invoice_id uuid references public.invoices(id) on delete set null,
  manual_unlock boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_deliverables_project_id_idx on public.project_deliverables(project_id);
create index if not exists project_deliverables_invoice_id_idx on public.project_deliverables(linked_invoice_id);

alter table public.project_deliverables enable row level security;

-- Scoped through the parent project's owner, mirroring own_project_files (0001).
-- The public share page uses the service-role client, so its reads bypass RLS
-- exactly as they do for project_files today.
drop policy if exists "own_project_deliverables" on public.project_deliverables;
create policy "own_project_deliverables" on public.project_deliverables
  for all
  using (exists (select 1 from public.projects p
                 where p.id = project_deliverables.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                 where p.id = project_deliverables.project_id and p.user_id = auth.uid()));
