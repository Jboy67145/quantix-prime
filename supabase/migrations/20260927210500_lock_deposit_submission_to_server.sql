drop function if exists public.submit_deposit_secure(text,bigint,uuid,text,text,text,text,text,text);

create or replace function public.submit_deposit_secure(
  p_user_id uuid,
  p_deposit_reference text,
  p_amount_minor bigint,
  p_payment_account_id uuid,
  p_sender_name text,
  p_transfer_reference text,
  p_proof_url text,
  p_payment_proof_name text,
  p_proof_sha256 text,
  p_transaction_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_account record;
  v_deposit record;
  v_settings public.quantix_deposit_settings%rowtype;
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount_minor <= 0 then raise exception 'Deposit amount must be greater than zero'; end if;
  if p_deposit_reference !~ '^QP-[A-Z0-9]{10}$' then raise exception 'Invalid deposit reference'; end if;
  if length(trim(p_sender_name)) < 2 then raise exception 'Enter the sender name used for the transfer'; end if;
  if length(trim(p_transfer_reference)) < 4 then raise exception 'Bank transaction reference must be at least 4 characters'; end if;
  if p_proof_url is null or length(trim(p_proof_url)) = 0 then raise exception 'Payment proof is required'; end if;
  if p_proof_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid payment proof fingerprint'; end if;
  if p_transaction_fingerprint is null or p_transaction_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid transaction fingerprint'; end if;
  if p_proof_url !~ ('^' || p_user_id::text || '/') or p_proof_url like '%..%' then raise exception 'Payment proof is invalid'; end if;

  select * into v_settings from public.quantix_deposit_settings order by updated_at desc limit 1;
  if found and v_settings.enabled and not public.quantix_window_open(v_settings.timezone, v_settings.enabled_days, v_settings.start_time, v_settings.end_time) then
    raise exception 'Deposits are currently closed. Please try again during the configured deposit window.';
  end if;

  select * into v_account from public.quantix_payment_accounts where id = p_payment_account_id and active = true;
  if not found then raise exception 'Funding account is not available. Please refresh and select an active account.'; end if;

  if exists (select 1 from public.quantix_deposits where proof_sha256 = lower(trim(p_proof_sha256))) then
    raise exception 'This payment proof has already been submitted and cannot be reused.';
  end if;

  insert into public.quantix_deposits(
    user_id, amount_minor, payment_account_id, sender_name, transfer_reference,
    proof_url, payment_proof_name, status, deposit_reference, proof_sha256, transaction_fingerprint
  )
  values(
    p_user_id, p_amount_minor, p_payment_account_id, trim(p_sender_name), trim(p_transfer_reference),
    p_proof_url, p_payment_proof_name, 'PENDING', upper(trim(p_deposit_reference)),
    lower(trim(p_proof_sha256)), lower(trim(p_transaction_fingerprint))
  )
  returning * into v_deposit;

  return to_jsonb(v_deposit);
exception
  when unique_violation then
    if exists (select 1 from public.quantix_deposits where proof_sha256 = lower(trim(p_proof_sha256))) then
      raise exception 'This payment proof has already been submitted and cannot be reused.';
    end if;
    if exists (select 1 from public.quantix_deposits where deposit_reference = upper(trim(p_deposit_reference))) then
      raise exception 'This deposit reference has already been used. Please start a new deposit request.';
    end if;
    raise;
end;
$function$;

revoke execute on function public.submit_deposit_secure(uuid,text,bigint,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_deposit_secure(uuid,text,bigint,uuid,text,text,text,text,text,text) to service_role;

revoke execute on function public.submit_deposit_atomic(bigint,uuid,text,text,text,text) from authenticated, anon;
