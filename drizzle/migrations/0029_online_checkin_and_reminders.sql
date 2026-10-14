-- Check-in also works for an online session, and members are reminded shortly before one starts.

-- The QR was limited to in-person sessions, which left online classes with no attendance at all.
-- The window rules in check_in_to_session already apply to either format.
create or replace function public.rotate_session_checkin(_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _classroom uuid;
  _status text;
  _token text;
begin
  select classroom_id, status into _classroom, _status
  from public.class_sessions where id = _session;
  if _classroom is null or not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if _status <> 'scheduled' then
    raise exception 'Check-in is only for scheduled sessions';
  end if;

  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.class_sessions
  set checkin_token = _token, checkin_expires_at = now() + interval '60 seconds'
  where id = _session;
  return _token;
end;
$$;

-- Internal bookkeeping: which sessions have already been reminded, so a repeat run sends nothing.
-- It is not added to the column grant in 0024, so members cannot read it.
alter table public.class_sessions add column reminder_sent_at timestamptz;

create or replace function public.send_session_reminders()
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  _session record;
  _sent integer := 0;
begin
  for _session in
    select s.id, s.classroom_id, s.title
    from public.class_sessions s
    join public.classrooms c on c.id = s.classroom_id
    where s.status = 'scheduled'
      and s.reminder_sent_at is null
      and c.status = 'active'
      and s.starts_at > now()
      and s.starts_at <= now() + interval '1 hour'
    order by s.starts_at
  loop
    insert into public.notifications (user_id, kind, title, link)
    select m.user_id, 'class_session_reminder', _session.title, '/calendar'
    from public.classroom_memberships m
    where m.classroom_id = _session.classroom_id and m.status = 'active';

    update public.class_sessions set reminder_sent_at = now() where id = _session.id;
    _sent := _sent + 1;
  end loop;
  return _sent;
end;
$fn$;

-- Only the scheduler may run this: members must not be able to fire reminders themselves.
revoke all on function public.send_session_reminders() from public, anon, authenticated;

-- Moving a session, or restoring a cancelled one, makes any reminder already sent wrong.
-- The reminder function's own update touches neither column, so it does not clear the mark.
create or replace function public.reset_session_reminder()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at or new.status is distinct from old.status then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger class_sessions_reset_reminder
  before update on public.class_sessions
  for each row execute function public.reset_session_reminder();

-- pg_cron may not be enabled on the project. Everything above works without it, so a missing
-- scheduler is reported rather than failing the whole migration.
do $do$
begin
  create extension if not exists pg_cron;
  -- Drop any earlier version of this job first. Nested, so that a failure here cannot
  -- jump to the handler below and skip the schedule call.
  begin
    perform cron.unschedule('session-reminders');
  exception when others then null;
  end;
  perform cron.schedule(
    'session-reminders',
    '*/5 * * * *',
    $cron$select public.send_session_reminders()$cron$
  );
  raise notice 'Session reminders scheduled every 5 minutes.';
exception when others then
  raise warning 'Session reminders were NOT scheduled: %', sqlerrm;
end;
$do$;
