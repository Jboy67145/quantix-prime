create table if not exists public.quantix_admin_notification_settings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null unique references auth.users(id) on delete cascade,
  withdrawal_enabled boolean not null default true,
  deposit_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quantix_admin_notification_settings enable row level security;

create policy "admins_manage_own_notification_settings"
on public.quantix_admin_notification_settings
for all to authenticated
using (
  admin_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN','SUPER_ADMIN')
  )
)
with check (
  admin_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN','SUPER_ADMIN')
  )
);

create table if not exists public.quantix_notification_config (
  id integer primary key check (id = 1),
  public_key text not null,
  private_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.quantix_notification_config enable row level security;
revoke all on public.quantix_notification_config from anon, authenticated;
grant select on public.quantix_notification_config to service_role;

insert into public.quantix_admin_notification_settings(admin_id)
select id from public.profiles where role in ('ADMIN','SUPER_ADMIN')
on conflict (admin_id) do nothing;

create or replace function public.quantix_admin_notification_for_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  setting record;
  notification_title text;
  notification_body text;
  notification_type text;
begin
  if tg_table_name = 'quantix_withdrawals' then
    notification_type := 'ADMIN_WITHDRAWAL';
    notification_title := 'Important: withdrawal requires approval';
    notification_body := format(
      'A user submitted a withdrawal request for ₦%s. Open Quantix Prime Control Center to review it.',
      to_char(coalesce(new.amount_minor, 0)::numeric / 100, 'FM999G999G999G990.00')
    );
  elsif tg_table_name = 'quantix_deposits' then
    notification_type := 'ADMIN_DEPOSIT';
    notification_title := 'Important: deposit requires approval';
    notification_body := format(
      'A user submitted a deposit for ₦%s with proof of payment. Open Quantix Prime Control Center to review it.',
      to_char(coalesce(new.amount_minor, 0)::numeric / 100, 'FM999G999G999G990.00')
    );
  else
    return new;
  end if;

  for setting in
    select
      p.id,
      coalesce(s.withdrawal_enabled, true) as withdrawal_enabled,
      coalesce(s.deposit_enabled, true) as deposit_enabled
    from public.profiles p
    left join public.quantix_admin_notification_settings s on s.admin_id = p.id
    where p.role in ('ADMIN','SUPER_ADMIN')
      and p.status = 'ACTIVE'
  loop
    if
      (notification_type = 'ADMIN_WITHDRAWAL' and setting.withdrawal_enabled)
      or
      (notification_type = 'ADMIN_DEPOSIT' and setting.deposit_enabled)
    then
      insert into public.quantix_notifications(user_id,title,body,type,delivery_status)
      values(setting.id,notification_title,notification_body,notification_type,'IN_APP');
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.quantix_admin_notification_for_request() from public, anon, authenticated;

drop trigger if exists quantix_admin_withdrawal_notification on public.quantix_withdrawals;
create trigger quantix_admin_withdrawal_notification
after insert on public.quantix_withdrawals
for each row execute function public.quantix_admin_notification_for_request();

drop trigger if exists quantix_admin_deposit_notification on public.quantix_deposits;
create trigger quantix_admin_deposit_notification
after insert on public.quantix_deposits
for each row execute function public.quantix_admin_notification_for_request();

create or replace function public.quantix_push_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://kpoueprpyciqfrqsltta.supabase.co/functions/v1/quantix-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_TKdXl9sJqOhmIhFIv5w6ug_RrF-rKPw'
    ),
    body := jsonb_build_object('notification_id', new.id::text)
  );
  return new;
end;
$$;

revoke execute on function public.quantix_push_notification_after_insert() from public, anon, authenticated;

drop trigger if exists quantix_push_notification_after_insert on public.quantix_notifications;
create trigger quantix_push_notification_after_insert
after insert on public.quantix_notifications
for each row execute function public.quantix_push_notification_after_insert();
