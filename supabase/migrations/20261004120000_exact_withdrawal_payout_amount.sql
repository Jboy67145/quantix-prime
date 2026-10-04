-- Quantix Prime: withdrawal requests pay the exact amount requested.
-- Preserve the original request amount; do not deduct or add a platform withdrawal fee.
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
  update public.quantix_wallets set available_minor=available_minor-p_amount_minor, updated_at=now() where id=v_wallet.id;
  insert into public.quantix_withdrawals(user_id,payout_account_id,amount_minor,fee_minor,net_minor,payout_account_snapshot,status)
  values(v_user,v_account.id,p_amount_minor,0,p_amount_minor,to_jsonb(v_account),'PENDING')
  returning * into v_withdrawal;
  insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
  values(v_user,'WDR-'||v_withdrawal.id,'WITHDRAWAL',p_amount_minor,'DEBIT','PENDING',jsonb_build_object('withdrawalId',v_withdrawal.id,'feeMinor',0,'netMinor',p_amount_minor));
  return jsonb_build_object('id',v_withdrawal.id,'user_id',v_user,'amount_minor',p_amount_minor,'fee_minor',0,'net_minor',p_amount_minor,'status','PENDING');
end;
$function$;
-- Pending requests have not yet been manually paid, so correct their payout amount
-- to the exact requested amount. Leave completed historical records intact.
update public.quantix_withdrawals
set fee_minor=0, net_minor=amount_minor
where status='PENDING'
  and (coalesce(fee_minor,0)<>0 or net_minor<>amount_minor);
