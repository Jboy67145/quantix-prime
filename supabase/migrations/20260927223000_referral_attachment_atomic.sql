-- Atomic, idempotent referral attachment for signup and confirmation flows.
create or replace function public.attach_referral_atomic(p_referred_user_id uuid,p_referral_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_referred public.profiles%rowtype; v_referrer public.profiles%rowtype; v_code text:=upper(trim(coalesce(p_referral_code,''))); v_referral_id uuid;
begin
 if auth.uid() is null and coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Unauthorized'; end if;
 if auth.uid() is not null and auth.uid() <> p_referred_user_id and coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Unauthorized'; end if;
 if v_code !~ '^[A-Z0-9_]{3,32}$' then return jsonb_build_object('attached',false,'reason','invalid_code'); end if;
 select * into v_referred from public.profiles where id=p_referred_user_id for update;
 if not found then raise exception 'Profile not found'; end if;
 if nullif(trim(v_referred.referred_by_code),'') is not null then
   select id into v_referral_id from public.quantix_referrals where referred_user_id=p_referred_user_id limit 1;
   return jsonb_build_object('attached',true,'referral_id',v_referral_id,'reason','already_attached');
 end if;
 select * into v_referrer from public.profiles where lower(invite_code)=lower(v_code) and id<>p_referred_user_id limit 1;
 if not found then return jsonb_build_object('attached',false,'reason','referrer_not_found'); end if;
 update public.profiles set referred_by_code=v_referrer.invite_code where id=p_referred_user_id and referred_by_code is null;
 begin
   insert into public.quantix_referrals(referrer_user_id,referred_user_id,invite_code,reward_minor,status)
   values(v_referrer.id,p_referred_user_id,v_referrer.invite_code,0,'PENDING') returning id into v_referral_id;
 exception when unique_violation then
   select id into v_referral_id from public.quantix_referrals where referred_user_id=p_referred_user_id limit 1;
 end;
 return jsonb_build_object('attached',true,'referral_id',v_referral_id,'referrer_user_id',v_referrer.id,'invite_code',v_referrer.invite_code);
end; $$;
revoke all on function public.attach_referral_atomic(uuid,text) from public,anon,authenticated;
grant execute on function public.attach_referral_atomic(uuid,text) to authenticated,service_role;