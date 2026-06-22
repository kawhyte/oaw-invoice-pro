-- ============================================================================
-- 0003_invoice_numbering.sql — Unique invoice numbers + combine source tracking
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) AFTER 0002.
--
--  1. De-duplicates any existing duplicate invoice numbers (a unique index can't
--     be added while duplicates exist). Keeps the EARLIEST row per number and
--     renumbers the later ones to fresh INV-### values above the user's max.
--  2. Adds invoices.source_meta — records each absorbed draft's number at combine
--     time so "Separate" can restore the original per-project numbers.
--  3. Adds a unique index on (user_id, invoice_number).
-- ============================================================================

-- 1. De-duplicate ------------------------------------------------------------
do $$
declare
  r record;
  next_n int;
begin
  for r in (
    select id, user_id, invoice_number,
           row_number() over (partition by user_id, invoice_number order by created_at, id) as rn
    from public.invoices
  ) loop
    if r.rn > 1 then
      -- next free INV number for this user (ignores non-INV numbers like DEMO-*)
      select coalesce(max((substring(invoice_number from '^INV-0*([0-9]+)$'))::int), 0) + 1
        into next_n
      from public.invoices
      where user_id = r.user_id
        and invoice_number ~ '^INV-0*[0-9]+$';

      update public.invoices
         set invoice_number = 'INV-' || lpad(next_n::text, 3, '0')
       where id = r.id;
    end if;
  end loop;
end $$;

-- 2. Source tracking for combine/separate ------------------------------------
alter table public.invoices
  add column if not exists source_meta jsonb;

-- 3. Enforce uniqueness per user ---------------------------------------------
create unique index if not exists invoices_user_number_uniq
  on public.invoices (user_id, invoice_number);
