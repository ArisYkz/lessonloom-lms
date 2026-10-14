-- Free tier: Starter teachers get one active class; Pro has no class limit (NULL).
alter table public.teacher_plans
  add column max_classrooms integer check (max_classrooms is null or max_classrooms >= 0);
update public.teacher_plans set max_classrooms = 1 where code = 'starter';

create or replace function public.org_max_classrooms(_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select tp.max_classrooms
  from public.teacher_plans tp
  where tp.code = coalesce(
    (select os.plan_code from public.org_subscriptions os
     where os.organization_id = _org and os.status = 'ACTIVE' limit 1),
    'starter')
$$;

create or replace function public.assert_classroom_plan_limit(_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _max integer;
  _count integer;
begin
  perform 1 from public.organizations where id = _org for update;

  _max := public.org_max_classrooms(_org);
  if _max is null then
    return;
  end if;

  select count(*) into _count from public.classrooms where organization_id = _org and status = 'active';
  if _count >= _max then
    raise exception 'PLAN_CLASS_LIMIT';
  end if;
end;
$$;

create or replace function public.create_classroom(_course uuid, _name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _org uuid;
  _status text;
  _id uuid;
begin
  select organization_id, status into _org, _status from public.courses where id = _course;
  if _org is null or not public.owns_org(_org) then
    raise exception 'Forbidden';
  end if;
  if _status <> 'published' then
    raise exception 'Course must be published before creating a class';
  end if;
  perform public.assert_classroom_plan_limit(_org);

  insert into public.classrooms (organization_id, course_id, name, join_code)
  values (_org, _course, btrim(_name), public.new_classroom_join_code())
  returning id into _id;

  return _id;
end;
$$;

create or replace function public.set_classroom_status(_classroom uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _org uuid;
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;
  if _status not in ('active', 'archived') then
    raise exception 'Invalid status';
  end if;

  if _status = 'active' and (select status from public.classrooms where id = _classroom) <> 'active' then
    select organization_id into _org from public.classrooms where id = _classroom;
    perform public.assert_classroom_plan_limit(_org);
  end if;

  update public.classrooms set status = _status where id = _classroom;
end;
$$;

revoke all on function public.org_max_classrooms(uuid) from public, anon, authenticated;
revoke all on function public.assert_classroom_plan_limit(uuid) from public, anon, authenticated;
