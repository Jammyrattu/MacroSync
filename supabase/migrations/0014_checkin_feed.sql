-- ---------------------------------------------------------------------------
-- Check-in feed: comments on a member's check-in, and mandatory photo proof.
-- ---------------------------------------------------------------------------

create table if not exists public.challenge_checkin_comments (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null references public.challenge_checkins (id) on delete cascade,
  -- Denormalised so the policies can ask "is this person in the challenge"
  -- without joining back through the check-in on every row.
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  content      text not null default '',
  image_url    text,
  created_at   timestamptz not null default now(),

  -- A comment has to say something. Text or a GIF, either is fine, neither
  -- isn't.
  constraint comment_not_empty check (length(trim(content)) > 0 or image_url is not null)
);

create index if not exists checkin_comments_lookup
  on public.challenge_checkin_comments (checkin_id, created_at);

alter table public.challenge_checkin_comments enable row level security;

drop policy if exists "checkin comments visible to members" on public.challenge_checkin_comments;
create policy "checkin comments visible to members" on public.challenge_checkin_comments
  for select to authenticated
  using (public.in_challenge(challenge_id) or public.owns_challenge(challenge_id));

-- Only someone who actually joined can comment — an invitee who never accepted
-- shouldn't be able to talk in the feed.
drop policy if exists "checkin comments written by members" on public.challenge_checkin_comments;
create policy "checkin comments written by members" on public.challenge_checkin_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_participants p
      where p.challenge_id = challenge_id and p.user_id = auth.uid() and p.status = 'accepted'
    )
  );

drop policy if exists "checkin comments updated by author" on public.challenge_checkin_comments;
create policy "checkin comments updated by author" on public.challenge_checkin_comments
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The challenge owner can remove a comment as well as its author — someone has
-- to be able to clean up their own challenge.
drop policy if exists "checkin comments deleted by author or owner" on public.challenge_checkin_comments;
create policy "checkin comments deleted by author or owner" on public.challenge_checkin_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.owns_challenge(challenge_id));

-- ---------------------------------------------------------------------------
-- Photo proof means photo proof.
--
-- The rule belongs here rather than only in the form: a challenge whose whole
-- premise is "show us" shouldn't accept a bare tick because someone posted
-- straight to the API.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_checkin_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  needs_photo boolean;
begin
  select verification = 'photo' into needs_photo
  from public.challenges where id = new.challenge_id;

  if needs_photo and coalesce(trim(new.photo_url), '') = '' then
    raise exception 'This challenge requires a photo with every check-in'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists checkin_requires_photo on public.challenge_checkins;
create trigger checkin_requires_photo
  before insert or update on public.challenge_checkins
  for each row execute function public.enforce_checkin_photo();

-- ---------------------------------------------------------------------------
-- Notify the check-in's author when someone comments on it.
-- ---------------------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists on_checkin_comment boolean not null default true;

create or replace function public.on_checkin_comment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.notify_event('checkin_comment', jsonb_build_object(
    'comment_id', new.id,
    'checkin_id', new.checkin_id,
    'challenge_id', new.challenge_id,
    'actor_id', new.user_id
  ));
  return new;
end;
$$;

drop trigger if exists checkin_comment_notify on public.challenge_checkin_comments;
create trigger checkin_comment_notify after insert on public.challenge_checkin_comments
  for each row execute function public.on_checkin_comment_notify();
