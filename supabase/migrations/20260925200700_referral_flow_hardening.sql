-- Referral flow hardening and atomic referral payout
-- Applied to production Supabase project on 2026-09-25.

create unique index if not exists quantix_referrals_referred_user_unique
  on public.quantix_referrals (referred_user_id);

create index if not exists profiles_invite_code_lower_idx
  on public.profiles (lower(invite_code));

create or replace function public.qualify_referral_atomic(
  p_referral_id uuid,
  p_reward_minor bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_referral public.quantix_referrals%rowtype;
  v_wallet public.quantix_wallets%rowtype;
  v_before bigint;
  v_after bigint;
  v_ref text;
  v_reward bigint := greatest(0, coalesce(p_reward_minor, 0));
begin
  if v_actor is null then raise exception 'Unauthorized'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_actor and role in ('ADMIN','SUPER_ADMIN')
  ) then raise exception 'Forbidden'; end if;

  select * into v_referral
  from public.quantix_referrals
  where id = p_referral_id
  for update;

  if not found then raise exception 'Referral record not found'; end if;
  if v_referral.status = 'QUALIFIED' then
    raise exception 'Referral reward has already been paid';
  end if;
  if v_reward <= 0 then
    raise exception 'Referral reward must be greater than zero before qualification';
  end if;

  select * into v_wallet
  from public.quantix_wallets
  where user_id = v_referral.referrer_user_id
  for update;

  if not found then raise exception 'Referrer wallet is missing'; end if;

  v_before := v_wallet.available_minor;
  v_after := v_before + v_reward;
  v_ref := 'REFERRAL-' || v_referral.id::text;

  update public.quantix_wallets
  set available_minor = v_after, updated_at = now()
  where id = v_wallet.id;

  insert into public.quantix_ledger_entries(
    user_id, reference, type, amount_minor, direction, status, metadata
  ) values (
    v_referral.referrer_user_id,
    v_ref,
    'REFERRAL_REWARD',
    v_reward,
    'CREDIT',
    'POSTED',
    jsonb_build_object(
      'referralId', v_referral.id,
      'referredUserId', v_referral.referred_user_id,
      'inviteCode', v_referral.invite_code,
      'reason', nullif(trim(coalesce(p_reason,'')), ''),
      'actorId', v_actor,
      'beforeMinor', v_before,
      'afterMinor', v_after
    )
  );

  update public.quantix_referrals
  set status = 'QUALIFIED',
      reward_minor = v_reward,
      qualified_at = now()
  where id = v_referral.id;

  insert into public.quantix_audit_logs(
    actor_id, actor_role, action, target_type, target_id, reason, before_state, after_state
  ) values (
    v_actor,
    (select role from public.profiles where id = v_actor),
    'REFERRAL_REWARDED',
    'REFERRAL',
    v_referral.id::text,
    nullif(trim(coalesce(p_reason,'')), ''),
    to_jsonb(v_referral),
    jsonb_build_object(
      'status','QUALIFIED',
      'reward_minor',v_reward,
      'referrer_wallet_before_minor',v_before,
      'referrer_wallet_after_minor',v_after,
      'ledger_reference',v_ref
    )
  );

  return jsonb_build_object(
    'referral_id', v_referral.id,
    'referrer_user_id', v_referral.referrer_user_id,
    'referred_user_id', v_referral.referred_user_id,
    'reward_minor', v_reward,
    'status', 'QUALIFIED',
    'ledger_reference', v_ref
  );
end;
$function$;

revoke execute on function public.qualify_referral_atomic(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.qualify_referral_atomic(uuid,bigint,text) to authenticated;
