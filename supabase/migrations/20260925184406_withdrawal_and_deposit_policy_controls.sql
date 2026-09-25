alter table public.quantix_withdrawal_settings
  drop constraint if exists quantix_withdrawal_settings_minimum_check,
  drop constraint if exists quantix_withdrawal_settings_maximum_check;

alter table public.quantix_withdrawal_settings
  add constraint quantix_withdrawal_settings_minimum_check
    check (minimum_minor >= 100000),
  add constraint quantix_withdrawal_settings_maximum_check
    check (maximum_minor is null or maximum_minor >= minimum_minor);

create table if not exists public.quantix_deposit_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  timezone text not null default 'Africa/Lagos',
  enabled_days text[] not null default array['MON','TUE','WED','THU','FRI'],
  start_time text not null default '09:00',
  end_time text not null default '17:00',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint quantix_deposit_settings_time_check
    check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint quantix_deposit_settings_days_check
    check (cardinality(enabled_days) > 0)
);

insert into public.quantix_deposit_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.quantix_deposit_settings enable row level security;

drop policy if exists deposit_settings_authenticated on public.quantix_deposit_settings;
create policy deposit_settings_authenticated
  on public.quantix_deposit_settings
  for select
  to authenticated
  using (true);

drop policy if exists admins_manage_quantix_deposit_settings on public.quantix_deposit_settings;
create policy admins_manage_quantix_deposit_settings
  on public.quantix_deposit_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('ADMIN','SUPER_ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('ADMIN','SUPER_ADMIN')
    )
  );

create or replace function public.quantix_window_open(
  p_timezone text,
  p_enabled_days text[],
  p_start_time text,
  p_end_time text
) returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_local timestamp;
  v_day text;
  v_time time;
  v_start time := p_start_time::time;
  v_end time := p_end_time::time;
begin
  v_local := now() at time zone p_timezone;
  v_day := upper(trim(to_char(v_local, 'DY')));
  v_time := v_local::time;
  if not (v_day = any(p_enabled_days)) then return false; end if;
  if v_start = v_end then return true; end if;
  if v_start < v_end then return v_time >= v_start and v_time <= v_end; end if;
  return v_time >= v_start or v_time <= v_end;
exception
  when invalid_text_representation or datetime_field_overflow then
    raise exception 'Invalid policy timezone or time configuration.';
end;
$function$;

create or replace function public.request_withdrawal_atomic(p_payout_account_id uuid, p_amount_minor bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid := (select auth.uid());
  v_wallet public.quantix_wallets%rowtype;
  v_account public.quantix_payout_accounts%rowtype;
  v_withdrawal public.quantix_withdrawals%rowtype;
  v_fee bigint;
  v_settings public.quantix_withdrawal_settings%rowtype;
begin
  if v_user is null then raise exception 'Unauthorized'; end if;
  if p_amount_minor <= 0 then raise exception 'Withdrawal amount must be greater than zero'; end if;

  select * into v_settings from public.quantix_withdrawal_settings order by updated_at desc limit 1;
  if found and v_settings.enabled then
    if p_amount_minor < v_settings.minimum_minor then
      raise exception 'Minimum withdrawal amount is ₦% .', to_char(v_settings.minimum_minor / 100.0, 'FM999,999,999,990.00');
    end if;
    if v_settings.maximum_minor is not null and p_amount_minor > v_settings.maximum_minor then
      raise exception 'Maximum withdrawal amount is ₦% .', to_char(v_settings.maximum_minor / 100.0, 'FM999,999,999,990.00');
    end if;
    if not public.quantix_window_open(v_settings.timezone, v_settings.enabled_days, v_settings.start_time, v_settings.end_time) then
      raise exception 'Withdrawals are currently closed. Please try again during the configured withdrawal window.';
    end if;
  end if;

  select * into v_account from public.quantix_payout_accounts where id=p_payout_account_id and user_id=v_user;
  if not found then raise exception 'Payout account not found'; end if;
  select * into v_wallet from public.quantix_wallets where user_id=v_user for update;
  if not found or v_wallet.available_minor < p_amount_minor then raise exception 'Insufficient funds'; end if;

  v_fee := round(p_amount_minor * 0.01);
  update public.quantix_wallets set available_minor=available_minor-p_amount_minor, updated_at=now() where id=v_wallet.id;

  insert into public.quantix_withdrawals(user_id,payout_account_id,amount_minor,fee_minor,net_minor,payout_account_snapshot,status)
  values(v_user,v_account.id,p_amount_minor,v_fee,p_amount_minor-v_fee,to_jsonb(v_account),'PENDING')
  returning * into v_withdrawal;

  insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
  values(v_user,'WDR-'||v_withdrawal.id,'WITHDRAWAL',p_amount_minor,'DEBIT','PENDING',jsonb_build_object('withdrawalId',v_withdrawal.id));

  return jsonb_build_object('id',v_withdrawal.id,'user_id',v_user,'amount_minor',p_amount_minor,'fee_minor',v_fee,'net_minor',p_amount_minor-v_fee,'status','PENDING');
end;
$function$;

create or replace function public.submit_deposit_atomic(
  p_amount_minor bigint,p_payment_account_id uuid,p_sender_name text,p_transfer_reference text,p_proof_url text,p_payment_proof_name text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_account record;
  v_deposit record;
  v_settings public.quantix_deposit_settings%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount_minor <= 0 then raise exception 'Deposit amount must be greater than zero'; end if;
  if length(trim(p_sender_name)) < 2 then raise exception 'Enter the sender name used for the transfer'; end if;
  if length(trim(p_transfer_reference)) < 4 then raise exception 'Transfer reference must be at least 4 characters'; end if;
  if p_proof_url is null or length(trim(p_proof_url)) = 0 then raise exception 'Payment proof is required'; end if;

  select * into v_settings from public.quantix_deposit_settings order by updated_at desc limit 1;
  if found and v_settings.enabled and not public.quantix_window_open(v_settings.timezone, v_settings.enabled_days, v_settings.start_time, v_settings.end_time) then
    raise exception 'Deposits are currently closed. Please try again during the configured deposit window.';
  end if;

  select * into v_account from public.quantix_payment_accounts where id=p_payment_account_id and active=true;
  if not found then raise exception 'Funding account is not available. Please refresh and select an active account.'; end if;

  insert into public.quantix_deposits(user_id,amount_minor,payment_account_id,transfer_reference,sender_name,proof_url,payment_proof_name,status)
  values(v_user,p_amount_minor,p_payment_account_id,trim(p_transfer_reference),trim(p_sender_name),p_proof_url,p_payment_proof_name,'PENDING')
  returning * into v_deposit;
  return to_jsonb(v_deposit);
end;
$function$;