-- ============================================================================
-- 0001_rls.sql — Row Level Security
-- ============================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- WHY: The browser ships the anon key. Without RLS, anyone with that key could
-- read/write every user's rows directly via the Supabase REST API, bypassing
-- the app. These policies make Postgres enforce ownership so the app's
-- (sometimes unfiltered) list queries are safe.
--
-- The public client share page (src/app/share/[token]/page.tsx) uses the
-- SERVICE ROLE key, which bypasses RLS — so sharing keeps working.
--
-- Tables with a direct user_id: clients, projects, invoices, business_settings.
-- Child tables are scoped through their parent's user_id.
-- ============================================================================

-- ---- Tables with a direct user_id column -----------------------------------
alter table public.clients            enable row level security;
alter table public.projects           enable row level security;
alter table public.invoices           enable row level security;
alter table public.business_settings  enable row level security;

drop policy if exists "own_clients" on public.clients;
create policy "own_clients" on public.clients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own_projects" on public.projects;
create policy "own_projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own_invoices" on public.invoices;
create policy "own_invoices" on public.invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own_business_settings" on public.business_settings;
create policy "own_business_settings" on public.business_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- Child tables: scoped through the parent's user_id ----------------------
alter table public.project_notes       enable row level security;
alter table public.project_files       enable row level security;
alter table public.invoice_line_items  enable row level security;
alter table public.invoice_payments    enable row level security;

drop policy if exists "own_project_notes" on public.project_notes;
create policy "own_project_notes" on public.project_notes
  for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_notes.project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_notes.project_id and p.user_id = auth.uid()
  ));

drop policy if exists "own_project_files" on public.project_files;
create policy "own_project_files" on public.project_files
  for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_files.project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_files.project_id and p.user_id = auth.uid()
  ));

drop policy if exists "own_invoice_line_items" on public.invoice_line_items;
create policy "own_invoice_line_items" on public.invoice_line_items
  for all
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id and i.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id and i.user_id = auth.uid()
  ));

drop policy if exists "own_invoice_payments" on public.invoice_payments;
create policy "own_invoice_payments" on public.invoice_payments
  for all
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id and i.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id and i.user_id = auth.uid()
  ));
