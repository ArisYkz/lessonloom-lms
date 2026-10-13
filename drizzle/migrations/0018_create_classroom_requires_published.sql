-- A class only grants access to a published course (see 0016), so creating one on a draft is rejected.
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

  insert into public.classrooms (organization_id, course_id, name, join_code)
  values (_org, _course, btrim(_name), public.new_classroom_join_code())
  returning id into _id;

  return _id;
end;
$$;
