-- ---------------------------------------------------------------------------
-- Custom exercises, so a CSV import can bring movements the library doesn't
-- have.
--
-- The alternative — letting importers write to the shared library — would fill
-- it within a week with every user's spelling of "Bench Press (Barbell)". So
-- the library stays admin-curated and gains a private tier:
--
--   created_by IS NULL  -> the curated library, everyone sees it
--   created_by = a user -> that user's own, only they see it
--
-- Nothing about existing rows changes: they were all created by an admin and
-- stay NULL.
-- ---------------------------------------------------------------------------

alter table public.exercises
  add column if not exists created_by uuid references public.profiles (id) on delete cascade;

comment on column public.exercises.created_by is
  'NULL for the curated library. Set to a user for an exercise they created, which only they can see.';

create index if not exists exercises_created_by_idx on public.exercises (created_by)
  where created_by is not null;

-- One user cannot end up with two exercises of the same name — the importer
-- reuses a previous import's custom exercise rather than making another. Two
-- DIFFERENT users may of course both have a "Sled Push", and the curated
-- library is unaffected (partial index, so its NULLs are not compared).
create unique index if not exists exercises_owner_name_idx
  on public.exercises (created_by, lower(name))
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Read: the curated library plus your own. An admin sees everything, which is
-- what makes the console's exercise tab still show the whole table.
drop policy if exists "exercises read all" on public.exercises;
create policy "exercises read curated and own" on public.exercises
  for select to authenticated
  using (created_by is null or created_by = auth.uid() or public.is_admin());

-- The old policy was FOR ALL, so replacing it means restating write access.
drop policy if exists "exercises admin write" on public.exercises;

-- Anyone may create an exercise, but only ever as their own. `created_by =
-- auth.uid()` is what stops an import from smuggling a row into the curated
-- library, and it is checked here rather than in the client.
drop policy if exists "exercises insert own or admin" on public.exercises;
create policy "exercises insert own or admin" on public.exercises
  for insert to authenticated
  with check (created_by = auth.uid() or (public.is_admin() and created_by is null));

drop policy if exists "exercises update own or admin" on public.exercises;
create policy "exercises update own or admin" on public.exercises
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "exercises delete own or admin" on public.exercises;
create policy "exercises delete own or admin" on public.exercises
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());
