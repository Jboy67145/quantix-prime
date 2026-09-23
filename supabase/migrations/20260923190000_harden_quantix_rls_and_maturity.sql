-- Harden Quantix RLS evaluation and keep maturity processing server-only.
-- This migration mirrors the production schema changes applied on 2026-09-23.

alter policy profiles_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy wallets_self on public.quantix_wallets
  using (user_id = (select auth.uid()));

alter policy payout_self on public.quantix_payout_accounts
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy investments_self on public.quantix_investments
  using (user_id = (select auth.uid()));

alter policy ledger_self on public.quantix_ledger_entries
  using (user_id = (select auth.uid()));

alter policy deposits_self on public.quantix_deposits
  using (user_id = (select auth.uid()));

alter policy withdrawals_self on public.quantix_withdrawals
  using (user_id = (select auth.uid()));

alter policy notifications_self on public.quantix_notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy audit_admin_only on public.quantix_audit_logs
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'ADMIN'
  ));

alter policy referrals_self on public.quantix_referrals
  using (referrer_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()));

alter policy lucky_entries_self on public.quantix_lucky_entries
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke execute on function public.process_maturity_atomic(uuid) from public, anon, authenticated;
grant execute on function public.process_maturity_atomic(uuid) to service_role;
