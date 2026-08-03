-- ---------------------------------------------------------------------------
-- Let admins read a user's email address.
--
-- Emails live in auth.users, which PostgREST does not expose, so the client
-- cannot read them at all. Copying the column onto public.profiles is NOT an
-- option: "profiles readable by authenticated" is `using (true)`, so that would
-- hand every signed-in user everyone else's email address.
--
-- Instead a SECURITY DEFINER function is the boundary. It runs as the owner
-- (so it can see auth.users) but checks is_admin() first and returns null to
-- anybody else — null rather than an exception so a non-admin probing it learns
-- nothing about whether the account exists.
-- ---------------------------------------------------------------------------

create or replace function public.admin_user_email(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  found_email text;
begin
  if not public.is_admin() then
    return null;
  end if;

  select u.email into found_email
  from auth.users u
  where u.id = target;

  return found_email;
end;
$$;

comment on function public.admin_user_email(uuid) is
  'Returns the account email for `target`, or null unless the caller is an admin.';

revoke all on function public.admin_user_email(uuid) from public;
revoke all on function public.admin_user_email(uuid) from anon;
grant execute on function public.admin_user_email(uuid) to authenticated;
