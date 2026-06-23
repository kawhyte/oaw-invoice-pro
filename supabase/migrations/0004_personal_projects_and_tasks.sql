-- ============================================================================
-- 0004_personal_projects_and_tasks.sql — Personal projects + task checklists
-- ============================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) BEFORE deploying
-- the app code that reads the new columns.
--
-- WHY:
--   * Personal projects (the owner's own work, e.g. a home renovation) have no
--     client and are not billed. So client_id becomes nullable and an
--     is_personal flag splits them from client work in the UI tabs.
--   * budget supports a simple per-project budget tracker for personal projects.
--   * project_tasks is a check-off todo list available on ALL projects.
-- ============================================================================

-- ---- projects: allow personal (clientless) projects ------------------------
alter table public.projects alter column client_id drop not null;
alter table public.projects add column if not exists is_personal boolean not null default false;
alter table public.projects add column if not exists budget numeric;

-- ---- project_tasks: per-project checklist ----------------------------------
create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  cost        numeric,
  due_date    date,
  completed   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

create index if not exists project_tasks_project_id_idx on public.project_tasks (project_id);

-- ---- RLS: scoped through the parent project's user_id (mirrors notes) -------
alter table public.project_tasks enable row level security;

drop policy if exists "own_project_tasks" on public.project_tasks;
create policy "own_project_tasks" on public.project_tasks
  for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_tasks.project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_tasks.project_id and p.user_id = auth.uid()
  ));
