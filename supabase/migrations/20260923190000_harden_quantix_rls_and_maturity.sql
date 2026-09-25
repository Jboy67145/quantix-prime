-- Harden Quantix RLS evaluation and keep maturity processing server-only.
-- Apply only when the corresponding production table/policy exists so a fresh
-- Supabase Preview project can validate this incremental migration safely.

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('public.profiles', 'profiles_self', 'using (id = (select auth.uid())) with check (id = (select auth.uid()))'),
      ('public.quantix_wallets', 'wallets_self', 'using (user_id = (select auth.uid()))'),
      ('public.quantix_payout_accounts', 'payout_self', 'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))'),
      ('public.quantix_investments', 'investments_self', 'using (user_id = (select auth.uid()))'),
      ('public.quantix_ledger_entries', 'ledger_self', 'using (user_id = (select auth.uid()))'),
      ('public.quantix_deposits', 'deposits_self', 'using (user_id = (select auth.uid()))'),
      ('public.quantix_withdrawals', 'withdrawals_self', 'using (user_id = (select auth.uid()))'),
      ('public.quantix_notifications', 'notifications_self', 'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))'),
      ('public.quantix_referrals', 'referrals_self', 'using (referrer_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()))'),
      ('public.quantix_lucky_entries', 'lucky_entries_self', 'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))')
    ) as policies(table_name, policy_name, definition)
  loop
    if to_regclass(item.table_name) is not null and exists (
      select 1 from pg_policies
      where schemaname = split_part(item.table_name, '.', 1)
        and tablename = split_part(item.table_name, '.', 2)
        and policyname = item.policy_name
    ) then
      execute format('alter policy %I on %s %s', item.policy_name, item.table_name, item.definition);
    end if;
  end loop;

  if to_regclass('public.quantix_audit_logs') is not null and exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quantix_audit_logs' and policyname = 'audit_admin_only'
  ) then
    alter policy audit_admin_only on public.quantix_audit_logs
      using (exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'ADMIN'
      ));
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.process_maturity_atomic(uuid)') is not null then
    revoke execute on function public.process_maturity_atomic(uuid) from public, anon, authenticated;
    grant execute on function public.process_maturity_atomic(uuid) to service_role;
  end if;
end $$;
