-- Class sessions: one scheduled meeting in a class. Class members and the owner can read them
-- while the class is active; writes are SECURITY DEFINER functions owned by the class owner.

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  time_zone text not null,
  meeting_url text check (meeting_url ~ '^https://\S+$' and length(meeting_url) <= 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now()
);
create index on public.class_sessions (classroom_id, starts_at);

alter table public.class_sessions enable row level security;
revoke all on public.class_sessions from anon, authenticated;
grant select on public.class_sessions to authenticated;

create policy "owners and active members read sessions" on public.class_sessions for select to authenticated
  using (
    public.owns_classroom(classroom_id)
    or (
      public.is_active_classroom_member(classroom_id, auth.uid())
      and exists (select 1 from public.classrooms c where c.id = classroom_id and c.status = 'active')
    )
  );

create or replace function public.create_class_session(
  _classroom uuid,
  _title text,
  _starts_at timestamptz,
  _duration_minutes integer,
  _time_zone text,
  _meeting_url text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _status text;
  _id uuid;
begin
  _meeting_url := nullif(btrim(_meeting_url), '');

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
  if _meeting_url is not null and (_meeting_url !~ '^https://\S+$' or length(_meeting_url) > 500) then
    raise exception 'Meeting link must use https';
  end if;

  insert into public.class_sessions (classroom_id, title, starts_at, duration_minutes, time_zone, meeting_url)
  values (_classroom, btrim(_title), _starts_at, _duration_minutes, _time_zone, _meeting_url)
  returning id into _id;

  return _id;
end;
$$;

create or replace function public.cancel_class_session(_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _classroom uuid;
begin
  select classroom_id into _classroom from public.class_sessions where id = _session;
  if _classroom is null or not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;

  update public.class_sessions set status = 'cancelled' where id = _session;
end;
$$;

revoke all on function public.create_class_session(uuid, text, timestamptz, integer, text, text) from public, anon;
revoke all on function public.cancel_class_session(uuid) from public, anon;
grant execute on function public.create_class_session(uuid, text, timestamptz, integer, text, text) to authenticated;
grant execute on function public.cancel_class_session(uuid) to authenticated;
