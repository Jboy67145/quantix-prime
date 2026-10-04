-- Quantix Prime: configurable per-user purchase limits for each investment plan.
-- A limit of 0 means unlimited and preserves existing plan behavior.
alter table public.quantix_plans
  add column if not exists max_purchases_per_user integer not null default 0;

alter table public.quantix_plans
  drop constraint if exists quantix_plans_max_purchases_per_user_check;
alter table public.quantix_plans
  add constraint quantix_plans_max_purchases_per_user_check
  check (max_purchases_per_user >= 0);

create or replace function public.purchase_investment_atomic(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_plan record;
  v_wallet record;
  v_investment record;
  v_bonus bigint;
  v_profit bigint;
  v_purchase_count bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  -- Lock the plan row so simultaneous purchases cannot race past the limit.
  select * into v_plan
  from public.quantix_plans
  where id=p_plan_id and active=true and deleted_at is null
  for update;
  if not found then
    raise exception 'This investment plan is unavailable. Please refresh and try again.';
  end if;

  if coalesce(v_plan.max_purchases_per_user,0) > 0 then
    select count(*) into v_purchase_count
    from public.quantix_investments
    where user_id=v_user and plan_id=v_plan.id;

    if v_purchase_count >= v_plan.max_purchases_per_user then
      raise exception 'You have reached the purchase limit for this plan (% purchases).', v_plan.max_purchases_per_user;
    end if;
  end if;

  select * into v_wallet
  from public.quantix_wallets
  where user_id=v_user
  for update;
  if not found then raise exception 'User wallet is missing'; end if;
  if v_wallet.available_minor < v_plan.minimum_minor then
    raise exception 'Insufficient wallet balance. Please deposit funds before investing.';
  end if;

  v_bonus := coalesce(v_plan.purchase_bonus_minor,0);
  v_profit := coalesce(v_plan.return_minor, round(v_plan.minimum_minor * v_plan.return_bps / 10000.0));

  insert into public.quantix_investments(
    user_id,plan_id,principal_minor,profit_minor,maturity_minor,duration_days_snapshot,
    return_bps_snapshot,plan_name_snapshot,started_at,matures_at,status
  )
  values(
    v_user,v_plan.id,v_plan.minimum_minor,v_profit,v_plan.minimum_minor+v_profit,
    v_plan.duration_days,v_plan.return_bps,v_plan.name,now(),
    now() + make_interval(days => v_plan.duration_days),'ACTIVE'
  )
  returning * into v_investment;

  update public.quantix_wallets
    set available_minor=available_minor-v_plan.minimum_minor+v_bonus,
        invested_minor=invested_minor+v_plan.minimum_minor,
        updated_at=now()
    where user_id=v_user;

  insert into public.quantix_ledger_entries(user_id,amount_minor,direction,type,reference,status,metadata)
  values
    (v_user,v_plan.minimum_minor,'DEBIT','INVESTMENT_PURCHASE','INV-'||v_investment.id,'POSTED',jsonb_build_object('investmentId',v_investment.id,'planId',v_plan.id)),
    (v_user,v_bonus,'CREDIT','PURCHASE_BONUS','BON-'||v_investment.id,'POSTED',jsonb_build_object('investmentId',v_investment.id));

  return to_jsonb(v_investment);
end;
$$;

revoke execute on function public.purchase_investment_atomic(uuid) from public, anon;
grant execute on function public.purchase_investment_atomic(uuid) to authenticated;
