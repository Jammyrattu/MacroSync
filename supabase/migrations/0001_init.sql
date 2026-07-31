-- MacroSync initial schema.
--
-- Creates all 11 application tables, row-level security, the signup trigger
-- that seeds a profile row, and the two storage buckets.
--
-- Ownership convention (fixed by the app's design):
--   * profiles.id IS the auth user id
--   * every other table owns rows via user_id
--   * follows uses follower_id / following_id
--
-- IMPORTANT: every ownership foreign key targets profiles(id), NOT
-- auth.users(id). PostgREST can only embed related rows across a declared
-- foreign key, so `community_posts -> profiles` is what makes
-- `.select('*, profiles(display_name, avatar_url)')` resolve. Pointing these at
-- auth.users instead would silently render every author as anonymous.
-- profiles.id is itself FK'd to auth.users(id), so cascade deletes still work.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- nutrition_profiles — one row per user; `onboarded` gates the whole app
-- ---------------------------------------------------------------------------
create table if not exists public.nutrition_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles (id) on delete cascade,
  age            integer check (age between 13 and 120),
  sex            text check (sex in ('male', 'female')),
  height_cm      numeric(5, 1) check (height_cm between 50 and 280),
  weight_kg      numeric(5, 1) check (weight_kg between 20 and 500),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  goal           text check (goal in ('lose', 'maintain', 'gain')),
  calorie_target integer,
  protein_target integer,
  carbs_target   integer,
  fat_target     integer,
  onboarded      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- food_logs
-- Macros are stored PER 100 G (as Open Food Facts returns them) plus the chosen
-- serving. Storing source values rather than pre-multiplied totals is what lets
-- "edit serving" recompute without loss.
-- ---------------------------------------------------------------------------
create table if not exists public.food_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  log_date      date not null default current_date,
  meal          text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_name     text not null,
  brand         text,
  barcode       text,
  image_url     text,
  calories      numeric(8, 2) not null default 0,
  protein       numeric(8, 2) not null default 0,
  carbs         numeric(8, 2) not null default 0,
  fat           numeric(8, 2) not null default 0,
  serving_size  text,
  serving_grams numeric(8, 2) not null default 100 check (serving_grams > 0),
  quantity      numeric(6, 2) not null default 1 check (quantity > 0),
  created_at    timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date desc);

-- ---------------------------------------------------------------------------
-- weight_logs — one entry per user per day
-- ---------------------------------------------------------------------------
create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  weight_kg  numeric(5, 1) not null check (weight_kg between 20 and 500),
  log_date   date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- favorite_foods
-- ---------------------------------------------------------------------------
create table if not exists public.favorite_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  food_name    text not null,
  brand        text,
  barcode      text,
  image_url    text,
  calories     numeric(8, 2) not null default 0,
  protein      numeric(8, 2) not null default 0,
  carbs        numeric(8, 2) not null default 0,
  fat          numeric(8, 2) not null default 0,
  serving_size text,
  created_at   timestamptz not null default now()
);

create index if not exists favorite_foods_user_idx on public.favorite_foods (user_id);

-- ---------------------------------------------------------------------------
-- workouts — routines. `exercises` holds
--   [{ exercise_id, name, muscle_group, sets, reps, rest_seconds }, ...]
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  description text,
  exercises   jsonb not null default '[]'::jsonb,
  visibility  text not null default 'private' check (visibility in ('private', 'public')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workouts_user_idx on public.workouts (user_id);
create index if not exists workouts_public_idx on public.workouts (visibility) where visibility = 'public';

-- ---------------------------------------------------------------------------
-- workout_logs — completed sessions.
-- workout_id is ON DELETE SET NULL and workout_name is denormalised so history
-- survives the routine being deleted.
-- ---------------------------------------------------------------------------
create table if not exists public.workout_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  workout_id       uuid references public.workouts (id) on delete set null,
  workout_name     text not null,
  duration_seconds integer not null default 0,
  completed_sets   jsonb not null default '[]'::jsonb,
  total_volume     numeric(10, 2) not null default 0,
  performed_at     timestamptz not null default now()
);

