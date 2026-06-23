-- Personal workload ceiling for the solo-worker capacity indicator.
-- RLS on business_settings is already enforced in 0001_rls.sql.
alter table public.business_settings
  add column if not exists max_workload numeric;
