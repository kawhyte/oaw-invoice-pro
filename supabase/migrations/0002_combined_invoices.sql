-- ============================================================================
-- 0002_combined_invoices.sql — Combined (multi-project) invoices
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) AFTER 0001_rls.sql.
--
-- A combined invoice is a normal invoice with project_id = NULL that belongs to
-- a client directly (client_id) and whose line items are grouped by project.
-- These changes are additive and non-breaking: existing single-project invoices
-- keep project_id and a NULL client_id (their client is derived via the project).
-- ============================================================================

-- An invoice may now span multiple projects (combined) → project_id optional.
alter table public.invoices
  alter column project_id drop not null;

-- Direct client link (populated for all NEW invoices; legacy rows stay NULL and
-- fall back to projects.client_id in the app).
alter table public.invoices
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists invoices_client_id_idx on public.invoices(client_id);

-- Line items can be grouped under a project section on a combined invoice.
-- section_title is a snapshot of the project title at billing time so later
-- renames don't alter historical invoices. NULL project_id => ungrouped (legacy
-- / single-project invoices render exactly as before).
alter table public.invoice_line_items
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.invoice_line_items
  add column if not exists section_title text;

create index if not exists invoice_line_items_project_id_idx on public.invoice_line_items(project_id);
