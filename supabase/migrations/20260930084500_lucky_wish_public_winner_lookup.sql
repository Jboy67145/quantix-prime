-- Public authenticated Lucky Wish winner lookup without exposing the service-role client to user actions.
create or replace function public.get_lucky_winners_public(p_draw_ids uuid[])
returns table(draw_id uuid,user_id uuid,username text,name text,selected_at timestamptz,claimed_at timestamptz)
language sql security definer set search_path=public
as $$
 select w.draw_id,w.user_id,coalesce(p.username,'User'),coalesce(p.name,'Winner'),w.created_at,w.claimed_at
 from public.quantix_lucky_winners w
 left join public.profiles p on p.id=w.user_id
 join public.quantix_lucky_draws d on d.id=w.draw_id
 where w.draw_id=any(p_draw_ids) and d.status in ('WON','CLAIMED')
 order by w.created_at asc
$$;
revoke all on function public.get_lucky_winners_public(uuid[]) from public,anon;
grant execute on function public.get_lucky_winners_public(uuid[]) to authenticated;
