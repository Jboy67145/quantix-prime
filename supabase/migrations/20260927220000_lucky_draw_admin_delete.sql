create or replace function public.admin_delete_lucky_draw_atomic(p_draw_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_draw public.quantix_lucky_draws%rowtype;
  v_deleted_entries integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists (select 1 from public.profiles where id=v_actor and role in ('ADMIN','SUPER_ADMIN')) then
    raise exception 'Administrator access required.';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A deletion reason is required.'; end if;

  select * into v_draw from public.quantix_lucky_draws where id=p_draw_id for update;
  if not found then raise exception 'Lucky Wish draw not found.'; end if;

  delete from public.quantix_lucky_entries where draw_id=p_draw_id;
  get diagnostics v_deleted_entries = row_count;
  delete from public.quantix_lucky_draws where id=p_draw_id;

  insert into public.quantix_audit_logs(actor_id,actor_role,action,target_type,target_id,reason,before_state,after_state)
  select v_actor,p.role,'LUCKY_DRAW_DELETED','LUCKY_DRAW',p_draw_id::text,trim(p_reason),to_jsonb(v_draw),
         jsonb_build_object('deleted',true,'deleted_entry_count',v_deleted_entries)
  from public.profiles p where p.id=v_actor;

  return jsonb_build_object('deleted',true,'draw_id',p_draw_id,'deleted_entry_count',v_deleted_entries);
end;
$$;

revoke all on function public.admin_delete_lucky_draw_atomic(uuid,text) from public;
grant execute on function public.admin_delete_lucky_draw_atomic(uuid,text) to authenticated;