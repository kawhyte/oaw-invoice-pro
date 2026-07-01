-- ============================================================================
-- 0010_storage_usage_fn.sql — Total Storage usage, for the in-app storage meter
-- ============================================================================
-- Run in the Supabase SQL editor (or `supabase db push`) for BOTH staging and
-- production. Idempotent — safe to re-run.
--
-- WHY:
--   * The app shows a "Storage — X / 1 GB" meter on the Dashboard so the owner
--     stays under the Free plan's 1 GB file-storage cap.
--   * We need the REAL bytes stored, not a sum of our own size_bytes columns:
--     the Drawings flow uploads many preview/zoom JPEGs whose sizes we never
--     record, and the logos bucket isn't tracked at all — summing our columns
--     would badly UNDERSTATE usage. storage.objects has the true size of every
--     object across every bucket.
--
-- WHY a SECURITY DEFINER function:
--   * The `storage` schema is not exposed through the REST API, so the app
--     can't SELECT storage.objects directly. This function (owned by a
--     privileged role) reads it and is called via .rpc('storage_usage') by the
--     service-role client, server-side only.
--
-- Returns: total bytes stored across ALL buckets (project-files + logos).
-- ============================================================================

create or replace function public.storage_usage()
returns bigint
language sql
security definer
set search_path = storage, public
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects;
$$;

-- Locked down: only the server-side service role may call it.
revoke all on function public.storage_usage() from public, anon, authenticated;
grant execute on function public.storage_usage() to service_role;
