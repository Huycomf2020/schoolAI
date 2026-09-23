create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'teacher' check (role in ('teacher','manager','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('basic','advanced')),
  provider text not null check (provider in ('openai','gemini')),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx on public.usage_events(user_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;

create policy "users_read_own_profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users_update_own_profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "users_read_own_usage" on public.usage_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_usage" on public.usage_events for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert on public.usage_events to authenticated;
grant usage, select on sequence public.usage_events_id_seq to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name'); return new; end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
