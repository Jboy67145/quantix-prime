create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('super_admin','admin','user'); exception when duplicate_object then null; end $$;
do $$ begin create type public.plan_status as enum ('active','paused'); exception when duplicate_object then null; end $$;
do $$ begin create type public.investment_status as enum ('active','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_type as enum ('deposit','withdrawal','yield_payout','referral_commission','game_reward'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_status as enum ('pending','approved','rejected','completed'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', email text not null default '', phone text,
 role public.user_role not null default 'user', wallet_balance numeric(15,2) not null default 0,
 total_invested numeric(15,2) not null default 0, total_withdrawn numeric(15,2) not null default 0,
 total_earned numeric(15,2) not null default 0, referral_code text not null unique,
 referred_by uuid references public.profiles(id), bank_account_name text, bank_account_number text, bank_name text,
 is_suspended boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.investment_plans (
 id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, image_url text,
 description text not null default '', min_amount numeric(15,2) not null, max_amount numeric(15,2) not null,
 daily_yield_percent numeric(8,4) not null, duration_days integer not null, total_return_percent numeric(8,4) not null,
 status public.plan_status not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.user_investments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 plan_id uuid not null references public.investment_plans(id), capital_amount numeric(15,2) not null,
 daily_earning numeric(15,2) not null, expected_total_return numeric(15,2) not null, total_earned_so_far numeric(15,2) not null default 0,
 days_completed integer not null default 0, status public.investment_status not null default 'active',
 last_yield_at timestamptz, next_yield_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(), reference text not null unique, user_id uuid not null references public.profiles(id) on delete cascade,
 type public.transaction_type not null, amount numeric(15,2) not null, fee numeric(15,2) not null default 0,
 net_amount numeric(15,2) not null, status public.transaction_status not null default 'pending', payment_method text,
 proof_of_payment_url text, rejection_reason text, created_at timestamptz not null default now()
);
create table if not exists public.payment_gateways (
 id uuid primary key default gen_random_uuid(), gateway_name text not null, bank_name text, account_number text,
 account_name text, crypto_address text, crypto_network text, instructions text, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.withdrawal_windows (
 id uuid primary key default gen_random_uuid(), day_of_week integer not null check (day_of_week between 0 and 6),
 open_time time not null, close_time time not null, min_withdrawal numeric(15,2) not null default 0,
 max_withdrawal numeric(15,2), fee_percentage numeric(8,4) not null default 0, is_enabled boolean not null default true
);

create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path = public as $$
 select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin') and not is_suspended)
$$;
create or replace function public.generate_referral_code() returns text language plpgsql as $$ declare code text; begin loop code := lower(substr(encode(gen_random_bytes(6),'hex'),1,10)); exit when not exists(select 1 from public.profiles where referral_code=code); end loop; return code; end $$;
create or replace function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id,full_name,email,referral_code) values(new.id,coalesce(new.raw_user_meta_data->>'name',''),new.email,public.generate_referral_code()); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.on_auth_user_created();

alter table public.profiles enable row level security; alter table public.investment_plans enable row level security; alter table public.user_investments enable row level security; alter table public.transactions enable row level security; alter table public.payment_gateways enable row level security; alter table public.withdrawal_windows enable row level security;
drop policy if exists profiles_self on public.profiles; create policy profiles_self on public.profiles for all using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
drop policy if exists plans_read on public.investment_plans; create policy plans_read on public.investment_plans for select using (status='active' or public.is_admin());
drop policy if exists plans_admin on public.investment_plans; create policy plans_admin on public.investment_plans for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists investments_self on public.user_investments; create policy investments_self on public.user_investments for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
drop policy if exists transactions_self on public.transactions; create policy transactions_self on public.transactions for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
drop policy if exists gateways_read on public.payment_gateways; create policy gateways_read on public.payment_gateways for select using (is_active or public.is_admin());
drop policy if exists gateways_admin on public.payment_gateways; create policy gateways_admin on public.payment_gateways for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists windows_read on public.withdrawal_windows; create policy windows_read on public.withdrawal_windows for select using (is_enabled or public.is_admin());
drop policy if exists windows_admin on public.withdrawal_windows; create policy windows_admin on public.withdrawal_windows for all using (public.is_admin()) with check (public.is_admin());
create index if not exists user_investments_user_status_idx on public.user_investments(user_id,status);
create index if not exists transactions_user_created_idx on public.transactions(user_id,created_at desc);
