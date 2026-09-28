-- Speed up the server-side maturity sweep without changing maturity semantics.
create index if not exists quantix_investments_active_matures_at_idx
  on public.quantix_investments (matures_at)
  where status = 'ACTIVE';
