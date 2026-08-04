-- ---------------------------------------------------------------------------
-- Admin oversight of challenges.
--
-- Admins already moderate posts, comments and routines; challenges were the
-- one piece of shared content with no way to remove an abusive or broken one.
--
-- Scope is deliberately narrow: challenges and their roster, so the console can
-- list what exists and who's in it. NOT the check-ins or their comments —
-- those carry members' own photos, and deleting a challenge cascades to them
-- anyway without anyone needing to read them first. Health data stays off
-- limits entirely, as before.
-- ---------------------------------------------------------------------------

drop policy if exists "challenges visible to members or public" on public.challenges;
create policy "challenges visible to members public or admin" on public.challenges
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.in_challenge(id)
    or visibility = 'public'
    or public.is_admin()
  );

drop policy if exists "challenges delete by owner" on public.challenges;
create policy "challenges delete by owner or admin" on public.challenges
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- The roster, so the console can show player counts alongside each challenge.
drop policy if exists "participants visible to members" on public.challenge_participants;
create policy "participants visible to members or admin" on public.challenge_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.owns_challenge(challenge_id)
    or public.in_challenge(challenge_id)
    or public.is_admin()
  );
