-- Class offering: dates, seat capacity, optional price, and an enrollment switch.
-- Sessions gain a format: online (https meeting link) or in person (a location).

alter table public.classrooms
  add column start_date date,
  add column end_date date,
  add column capacity integer check (capacity is null or capacity between 1 and 500),
  add column price_kzt integer check (price_kzt is null or price_kzt >= 0),
  add column enrollment_open boolean not null default true,
  add constraint classrooms_dates_order check (start_date is null or end_date is null or end_date >= start_date);

grant select (start_date, end_date, capacity, price_kzt, enrollment_open) on public.classrooms to authenticated;

alter table public.class_sessions
  add column format text not null default 'online' check (format in ('online', 'in_person')),
  add column location text check (location is null or length(btrim(location)) between 1 and 200);

create or replace function public.set_classroom_offering(
  _classroom uuid,
  _start_date date,
  _end_date date,
  _capacity integer,
  _price_kzt integer,
  _enrollment_open boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  _status text;
  _seats integer;
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  select status into _status from public.classrooms where id = _classroom for update;
  if _status <> 'active' then
    raise exception 'Class is archived';
  end if;
  if _start_date is not null and _end_date is not null and _end_date < _start_date then
    raise exception 'Invalid dates';
  end if;
  if _capacity is not null and _capacity not between 1 and 500 then
    raise exception 'Invalid capacity';
  end if;
  if _price_kzt is not null and _price_kzt < 0 then
    raise exception 'Invalid price';
  end if;
  if _capacity is not null then
    select count(*) into _seats
    from public.classroom_memberships
    where classroom_id = _classroom and status = 'active';
    if _seats > _capacity then
      raise exception 'Capacity below current members';
    end if;
  end if;

  update public.classrooms
  set start_date = _start_date,
      end_date = _end_date,
      capacity = _capacity,
      price_kzt = _price_kzt,
      enrollment_open = _enrollment_open
  where id = _classroom;
end;
$$;

create or replace function public.join_classroom(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
  _classroom uuid;
  _org uuid;
  _status text;
  _open boolean;
  _capacity integer;
  _seats integer;
  _max_students integer;
begin
  if _user is null then
    raise exception 'Unauthorized';
  end if;

  select id, organization_id, status, enrollment_open, capacity
  into _classroom, _org, _status, _open, _capacity
  from public.classrooms
  where join_code = upper(btrim(_code))
  for update;
  if _classroom is null or _status <> 'active' then
    raise exception 'Invalid join code';
  end if;

  if exists (
    select 1 from public.classroom_memberships
    where classroom_id = _classroom and user_id = _user and status = 'active'
  ) then
    return _classroom;
  end if;

  if not _open then
    raise exception 'Enrollment is closed';
  end if;

  if _capacity is not null then
    select count(*) into _seats
    from public.classroom_memberships
    where classroom_id = _classroom and status = 'active';
    if _seats >= _capacity then
      raise exception 'Class is full';
    end if;
  end if;

  perform 1 from public.organizations where id = _org for update;

  _max_students := public.org_max_students(_org);
  if _max_students is not null
    and public.org_learner_count(_org, _user) >= _max_students then
    raise exception 'PLAN_STUDENT_LIMIT';
  end if;

  insert into public.classroom_memberships (classroom_id, user_id, status, joined_at, ended_at)
  values (_classroom, _user, 'active', now(), null)
  on conflict (classroom_id, user_id)
  do update set status = 'active', joined_at = now(), ended_at = null;

  return _classroom;
end;
$$;

drop function public.create_class_session(uuid, text, timestamptz, integer, text, text);

create function public.create_class_session(
  _classroom uuid,
  _title text,
  _starts_at timestamptz,
  _duration_minutes integer,
  _time_zone text,
  _meeting_url text,
  _format text,
  _location text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _status text;
  _id uuid;
begin
  _meeting_url := nullif(btrim(_meeting_url), '');
  _location := nullif(btrim(_location), '');

  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  select status into _status from public.classrooms where id = _classroom;
  if _status <> 'active' then
    raise exception 'Class is archived';
  end if;
  if length(btrim(_title)) not between 1 and 120 then
    raise exception 'Invalid title';
  end if;
  if _duration_minutes not between 5 and 480 then
    raise exception 'Invalid duration';
  end if;
  if not exists (select 1 from pg_timezone_names where name = _time_zone) then
    raise exception 'Invalid time zone';
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

  insert into public.class_sessions
    (classroom_id, title, starts_at, duration_minutes, time_zone, meeting_url, format, location)
  values
    (_classroom, btrim(_title), _starts_at, _duration_minutes, _time_zone, _meeting_url, _format, _location)
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.set_classroom_offering(uuid, date, date, integer, integer, boolean) from public, anon;
grant execute on function public.set_classroom_offering(uuid, date, date, integer, integer, boolean) to authenticated;
revoke all on function public.create_class_session(uuid, text, timestamptz, integer, text, text, text, text) from public, anon;
grant execute on function public.create_class_session(uuid, text, timestamptz, integer, text, text, text, text) to authenticated;
