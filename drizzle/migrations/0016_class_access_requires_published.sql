-- Class membership grants access only while the course is published, matching how free
-- enrollment and subscriptions reach lessons. Owners and admins keep access to drafts.

create or replace function public.has_course_access(_course uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user = auth.uid() and (
    exists (select 1 from public.courses c join public.organizations o on o.id = c.organization_id
            where c.id = _course and o.owner_id = _user)
    or public.has_role(_user,'admin')
    or exists (
      select 1 from public.enrollments e join public.courses c on c.id = e.course_id
      where e.course_id = _course and e.user_id = _user and c.price_model = 'free'
    )
    or exists (
      select 1 from public.subscriptions s
      where s.course_id = _course and s.user_id = _user and s.status = 'ACTIVE'
        and (s.current_period_end is null or s.current_period_end > now())
    )
    or exists (
      select 1 from public.classroom_memberships m
      join public.classrooms cl on cl.id = m.classroom_id
      join public.courses c on c.id = cl.course_id
      where cl.course_id = _course and m.user_id = _user
        and m.status = 'active' and cl.status = 'active' and c.status = 'published'
    )
  )
$$;
