-- Referral rewards: 5% of the referred user's first approved deposit.
-- Automatic credit occurs inside review_deposit_atomic, in the same transaction
-- as the deposit approval, wallet credit, and ledger entry.

create or replace function public.review_deposit_atomic(p_deposit_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_deposit public.quantix_deposits%rowtype;
  v_wallet public.quantix_wallets%rowtype;
  v_before bigint := 0;
  v_after bigint := 0;
  v_referral public.quantix_referrals%rowtype;
  v_bonus bigint := 0;
  v_first_deposit boolean := false;
begin
  if v_actor is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.profiles where id=v_actor and role in ('ADMIN','SUPER_ADMIN')) then raise exception 'Forbidden'; end if;
  if upper(p_status) not in ('APPROVED','REJECTED') then raise exception 'Invalid deposit status'; end if;

  select * into v_deposit from public.quantix_deposits where id=p_deposit_id for update;
  if not found or upper(v_deposit.status) <> 'PENDING' then raise exception 'Deposit is no longer pending'; end if;

  if upper(p_status)='APPROVED' then
    select * into v_wallet from public.quantix_wallets where user_id=v_deposit.user_id for update;
    if not found then raise exception 'User wallet is missing'; end if;
    v_before := v_wallet.available_minor;
    v_after := v_before + v_deposit.amount_minor;

    update public.quantix_wallets set available_minor=v_after, updated_at=now() where id=v_wallet.id;

    insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
    values(v_deposit.user_id,'deposit:'||v_deposit.id,'DEPOSIT',v_deposit.amount_minor,'CREDIT','POSTED',
      jsonb_build_object('paymentAccountId',v_deposit.payment_account_id,'approvedBy',v_actor));

    select * into v_referral from public.quantix_referrals
      where referred_user_id=v_deposit.user_id
      for update;

    if found and upper(v_referral.status) <> 'QUALIFIED' then
      select not exists (
        select 1 from public.quantix_deposits d
        where d.user_id=v_deposit.user_id
          and d.status='APPROVED'
          and d.id<>v_deposit.id
      ) into v_first_deposit;

      if v_first_deposit then
        v_bonus := floor(v_deposit.amount_minor * 5 / 100);
        if v_bonus > 0 then
          update public.quantix_wallets
          set available_minor=available_minor+v_bonus, updated_at=now()
          where user_id=v_referral.referrer_user_id;
          if not found then raise exception 'Referrer wallet is missing'; end if;

          insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
          values(v_referral.referrer_user_id,'referral-bonus:'||v_referral.id,'REFERRAL_BONUS',v_bonus,'CREDIT','POSTED',
            jsonb_build_object('referralId',v_referral.id,'referredUserId',v_deposit.user_id,'depositId',v_deposit.id,'rate_bps',500,'deposit_amount_minor',v_deposit.amount_minor));

          update public.quantix_referrals
          set status='QUALIFIED',reward_minor=v_bonus,qualified_at=now()
          where id=v_referral.id;
        end if;
      end if;
    end if;
  end if;

  update public.quantix_deposits
  set status=upper(p_status),admin_note=nullif(trim(coalesce(p_reason,'')),''),reviewed_at=now()
  where id=v_deposit.id;

  insert into public.quantix_audit_logs(actor_id,actor_role,action,target_type,target_id,reason,before_state,after_state)
  values(v_actor,(select role from public.profiles where id=v_actor),'DEPOSIT_'||upper(p_status),'DEPOSIT',v_deposit.id::text,
    nullif(trim(coalesce(p_reason,'')),''),
    to_jsonb(v_deposit),
    jsonb_build_object('status',upper(p_status),'wallet_before_minor',v_before,'wallet_after_minor',v_after,'referral_bonus_minor',v_bonus));

  return jsonb_build_object('id',v_deposit.id,'user_id',v_deposit.user_id,'amount_minor',v_deposit.amount_minor,'status',upper(p_status),'referral_bonus_minor',v_bonus);
end;
$function$;

create or replace function public.backfill_referral_bonuses()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  r record;
  v_bonus bigint;
  v_count integer := 0;
  v_total bigint := 0;
begin
  for r in
    select q.id,q.referrer_user_id,q.referred_user_id,first_d.amount_minor,first_d.id deposit_id
    from public.quantix_referrals q
    join lateral (
      select d.id,d.amount_minor
      from public.quantix_deposits d
      where d.user_id=q.referred_user_id and d.status='APPROVED'
      order by d.reviewed_at nulls last,d.created_at,d.id
      limit 1
    ) first_d on true
    where upper(q.status) <> 'QUALIFIED'
    for update of q
  loop
    v_bonus := floor(r.amount_minor * 5 / 100);
    if v_bonus > 0 then
      update public.quantix_wallets set available_minor=available_minor+v_bonus,updated_at=now()
      where user_id=r.referrer_user_id;
      if not found then continue; end if;

      insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
      values(r.referrer_user_id,'referral-bonus:'||r.id,'REFERRAL_BONUS',v_bonus,'CREDIT','POSTED',
        jsonb_build_object('referralId',r.id,'referredUserId',r.referred_user_id,'depositId',r.deposit_id,'rate_bps',500,'deposit_amount_minor',r.amount_minor))
      on conflict (reference) do nothing;

      if found then
        update public.quantix_referrals set status='QUALIFIED',reward_minor=v_bonus,qualified_at=coalesce(qualified_at,now())
        where id=r.id and upper(status)<>'QUALIFIED';
        v_count:=v_count+1;
        v_total:=v_total+v_bonus;
      end if;
    end if;
  end loop;
  return jsonb_build_object('credited_referrals',v_count,'total_bonus_minor',v_total);
end;
$function$;

revoke all on function public.backfill_referral_bonuses() from public, anon, authenticated;
grant execute on function public.backfill_referral_bonuses() to service_role;
