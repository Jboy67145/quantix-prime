-- Preserve historical withdrawal references while allowing users to remove saved payout accounts.
alter table public.quantix_payout_accounts
  add column if not exists deleted_at timestamptz;

create index if not exists quantix_payout_accounts_user_active_idx
  on public.quantix_payout_accounts (user_id, created_at desc)
  where deleted_at is null;
