create table if not exists public.quantix_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.quantix_notification_subscriptions enable row level security;
drop policy if exists notification_subscriptions_self on public.quantix_notification_subscriptions;
create policy notification_subscriptions_self on public.quantix_notification_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index if not exists quantix_notification_subscriptions_user_idx
  on public.quantix_notification_subscriptions(user_id);
grant select, insert, update, delete on public.quantix_notification_subscriptions to authenticated;