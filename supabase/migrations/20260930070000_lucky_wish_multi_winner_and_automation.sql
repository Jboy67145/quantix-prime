-- Lucky Wish: multi-winner draws, atomic winner selection/claims, and per-minute database automation.
-- Winner selection runs in Supabase Cron so it does not depend on a user opening the app.

alter table public.quantix_lucky_draws
  add column if not exists winner_count integer not null default 1,
  add column if not exists winners_selected_at timestamptz;

alter table public.quantix_lucky_draws
  drop constraint if exists quantix_lucky_draws_winner_count_check;
alter table public.quantix_lucky_draws
  add constraint quantix_lucky_draws_winner_count_check check (winner_count between 1 and 1000);

create table if not exists public.quantix_lucky_winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.quantix_lucky_draws(id) on delete cascade,
  entry_id uuid not null references public.quantix_lucky_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(draw_id, user_id),
  unique(draw_id, entry_id)
);

create index if not exists quantix_lucky_winners_user_idx on public.quantix_lucky_winners(user_id, created_at desc);
create index if not exists quantix_lucky_winners_draw_idx on public.quantix_lucky_winners(draw_id, created_at);

alter table public.quantix_lucky_winners enable row level security;
revoke all on public.quantix_lucky_winners from anon;
grant select on public.quantix_lucky_winners to authenticated;
drop policy if exists lucky_winners_self on public.quantix_lucky_winners;
create policy lucky_winners_self on public.quantix_lucky_winners for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.process_lucky_draws_atomic()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw public.quantix_lucky_draws%rowtype;
  v_winner record;
  v_processed integer := 0;
  v_winners_needed integer;
  v_first_winner_user uuid;
  v_first_winner_entry uuid;
begin
  for v_draw in select * from public.quantix_lucky_draws where status='OPEN' and closes_at<=now() for update skip locked loop
    if exists (select 1 from public.quantix_lucky_winners where draw_id=v_draw.id) then continue; end if;
    select least(v_draw.winner_count,count(*)::integer) into v_winners_needed from public.quantix_lucky_entries where draw_id=v_draw.id;
    if coalesce(v_winners_needed,0)<=0 then
      update public.quantix_lucky_draws set status='CLOSED',winners_selected_at=now(),updated_at=now() where id=v_draw.id;
      v_processed:=v_processed+1; continue;
    end if;
    v_first_winner_user:=null; v_first_winner_entry:=null;
    for v_winner in select e.id entry_id,e.user_id from public.quantix_lucky_entries e where e.draw_id=v_draw.id order by gen_random_uuid() limit v_winners_needed loop
      insert into public.quantix_lucky_winners(draw_id,entry_id,user_id) values(v_draw.id,v_winner.entry_id,v_winner.user_id) on conflict do nothing;
      if v_first_winner_user is null then v_first_winner_user:=v_winner.user_id;v_first_winner_entry:=v_winner.entry_id;end if;
      insert into public.quantix_notifications(user_id,type,title,body) values(v_winner.user_id,'LUCKY_WIN','You won Lucky Wish',case when v_draw.reward_type='CASH' then 'You have been selected as a Lucky Wish winner. Your cash reward is ready to claim.' else 'You have been selected as a Lucky Wish winner. Your reward is ready to claim.' end);
    end loop;
    update public.quantix_lucky_draws set status='WON',winner_user_id=v_first_winner_user,winner_entry_id=v_first_winner_entry,winners_selected_at=now(),updated_at=now() where id=v_draw.id;
    v_processed:=v_processed+1;
  end loop;
  return v_processed;
end;
$$;

revoke all on function public.process_lucky_draws_atomic() from public,anon,authenticated;
grant execute on function public.process_lucky_draws_atomic() to service_role;

create or replace function public.claim_lucky_reward_atomic(p_draw_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid:=auth.uid();
  v_winner public.quantix_lucky_winners%rowtype;
  v_draw public.quantix_lucky_draws%rowtype;
  v_wallet public.quantix_wallets%rowtype;
  v_reference text;
  v_remaining integer;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select w.* into v_winner from public.quantix_lucky_winners w where w.draw_id=p_draw_id and w.user_id=v_user for update;
  if not found then raise exception 'You are not a winner for this draw.'; end if;
  if v_winner.claimed_at is not null then return jsonb_build_object('claimed',true,'already_claimed',true,'draw_id',p_draw_id); end if;
  select d.* into v_draw from public.quantix_lucky_draws d where d.id=p_draw_id for update;
  if not found then raise exception 'Lucky Wish draw not found.'; end if;
  if v_draw.reward_type='CASH' and coalesce(v_draw.reward_minor,0)>0 then
    select * into v_wallet from public.quantix_wallets where user_id=v_user for update;
    if not found then raise exception 'Wallet not found.'; end if;
    v_reference:='LUCKY-'||p_draw_id::text||'-'||v_winner.id::text;
    insert into public.quantix_ledger_entries(user_id,reference,type,amount_minor,direction,status,metadata)
    values(v_user,v_reference,'LUCKY_WIN',v_draw.reward_minor,'CREDIT','POSTED',jsonb_build_object('drawId',p_draw_id,'winnerId',v_winner.id))
    on conflict(reference) do nothing;
    update public.quantix_wallets set available_minor=available_minor+v_draw.reward_minor,updated_at=now() where id=v_wallet.id;
  end if;
  update public.quantix_lucky_winners set claimed_at=now() where id=v_winner.id;
  select count(*) into v_remaining from public.quantix_lucky_winners where draw_id=p_draw_id and claimed_at is null;
  if v_remaining=0 then update public.quantix_lucky_draws set status='CLAIMED',updated_at=now() where id=p_draw_id; end if;
  insert into public.quantix_notifications(user_id,type,title,body) values(v_user,'LUCKY_CLAIMED','Lucky Wish reward claimed',case when v_draw.reward_type='CASH' then 'Your Lucky Wish cash reward has been credited to your available balance.' else 'Your Lucky Wish reward has been marked as claimed.' end);
  return jsonb_build_object('claimed',true,'draw_id',p_draw_id,'winner_id',v_winner.id,'reward_minor',coalesce(v_draw.reward_minor,0),'reward_type',v_draw.reward_type);
end;
$$;

revoke all on function public.claim_lucky_reward_atomic(uuid) from public,anon;
grant execute on function public.claim_lucky_reward_atomic(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from cron.job where jobname='quantix-lucky-draws-every-minute') then
    perform cron.schedule('quantix-lucky-draws-every-minute','* * * * *','select public.process_lucky_draws_atomic();');
  end if;
end $$;
