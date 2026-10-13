-- Course limits are enforced in the database so every insert path obeys them.
-- The organization row lock serializes concurrent inserts for one teacher,
-- which closes the check-then-insert race in createCourse.

update public.teacher_plans set max_courses = 3 where code = 'starter' and max_courses is distinct from 3;

create or replace function public.enforce_course_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _plan_code text;
  _max integer;
  _count bigint;
begin
  perform 1 from public.organizations where id = new.organization_id for update;

  select os.plan_code into _plan_code
  from public.org_subscriptions os
  where os.organization_id = new.organization_id and os.status = 'ACTIVE'
  limit 1;

  select tp.max_courses into _max
  from public.teacher_plans tp
  where tp.code = coalesce(_plan_code, 'starter');

  if not found then
    _max := 3;
  end if;

  if _max is null then
    return new;
  end if;

  select count(*) into _count from public.courses where organization_id = new.organization_id;

  if _count >= _max then
    raise exception 'PLAN_LIMIT';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_course_plan_limit() from public, anon, authenticated;

create trigger courses_enforce_plan_limit
  before insert on public.courses
  for each row execute function public.enforce_course_plan_limit();