create index if not exists workout_logs_user_idx on public.workout_logs (user_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  content    text not null default '',
  category   text not null check (
    category in ('recipe', 'food_idea', 'tip', 'progress', 'question', 'motivation')
  ),
  image_url  text,
  created_at timestamptz not null default now()
);

create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists community_posts_category_idx on public.community_posts (category);

-- ---------------------------------------------------------------------------
-- post_reactions — UNIQUE(post_id, user_id) enforces one reaction per user per
-- post, which is what makes the "change my reaction" upsert work.
-- ---------------------------------------------------------------------------
create table if not exists public.post_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists follows_follower_idx on public.follows (follower_id);

-- ---------------------------------------------------------------------------
-- Signup trigger: seed a profiles row for every new auth user.
-- SECURITY DEFINER because the inserting role is the auth service, not the user.
-- Google OAuth supplies full_name/name and avatar_url in raw_user_meta_data;
-- email signups have neither, so we fall back to the email local-part.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- Empty nutrition profile so `onboarded = false` gating has a row to read.
  insert into public.nutrition_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Private data  -> owner-only for all four verbs.
-- Community data-> readable by any authenticated user (the feed must show other
--                  people's rows), writable only by the owner.
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.nutrition_profiles enable row level security;
alter table public.food_logs          enable row level security;
alter table public.weight_logs        enable row level security;
alter table public.favorite_foods     enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_logs       enable row level security;
alter table public.community_posts    enable row level security;
alter table public.post_reactions     enable row level security;
alter table public.comments           enable row level security;
alter table public.follows            enable row level security;

-- profiles: everyone signed in can read (needed for author names and People
-- search); you may only edit your own.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles insertable by owner" on public.profiles;
create policy "profiles insertable by owner" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Owner-only tables. Identical shape for each, so generated in a loop.
do $$
declare
  t text;
begin
  foreach t in array array[
    'nutrition_profiles', 'food_logs', 'weight_logs', 'favorite_foods', 'workout_logs'
  ] loop
    execute format('drop policy if exists "%1$s owner all" on public.%1$I', t);
    execute format(
      'create policy "%1$s owner all" on public.%1$I for all to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- workouts: your own routines plus anyone's public ones; writes owner-only.
drop policy if exists "workouts visible when public or own" on public.workouts;
create policy "workouts visible when public or own" on public.workouts
  for select to authenticated using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "workouts insert own" on public.workouts;
create policy "workouts insert own" on public.workouts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workouts update own" on public.workouts;
create policy "workouts update own" on public.workouts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts delete own" on public.workouts;
create policy "workouts delete own" on public.workouts
  for delete to authenticated using (auth.uid() = user_id);

-- Community tables: read-all, write-own. Same shape for each.
do $$
declare
  t text;
begin
  foreach t in array array['community_posts', 'post_reactions', 'comments'] loop
    execute format('drop policy if exists "%1$s read all" on public.%1$I', t);
    execute format(
      'create policy "%1$s read all" on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists "%1$s insert own" on public.%1$I', t);
    execute format(
      'create policy "%1$s insert own" on public.%1$I for insert to authenticated
         with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s update own" on public.%1$I', t);
    execute format(
      'create policy "%1$s update own" on public.%1$I for update to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s delete own" on public.%1$I', t);
    execute format(
      'create policy "%1$s delete own" on public.%1$I for delete to authenticated
         using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- follows: anyone signed in can read the graph (follower counts); you may only
-- create or remove follows where you are the follower.
drop policy if exists "follows read all" on public.follows;
create policy "follows read all" on public.follows
  for select to authenticated using (true);

drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows
  for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows
  for delete to authenticated using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- Public read so <img src> works without signing every URL; writes are scoped
-- to a folder named after the user's id, so nobody can overwrite another
-- user's avatar.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('post-images', 'post-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select to public using (bucket_id in ('avatars', 'post-images'));

drop policy if exists "media insert own folder" on storage.objects;
create policy "media insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media update own folder" on storage.objects;
create policy "media update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media delete own folder" on storage.objects;
create policy "media delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
