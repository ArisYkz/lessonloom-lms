-- In-person check-in: the teacher shows a QR whose token rotates every few seconds.
-- A learner who scans it during the class window is recorded once.

alter table public.class_sessions
  add column checkin_token text,
  add column checkin_expires_at timestamptz;

-- The token must not be readable by members, or someone could check in without being there.
revoke select on public.class_sessions from authenticated;
grant select (
  id, classroom_id, title, starts_at, duration_minutes, time_zone, meeting_url, status, created_at,
  format, location
) on public.class_sessions to authenticated;

create table public.session_checkins (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.session_checkins enable row level security;
revoke all on public.session_checkins from anon, authenticated;
grant select on public.session_checkins to authenticated;

create policy "learner and class owner read check-ins" on public.session_checkins for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions s
      where s.id = session_id and public.owns_classroom(s.classroom_id)
    )
  );

create or replace function public.rotate_session_checkin(_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _classroom uuid;
  _format text;
  _status text;
  _token text;
begin
  select classroom_id, format, status into _classroom, _format, _status
  from public.class_sessions where id = _session;
  if _classroom is null or not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if _format <> 'in_person' or _status <> 'scheduled' then
    raise exception 'Check-in is only for scheduled in-person sessions';
  end if;

  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.class_sessions
  set checkin_token = _token, checkin_expires_at = now() + interval '60 seconds'
  where id = _session;
  return _token;
end;
$$;

create or replace function public.check_in_to_session(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
  _session public.class_sessions%rowtype;
begin
  if _user is null then
    raise exception 'Unauthorized';
  end if;

  select * into _session from public.class_sessions
  where checkin_token = _token and checkin_expires_at > now();
  if not found then
    raise exception 'Invalid check-in code';
  end if;
  if _session.status <> 'scheduled' then
    raise exception 'Session is cancelled';
  end if;
  if not public.is_active_classroom_member(_session.classroom_id, _user) then
    raise exception 'Not a class member';
  end if;
  if now() < _session.starts_at - interval '30 minutes'
    or now() > _session.starts_at + make_interval(mins => _session.duration_minutes) then
    raise exception 'Check-in is not open';
  end if;

  insert into public.session_checkins (session_id, user_id)
  values (_session.id, _user)
  on conflict (session_id, user_id) do nothing;
  return _session.id;
end;
$$;

revoke all on function public.rotate_session_checkin(uuid) from public, anon;
revoke all on function public.check_in_to_session(text) from public, anon;
grant execute on function public.rotate_session_checkin(uuid) to authenticated;
grant execute on function public.check_in_to_session(text) to authenticated;
