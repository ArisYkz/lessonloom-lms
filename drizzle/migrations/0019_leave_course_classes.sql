-- Leaving a class-granted course ends every class that grants it, so the course actually goes away.
create or replace function public.leave_course_classes(_course uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  update public.classroom_memberships m
  set status = 'left', ended_at = now()
  from public.classrooms c
  where c.id = m.classroom_id and c.course_id = _course
    and m.user_id = auth.uid() and m.status = 'active';
  if not found then
    raise exception 'Not a member';
  end if;
end;
$$;

revoke all on function public.leave_course_classes(uuid) from public, anon;
grant execute on function public.leave_course_classes(uuid) to authenticated;
