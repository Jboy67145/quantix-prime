-- Lucky Wish paid entries, admin reporting, and public winner results.
create or replace function public.join_lucky_draw_atomic(p_draw_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
 v_user uuid:=auth.uid(); v_draw public.quantix_lucky_draws%rowtype; v_wallet public.quantix_wallets%rowtype;
 v_entry_id uuid:=gen_random_uuid(); v_reference text; v_required numeric;
begin
 if v_user is null then raise exception 'Authentication required.'; end if;
 select * into v_draw from public.quantix_lucky_draws where id=p_draw_id and status='OPEN' and opens_at<=now() and closes_at>now() for update;
 if not found then raise exception 'This draw is closed or not currently open.'; end if;
 select * into v_wallet from public.quantix_wallets where user_id=v_user for update;
 if not found then raise exception 'Wallet not found.'; end if;
 if exists(select 1 from public.quantix_lucky_entries where draw_id=p_draw_id and user_id=v_user) then raise exception 'You have already joined this draw.'; end if;
 if coalesce(v_wallet.available_minor,0)<coalesce(v_draw.entry_cost_minor,0) then
   v_required:=coalesce(v_draw.entry_cost_minor,0)::numeric/100;
   raise exception using message='Insufficient balance. You need ₦'||to_char(v_required,'FM999G999G999G990D00')||' to join this draw.';
 end if;
 insert into public.quantix_lucky_entries(id,draw_id,user_id) values(v_entry_id,p_draw_id,v_user);
 if coalesce(v_draw.entry_cost_minor,0)>0 then
   update public.quantix_wallets set available_minor=available_minor-v_draw.entry_cost_minor,updated_at=now() where id=v_wallet.id;
   v_reference:='LUCKY-ENTRY-'||v_entry_id::text;
   insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
   values(v_user,v_reference,'LUCKY_ENTRY',v_draw.entry_cost_minor,'DEBIT','POSTED',jsonb_build_object('drawId',p_draw_id,'entryId',v_entry_id,'entryCostMinor',v_draw.entry_cost_minor));
 end if;
 return jsonb_build_object('success',true,'entry_id',v_entry_id,'draw_id',p_draw_id,'entry_cost_minor',coalesce(v_draw.entry_cost_minor,0),'remaining_balance_minor',v_wallet.available_minor-coalesce(v_draw.entry_cost_minor,0));
end; $$;
revoke all on function public.join_lucky_draw_atomic(uuid) from public,anon;
grant execute on function public.join_lucky_draw_atomic(uuid) to authenticated;

create or replace function public.admin_lucky_draw_stats(p_draw_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_role text; v_draw public.quantix_lucky_draws%rowtype; v_entries integer; v_total bigint; v_winners integer;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role not in ('ADMIN','SUPER_ADMIN') then raise exception 'Admin access required.'; end if;
 select * into v_draw from public.quantix_lucky_draws where id=p_draw_id;
 if not found then raise exception 'Lucky Wish draw not found.'; end if;
 select count(*)::integer into v_entries from public.quantix_lucky_entries where draw_id=p_draw_id;
 v_total:=v_entries*coalesce(v_draw.entry_cost_minor,0);
 select count(*)::integer into v_winners from public.quantix_lucky_winners where draw_id=p_draw_id;
 return jsonb_build_object('draw_id',p_draw_id,'joined_count',v_entries,'entry_cost_minor',coalesce(v_draw.entry_cost_minor,0),'total_entry_minor',v_total,'winner_count',v_winners);
end; $$;
revoke all on function public.admin_lucky_draw_stats(uuid) from public,anon;
grant execute on function public.admin_lucky_draw_stats(uuid) to authenticated;

drop policy if exists lucky_winners_public_results on public.quantix_lucky_winners;
create policy lucky_winners_public_results on public.quantix_lucky_winners for select to authenticated
using (exists(select 1 from public.quantix_lucky_draws d where d.id=draw_id and d.status in ('WON','CLAIMED')));
