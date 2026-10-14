-- Cancelling a session tells enrolled students; check-in is refused once a class is archived.

create or replace function public.cancel_class_session(_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _classroom uuid;
  _title text;
  _previous text;
begin
  select classroom_id, title, status into _classroom, _title, _previous
  from public.class_sessions where id = _session;
  if _classroom is null or not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if _previous = 'cancelled' then
    return;
  end if;

  update public.class_sessions set status = 'cancelled' where id = _session;

  insert into public.notifications (user_id, kind, title, link)
  select m.user_id, 'class_session_cancelled', _title, '/calendar'
  from public.classroom_memberships m
  where m.classroom_id = _classroom and m.status = 'active';
end;
$$;

create or replace function public.check_in_to_session(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
  _session public.class_sessions%rowtype;
  _class_status text;
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
  select status into _class_status from public.classrooms where id = _session.classroom_id;
  if _class_status <> 'active' then
    raise exception 'Class is archived';
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

revoke all on function public.cancel_class_session(uuid) from public, anon;
grant execute on function public.cancel_class_session(uuid) to authenticated;
revoke all on function public.check_in_to_session(text) from public, anon;
grant execute on function public.check_in_to_session(text) to authenticated;
