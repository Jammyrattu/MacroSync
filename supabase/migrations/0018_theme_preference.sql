-- ---------------------------------------------------------------------------
-- Theme preference.
--
-- Lives on profiles so the choice follows the account to every device rather
-- than being stranded in one browser's localStorage. localStorage is still
-- written as a cache — it's what lets the theme be applied before first paint,
-- since the profile row can't be fetched that early.
--
-- Default 'light': the app was designed light, and existing users chose
-- nothing. New users are asked during onboarding.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists theme text not null default 'light'
    check (theme in ('light', 'dark', 'system'));

comment on column public.profiles.theme is
  'UI theme: light, dark, or system (follow the OS setting). Public like the rest of the row, but never selected by the embeds other users read.';
