-- Classes are private by default. A teacher can list a class for public search; the listing
-- function exposes only name and course, never the join code or memberships.

alter table public.classrooms add column listed boolean not null default false;
grant select (listed) on public.classrooms to authenticated;

create or replace function public.set_classroom_listed(_classroom uuid, _listed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_classroom(_classroom) then
    raise exception 'Forbidden';
  end if;

  update public.classrooms set listed = _listed where id = _classroom;
end;
$$;

create or replace function public.list_public_classrooms(_limit integer default 50)
returns table (classroom_id uuid, classroom_name text, course_id uuid, course_title text)
language sql stable security definer set search_path = public as $$
  select cl.id, cl.name, cl.course_id, c.title
  from public.classrooms cl
  join public.courses c on c.id = cl.course_id
  where cl.listed and cl.status = 'active' and c.status = 'published'
  order by cl.created_at desc
  limit least(greatest(_limit, 1), 100)
$$;

revoke all on function public.set_classroom_listed(uuid, boolean) from public, anon;
grant execute on function public.set_classroom_listed(uuid, boolean) to authenticated;
revoke all on function public.list_public_classrooms(integer) from public;
grant execute on function public.list_public_classrooms(integer) to anon, authenticated;
