-- Teachers can rename a class, edit or restore a session (members are notified of changes),
-- and cannot set homework due dates in the past.

create or replace function public.rename_classroom(_classroom uuid, _name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _clean text := btrim(_name);
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if length(_clean) not between 1 and 120 then
    raise exception 'Invalid name';
  end if;
  update public.classrooms set name = _clean where id = _classroom;
end;
$$;

create or replace function public.update_class_session(
  _session uuid,
  _title text,
  _starts_at timestamptz,
  _duration_minutes integer,
  _time_zone text,
  _meeting_url text,
  _format text,
  _location text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  _old public.class_sessions%rowtype;
  _status text;
  _clean_title text := btrim(_title);
begin
  _meeting_url := nullif(btrim(_meeting_url), '');
  _location := nullif(btrim(_location), '');

  select * into _old from public.class_sessions where id = _session;
  if _old.id is null or not public.owns_classroom(_old.classroom_id) then
    raise exception 'Forbidden';
  end if;
  select status into _status from public.classrooms where id = _old.classroom_id;
  if _status <> 'active' then
    raise exception 'Class is archived';
  end if;
  if _old.status <> 'scheduled' then
    raise exception 'Session is cancelled';
  end if;
  if length(_clean_title) not between 1 and 120 then
    raise exception 'Invalid title';
  end if;
  if _duration_minutes not between 5 and 480 then
    raise exception 'Invalid duration';
  end if;
  if not exists (select 1 from pg_timezone_names where name = _time_zone) then
    raise exception 'Invalid time zone';
  end if;
  if _starts_at is distinct from _old.starts_at and _starts_at <= now() then
    raise exception 'Session must start in the future';
  end if;

  if _format = 'online' then
    if _meeting_url is null then
      raise exception 'Meeting link required';
    end if;
    if _meeting_url !~ '^https://\S+$' or length(_meeting_url) > 500 then
      raise exception 'Meeting link must use https';
    end if;
    _location := null;
  elsif _format = 'in_person' then
    if _location is null then
      raise exception 'Location required';
    end if;
    if length(_location) > 200 then
      raise exception 'Invalid location';
    end if;
    _meeting_url := null;
  else
    raise exception 'Invalid format';
  end if;

  update public.class_sessions
  set title = _clean_title, starts_at = _starts_at, duration_minutes = _duration_minutes,
      time_zone = _time_zone, meeting_url = _meeting_url, format = _format, location = _location
  where id = _session;

  if _clean_title is distinct from _old.title
    or _starts_at is distinct from _old.starts_at
    or _duration_minutes is distinct from _old.duration_minutes
    or _time_zone is distinct from _old.time_zone
    or _format is distinct from _old.format
    or _meeting_url is distinct from _old.meeting_url
    or _location is distinct from _old.location then
    insert into public.notifications (user_id, kind, title, link)
    select m.user_id, 'class_session_updated', _clean_title, '/calendar'
    from public.classroom_memberships m
    where m.classroom_id = _old.classroom_id and m.status = 'active';
  end if;
end;
$$;

create or replace function public.restore_class_session(_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _old public.class_sessions%rowtype;
  _status text;
begin
  select * into _old from public.class_sessions where id = _session;
  if _old.id is null or not public.owns_classroom(_old.classroom_id) then
    raise exception 'Forbidden';
  end if;
  select status into _status from public.classrooms where id = _old.classroom_id;
  if _status <> 'active' then
    raise exception 'Class is archived';
  end if;
  if _old.status <> 'cancelled' then
    raise exception 'Session is not cancelled';
  end if;
  if _old.starts_at <= now() then
    raise exception 'Session must start in the future';
  end if;

  update public.class_sessions set status = 'scheduled' where id = _session;

  insert into public.notifications (user_id, kind, title, link)
  select m.user_id, 'class_session_updated', _old.title, '/calendar'
  from public.classroom_memberships m
  where m.classroom_id = _old.classroom_id and m.status = 'active';
end;
$$;

create or replace function public.set_classroom_homework_due(_classroom uuid, _homework uuid, _due_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  _status text;
  _course uuid;
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  select c.status, c.course_id into _status, _course from public.classrooms c where c.id = _classroom;
  if _status <> 'active' then
    raise exception 'Class is archived';
  end if;
  if not exists (select 1 from public.homework h where h.id = _homework and h.course_id = _course) then
    raise exception 'Homework is not in this course';
  end if;

  if _due_at is null then
    delete from public.classroom_homework_due where classroom_id = _classroom and homework_id = _homework;
  else
    if _due_at <= now() then
      raise exception 'Due date must be in the future';
    end if;
    insert into public.classroom_homework_due (classroom_id, homework_id, due_at)
    values (_classroom, _homework, _due_at)
    on conflict (classroom_id, homework_id) do update set due_at = excluded.due_at;
  end if;
end;
$$;

revoke all on function public.rename_classroom(uuid, text) from public, anon;
grant execute on function public.rename_classroom(uuid, text) to authenticated;
revoke all on function public.update_class_session(uuid, text, timestamptz, integer, text, text, text, text) from public, anon;
grant execute on function public.update_class_session(uuid, text, timestamptz, integer, text, text, text, text) to authenticated;
revoke all on function public.restore_class_session(uuid) from public, anon;
grant execute on function public.restore_class_session(uuid) to authenticated;
