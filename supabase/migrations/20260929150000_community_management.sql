create table if not exists public.quantix_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  join_url text not null,
  icon_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quantix_communities_name_chk check (length(trim(name)) between 2 and 120),
  constraint quantix_communities_url_chk check (join_url ~* '^https?://'),
  constraint quantix_communities_order_chk check (display_order >= 0)
);

create unique index if not exists quantix_communities_join_url_uidx on public.quantix_communities (join_url);
create index if not exists quantix_communities_active_order_idx on public.quantix_communities (active, display_order, created_at);

alter table public.quantix_communities enable row level security;
revoke all on table public.quantix_communities from anon;
grant select on table public.quantix_communities to authenticated;
grant all on table public.quantix_communities to service_role;

drop policy if exists "Authenticated users can view active communities" on public.quantix_communities;
create policy "Authenticated users can view active communities"
on public.quantix_communities
for select
to authenticated
using (active = true);
