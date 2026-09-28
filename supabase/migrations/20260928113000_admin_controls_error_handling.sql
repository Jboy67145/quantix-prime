-- Quantix Prime: atomic admin investment cancellation and resilient balance adjustment
-- Expected business failures are surfaced by server actions as structured results.

create or replace function public.admin_cancel_investment_atomic(
  p_user_id uuid,
  p_investment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_investment public.quantix_investments%rowtype;
  v_wallet public.quantix_wallets%rowtype;
  v_bonus public.quantix_ledger_entries%rowtype;
  v_has_bonus boolean := false;
  v_reversal_exists boolean := false;
  v_available bigint;
  v_invested bigint;
  v_new_available bigint;
  v_new_invested bigint;
  v_reason text := nullif(trim(p_reason), '');
begin
  if v_actor is null then raise exception 'Authentication required. Please sign in again.'; end if;
  select role into v_actor_role from public.profiles where id = v_actor;
  if v_actor_role not in ('ADMIN','SUPER_ADMIN') then
    raise exception 'Administrator access required to cancel an investment.';
  end if;
  if p_user_id is null or p_investment_id is null then
    raise exception 'A valid user and investment are required.';
  end if;
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'A clear cancellation reason is required.';
  end if;

  select * into v_investment
  from public.quantix_investments
  where id = p_investment_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Investment not found for the selected user. No changes were made.'; end if;
  if v_investment.status <> 'ACTIVE' then
    raise exception 'This investment is already % and cannot be cancelled again.', v_investment.status;
  end if;

  select * into v_wallet
  from public.quantix_wallets
  where user_id = p_user_id
  for update;
  if not found then raise exception 'User wallet was not found. No changes were made.'; end if;

  v_available := coalesce(v_wallet.available_minor, 0);
  v_invested := coalesce(v_wallet.invested_minor, 0);
  if v_invested < v_investment.principal_minor then
    raise exception 'The wallet invested balance is lower than this investment principal. Review the wallet before cancelling.';
  end if;

  select exists(
    select 1 from public.quantix_ledger_entries
    where user_id = p_user_id
      and type = 'PURCHASE_BONUS_REVERSAL'
      and metadata->>'investmentId' = p_investment_id::text
  ) into v_reversal_exists;
  if v_reversal_exists then
    raise exception 'This investment has already had its purchase bonus reversed. No further changes were made.';
  end if;

  select * into v_bonus
  from public.quantix_ledger_entries
  where user_id = p_user_id
    and type = 'PURCHASE_BONUS'
    and direction = 'CREDIT'
    and metadata->>'investmentId' = p_investment_id::text
  order by created_at desc
  limit 1;
  v_has_bonus := found;

  if v_has_bonus then
    if v_available < v_bonus.amount_minor then
      raise exception 'The wallet available balance is insufficient to reverse the purchase bonus. Current available balance is ₦%.',
        to_char(v_available / 100.0, 'FM9999999990.00');
    end if;
    v_new_available := v_available - v_bonus.amount_minor;
  else
    v_new_available := v_available;
  end if;

  v_new_invested := v_invested - v_investment.principal_minor;

  update public.quantix_wallets
  set available_minor = v_new_available, invested_minor = v_new_invested, updated_at = now()
  where id = v_wallet.id;

  update public.quantix_investments
  set status = 'CANCELLED', matured_at = null
  where id = v_investment.id;

  insert into public.quantix_ledger_entries(
    user_id, reference, type, amount_minor, direction, status, metadata
  ) values (
    p_user_id, 'INV-CANCEL-' || v_investment.id::text, 'INVESTMENT_CANCELLATION',
    v_investment.principal_minor, 'DEBIT', 'POSTED',
    jsonb_build_object('investmentId', v_investment.id, 'reason', v_reason, 'cancelledBy', v_actor)
  );

  if v_has_bonus then
    insert into public.quantix_ledger_entries(
      user_id, reference, type, amount_minor, direction, status, metadata
    ) values (
      p_user_id, 'BONUS-REVERSAL-' || v_investment.id::text, 'PURCHASE_BONUS_REVERSAL',
      v_bonus.amount_minor, 'DEBIT', 'POSTED',
      jsonb_build_object(
        'investmentId', v_investment.id,
        'originalBonusLedgerId', v_bonus.id,
        'reason', v_reason,
        'cancelledBy', v_actor
      )
    );
  end if;

  insert into public.quantix_audit_logs(
    actor_id, actor_role, action, target_type, target_id, reason, before_state, after_state
  ) values (
    v_actor, v_actor_role, 'INVESTMENT_CANCELLED', 'INVESTMENT', v_investment.id::text, v_reason,
    jsonb_build_object(
      'investment', to_jsonb(v_investment),
      'wallet', jsonb_build_object('available_minor', v_available, 'invested_minor', v_invested)
    ),
    jsonb_build_object(
      'investment_status', 'CANCELLED',
      'wallet', jsonb_build_object('available_minor', v_new_available, 'invested_minor', v_new_invested),
      'purchase_bonus_reversed_minor', case when v_has_bonus then v_bonus.amount_minor else 0 end
    )
  );

  return jsonb_build_object(
    'success', true,
    'investment_id', v_investment.id,
    'user_id', p_user_id,
    'status', 'CANCELLED',
    'principal_reversed_minor', v_investment.principal_minor,
    'purchase_bonus_reversed_minor', case when v_has_bonus then v_bonus.amount_minor else 0 end,
    'available_minor', v_new_available,
    'invested_minor', v_new_invested
  );
end;
$$;

revoke all on function public.admin_cancel_investment_atomic(uuid, uuid, text) from public;
grant execute on function public.admin_cancel_investment_atomic(uuid, uuid, text) to authenticated;

create or replace function public.admin_adjust_balance(
  p_user_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_wallet public.quantix_wallets%rowtype;
  v_before bigint;
  v_after bigint;
  v_ref text;
begin
  if v_actor is null then raise exception 'Authentication required. Please sign in again.'; end if;
  select role into v_actor_role from public.profiles where id = v_actor;
  if v_actor_role not in ('ADMIN','SUPER_ADMIN') then raise exception 'Administrator access required.'; end if;
  if p_amount_minor is null or p_amount_minor = 0 then raise exception 'Adjustment amount must be a non-zero value.'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'A reason is required for every balance adjustment.'; end if;

  select * into v_wallet
  from public.quantix_wallets
  where user_id = p_user_id
  for update;
  if not found then raise exception 'User wallet not found. No changes were made.'; end if;

  v_before := coalesce(v_wallet.available_minor, 0);
  v_after := v_before + p_amount_minor;
  if v_after < 0 then raise exception 'Adjustment would make the available balance negative.'; end if;

  update public.quantix_wallets
  set available_minor = v_after, updated_at = now()
  where id = v_wallet.id;

  v_ref := coalesce(nullif(trim(p_reference),''), 'ADMIN-BAL-' || gen_random_uuid()::text);

  insert into public.quantix_ledger_entries(
    user_id, reference, type, amount_minor, direction, status, metadata
  ) values (
    p_user_id, v_ref, 'ADMIN_ADJUSTMENT', abs(p_amount_minor),
    case when p_amount_minor > 0 then 'CREDIT' else 'DEBIT' end,
    'POSTED',
    jsonb_build_object(
      'reason', trim(p_reason), 'actor_id', v_actor,
      'before_minor', v_before, 'after_minor', v_after
    )
  );

  insert into public.quantix_audit_logs(
    actor_id, actor_role, action, target_type, target_id, reason, before_state, after_state
  ) values (
    v_actor, v_actor_role, 'ADJUST_BALANCE', 'WALLET', p_user_id::text,
    trim(p_reason),
    jsonb_build_object('available_minor', v_before),
    jsonb_build_object(
      'available_minor', v_after,
      'delta_minor', p_amount_minor,
      'ledger_reference', v_ref
    )
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'before_minor', v_before,
    'after_minor', v_after,
    'delta_minor', p_amount_minor,
    'reference', v_ref
  );
end;
$$;

revoke all on function public.admin_adjust_balance(uuid, bigint, text, text) from public;
grant execute on function public.admin_adjust_balance(uuid, bigint, text, text) to authenticated;
