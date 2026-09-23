-- Quantix Prime: make user deposit submission and wallet investment purchase atomic.
-- Removes dependence on client-side INSERT/UPDATE RLS permissions and prevents concurrent investment races.

create or replace function public.submit_deposit_atomic(
  p_amount_minor bigint,
  p_payment_account_id uuid,
  p_sender_name text,
  p_transfer_reference text,
  p_proof_url text,
  p_payment_proof_name text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_user uuid := auth.uid(); v_account record; v_deposit record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount_minor <= 0 then raise exception 'Deposit amount must be greater than zero'; end if;
  if length(trim(p_sender_name)) < 2 then raise exception 'Enter the sender name used for the transfer'; end if;
  if length(trim(p_transfer_reference)) < 4 then raise exception 'Transfer reference must be at least 4 characters'; end if;
  if p_proof_url is null or length(trim(p_proof_url)) = 0 then raise exception 'Payment proof is required'; end if;
  select * into v_account from public.quantix_payment_accounts where id=p_payment_account_id and active=true;
  if not found then raise exception 'Funding account is not available. Please refresh and select an active account.'; end if;
  insert into public.quantix_deposits(user_id,amount_minor,payment_account_id,transfer_reference,sender_name,proof_url,payment_proof_name,status)
  values(v_user,p_amount_minor,p_payment_account_id,trim(p_transfer_reference),trim(p_sender_name),p_proof_url,p_payment_proof_name,'PENDING')
  returning * into v_deposit;
  return to_jsonb(v_deposit);
end $$;

revoke execute on function public.submit_deposit_atomic(bigint,uuid,text,text,text,text) from public,anon;
grant execute on function public.submit_deposit_atomic(bigint,uuid,text,text,text,text) to authenticated;

create or replace function public.purchase_investment_atomic(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_user uuid := auth.uid(); v_plan record; v_wallet record; v_investment record; v_bonus bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_plan from public.quantix_plans where id=p_plan_id and active=true;
  if not found then raise exception 'This investment plan is unavailable. Please refresh and try again.'; end if;
  select * into v_wallet from public.quantix_wallets where user_id=v_user for update;
  if not found then raise exception 'User wallet is missing'; end if;
  if v_wallet.available_minor < v_plan.minimum_minor then raise exception 'Insufficient wallet balance. Please deposit funds before investing.'; end if;
  v_bonus := coalesce(v_plan.purchase_bonus_minor,0);
  insert into public.quantix_investments(user_id,plan_id,principal_minor,profit_minor,maturity_minor,duration_days_snapshot,return_bps_snapshot,plan_name_snapshot,started_at,matures_at,status)
  values(v_user,v_plan.id,v_plan.minimum_minor,
    round(v_plan.minimum_minor * v_plan.return_bps / 10000.0),
    v_plan.minimum_minor + round(v_plan.minimum_minor * v_plan.return_bps / 10000.0),
    v_plan.duration_days,v_plan.return_bps,v_plan.name,now(),now() + make_interval(days => v_plan.duration_days),'ACTIVE')
  returning * into v_investment;
  update public.quantix_wallets set available_minor=available_minor-v_plan.minimum_minor+v_bonus, invested_minor=invested_minor+v_plan.minimum_minor, updated_at=now() where user_id=v_user;
  insert into public.quantix_ledger_entries(user_id,amount_minor,direction,type,reference,status,metadata)
  values(v_user,v_plan.minimum_minor,'DEBIT','INVESTMENT_PURCHASE','INV-'||v_investment.id,'POSTED',jsonb_build_object('investmentId',v_investment.id,'planId',v_plan.id)),
        (v_user,v_bonus,'CREDIT','PURCHASE_BONUS','BON-'||v_investment.id,'POSTED',jsonb_build_object('investmentId',v_investment.id));
  return to_jsonb(v_investment);
end $$;

revoke execute on function public.purchase_investment_atomic(uuid) from public,anon;
grant execute on function public.purchase_investment_atomic(uuid) to authenticated;
