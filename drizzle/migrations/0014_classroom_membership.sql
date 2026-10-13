-- Classroom membership writes. Every write is a SECURITY DEFINER function so join codes
-- and membership state stay server-controlled.

create or replace function public.new_classroom_join_code()
returns text language sql volatile set search_path = public as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;

-- Learners across enrollments, subscriptions and active classes in one organization,
-- not counting `_exclude`, so the caller can ask whether one more learner fits.
create or replace function public.org_learner_count(_org uuid, _exclude uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(distinct learner_id) from (
    select e.user_id as learner_id
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where c.organization_id = _org
    union
    select s.user_id
    from public.subscriptions s
    join public.courses c on c.id = s.course_id
    where c.organization_id = _org
      and s.status in ('ACTIVE', 'PAST_DUE', 'CANCELLED')
      and (s.current_period_end is null or s.current_period_end > now())
    union
    select m.user_id
    from public.classroom_memberships m
    join public.classrooms cl on cl.id = m.classroom_id
    where cl.organization_id = _org and cl.status = 'active' and m.status = 'active'
  ) learners
  where learner_id <> _exclude
$$;

create or replace function public.org_max_students(_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select tp.max_students
  from public.teacher_plans tp
  where tp.code = coalesce(
    (select os.plan_code from public.org_subscriptions os
     where os.organization_id = _org and os.status = 'ACTIVE' limit 1),
    'starter')
$$;

revoke all on function public.new_classroom_join_code() from public, anon, authenticated;
revoke all on function public.org_learner_count(uuid, uuid) from public, anon, authenticated;
revoke all on function public.org_max_students(uuid) from public, anon, authenticated;

create or replace function public.create_classroom(_course uuid, _name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _org uuid;
  _id uuid;
begin
  select organization_id into _org from public.courses where id = _course;
  if _org is null or not public.owns_org(_org) then
    raise exception 'Forbidden';
  end if;

  insert into public.classrooms (organization_id, course_id, name, join_code)
  values (_org, _course, btrim(_name), public.new_classroom_join_code())
  returning id into _id;

  return _id;
end;
$$;

create or replace function public.get_classroom_join_code(_classroom uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _code text;
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;

  select join_code into _code from public.classrooms where id = _classroom;
  return _code;
end;
$$;

create or replace function public.rotate_classroom_join_code(_classroom uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _code text;
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;

  update public.classrooms
  set join_code = public.new_classroom_join_code()
  where id = _classroom
  returning join_code into _code;

  return _code;
end;
$$;

create or replace function public.set_classroom_status(_classroom uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if _status not in ('active', 'archived') then
    raise exception 'Invalid status';
  end if;

  update public.classrooms set status = _status where id = _classroom;
end;
$$;

create or replace function public.join_classroom(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
  _classroom uuid;
  _org uuid;
  _max_students integer;
begin
  if _user is null then
    raise exception 'Unauthorized';
  end if;

  select id, organization_id into _classroom, _org
  from public.classrooms
  where join_code = upper(btrim(_code)) and status = 'active';
  if _classroom is null then
    raise exception 'Invalid join code';
  end if;

  if exists (
    select 1 from public.classroom_memberships
    where classroom_id = _classroom and user_id = _user and status = 'active'
  ) then
    return _classroom;
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

create or replace function public.leave_classroom(_classroom uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  update public.classroom_memberships
  set status = 'left', ended_at = now()
  where classroom_id = _classroom and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Not a member';
  end if;
end;
$$;

create or replace function public.remove_classroom_member(_classroom uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;

  update public.classroom_memberships
  set status = 'removed', ended_at = now()
  where classroom_id = _classroom and user_id = _user and status = 'active';
  if not found then
    raise exception 'Not a member';
  end if;
end;
$$;

revoke all on function public.create_classroom(uuid, text) from public, anon;
revoke all on function public.get_classroom_join_code(uuid) from public, anon;
revoke all on function public.rotate_classroom_join_code(uuid) from public, anon;
revoke all on function public.set_classroom_status(uuid, text) from public, anon;
revoke all on function public.join_classroom(text) from public, anon;
revoke all on function public.leave_classroom(uuid) from public, anon;
revoke all on function public.remove_classroom_member(uuid, uuid) from public, anon;

grant execute on function public.create_classroom(uuid, text) to authenticated;
grant execute on function public.get_classroom_join_code(uuid) to authenticated;
grant execute on function public.rotate_classroom_join_code(uuid) to authenticated;
grant execute on function public.set_classroom_status(uuid, text) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.leave_classroom(uuid) to authenticated;
grant execute on function public.remove_classroom_member(uuid, uuid) to authenticated;
