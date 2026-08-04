-- ---------------------------------------------------------------------------
-- Fix: pg_net's functions live in schema `net`, not `extensions.net`.
--
-- `create extension pg_net with schema extensions` registers the extension
-- against that schema, but pg_net creates its own `net` schema for its
-- functions and tables regardless. Calling `extensions.net.http_post` made
-- Postgres read it as database.schema.function and fail with
-- "cross-database references are not implemented" — which, because the call
-- sits in an AFTER INSERT trigger, rolled back every comment, follow, challenge
-- invite and check-in.
--
-- Caught by the test suite before anyone hit it, but it was live for the few
-- minutes between the two migrations.
-- ---------------------------------------------------------------------------

create or replace function private.notify_event(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  cfg private.notification_config%rowtype;
begin
  select * into cfg from private.notification_config where id = 1;

  if not found or coalesce(cfg.function_url, '') = '' then
    return;
  end if;

  -- A notification must never be able to fail the thing it's reporting on.
  -- pg_net queues rather than blocks, but a misconfiguration shouldn't cost
  -- someone their comment either.
  begin
    perform net.http_post(
      url     := cfg.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-secret', cfg.secret
      ),
      body    := jsonb_build_object('event', p_event, 'payload', p_payload),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_event(%) failed: %', p_event, sqlerrm;
  end;
end;
$$;
