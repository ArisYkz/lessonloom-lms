-- Per-class due dates for course homework. Homework stays on the lesson; each class sets its own due time.
-- Writes go through a SECURITY DEFINER function owned by the class owner.

create table public.classroom_homework_due (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  homework_id uuid not null references public.homework (id) on delete cascade,
  due_at timestamptz not null,
  primary key (classroom_id, homework_id)
);

alter table public.classroom_homework_due enable row level security;
revoke all on public.classroom_homework_due from anon, authenticated;
grant select on public.classroom_homework_due to authenticated;

create policy "owners and active members read homework due" on public.classroom_homework_due for select to authenticated
  using (
    public.owns_classroom(classroom_id)
    or (
      public.is_active_classroom_member(classroom_id, auth.uid())
      and exists (select 1 from public.classrooms c where c.id = classroom_id and c.status = 'active')
    )
  );

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
    insert into public.classroom_homework_due (classroom_id, homework_id, due_at)
    values (_classroom, _homework, _due_at)
    on conflict (classroom_id, homework_id) do update set due_at = excluded.due_at;
  end if;
end;
$$;

revoke all on function public.set_classroom_homework_due(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.set_classroom_homework_due(uuid, uuid, timestamptz) to authenticated;
