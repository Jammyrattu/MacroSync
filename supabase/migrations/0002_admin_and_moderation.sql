-- ---------------------------------------------------------------------------
-- Roles, moderation, and an editable exercise library.
--
-- Every capability here is enforced by RLS, not by the UI. The anon key ships
-- in the browser bundle, so anything the client "decides" is advisory only —
-- the policies below are the actual boundary.
--
-- Roles live in their own table rather than a profiles column on purpose:
-- "profiles updatable by owner" is a ROW-level policy, so a column on profiles
-- would let any user set their own role and self-promote to admin.
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  role       text not null check (role in ('moderator', 'admin')),
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.user_roles is
  'Absence of a row means an ordinary user. Only admins may write here.';

-- ---------------------------------------------------------------------------
-- Role helpers.
--
-- SECURITY DEFINER so they can read user_roles from inside a policy ON
-- user_roles without recursing through that same policy. search_path is pinned
-- so a caller cannot shadow `public` with their own table.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = uid and role = 'admin'
  );
$$;

-- Moderator OR admin — every moderation capability admins have too.
create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = uid and role in ('moderator', 'admin')
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- user_roles policies. Readable by any signed-in user so the UI can show a
-- moderator badge; writable only by admins.
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists "user_roles read all" on public.user_roles;
create policy "user_roles read all" on public.user_roles
  for select to authenticated using (true);

drop policy if exists "user_roles admin insert" on public.user_roles;
create policy "user_roles admin insert" on public.user_roles
  for insert to authenticated with check (public.is_admin());

drop policy if exists "user_roles admin update" on public.user_roles;
create policy "user_roles admin update" on public.user_roles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- An admin cannot delete their own admin row; that would allow locking the
-- last administrator out of the project from the UI.
drop policy if exists "user_roles admin delete" on public.user_roles;
create policy "user_roles admin delete" on public.user_roles
  for delete to authenticated
  using (public.is_admin() and not (user_id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------------
-- Moderation: staff may delete any post or comment. Ownership rules for insert
-- and update are unchanged — moderation is removal, not impersonation.
-- ---------------------------------------------------------------------------
drop policy if exists "community_posts delete own" on public.community_posts;
create policy "community_posts delete own or staff" on public.community_posts
  for delete to authenticated using (auth.uid() = user_id or public.is_staff());

drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own or staff" on public.comments
  for delete to authenticated using (auth.uid() = user_id or public.is_staff());

-- Routines are an admin-only power: moderators handle community content only.
drop policy if exists "workouts delete own" on public.workouts;
create policy "workouts delete own or admin" on public.workouts
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- Admins need to see any routine to be able to remove it, not just public ones.
drop policy if exists "workouts visible when public or own" on public.workouts;
create policy "workouts visible when public or own or admin" on public.workouts
  for select to authenticated
  using (visibility = 'public' or auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- exercises — was a static frontend file; now a table so admins can edit it.
-- `id` stays the same text slug the routines already reference in their
-- workouts.exercises jsonb, so existing routines keep resolving.
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id           text primary key,
  name         text not null,
  muscle_group text not null check (
    muscle_group in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio')
  ),
  equipment    text not null default '',
  -- Free Exercise DB folder name supplying the two demo frames; null = no demo.
  demo         text,
  steps        text[] not null default '{}',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists exercises_group_idx on public.exercises (muscle_group, sort_order);

alter table public.exercises enable row level security;

drop policy if exists "exercises read all" on public.exercises;
create policy "exercises read all" on public.exercises
  for select to authenticated using (true);

drop policy if exists "exercises admin write" on public.exercises;
create policy "exercises admin write" on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed the first administrator.
-- Written against auth.users by email so it survives the id changing between
-- environments; a no-op if that account doesn't exist here.
-- ---------------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'jammywv@gmail.com'
on conflict (user_id) do update set role = 'admin';
