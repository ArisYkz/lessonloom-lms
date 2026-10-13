-- Class membership grants access to the class's course, and class members count toward
-- the organization's student limit through the same helpers the join function uses.

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
      where cl.course_id = _course and m.user_id = _user
        and m.status = 'active' and cl.status = 'active'
    )
  )
$$;

-- Same lock and ordering as 0012; only the student count changes source.
CREATE OR REPLACE FUNCTION public.enroll_free_course(_course uuid, _user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _organization uuid;
  _price_model public.price_model;
  _status public.course_status;
  _max_students integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT organization_id, price_model, status
  INTO _organization, _price_model, _status
  FROM public.courses
  WHERE id = _course;

  IF _organization IS NULL OR _status <> 'published' THEN
    RAISE EXCEPTION 'Course unavailable';
  END IF;

  IF _price_model <> 'free' THEN
    RAISE EXCEPTION 'This course requires a subscription';
  END IF;

  PERFORM 1 FROM public.organizations WHERE id = _organization FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = _course AND user_id = _user
  ) THEN
    RETURN 'already_enrolled';
  END IF;

  _max_students := public.org_max_students(_organization);

  IF _max_students IS NOT NULL
    AND public.org_learner_count(_organization, _user) >= _max_students THEN
    RETURN 'plan_student_limit';
  END IF;

  INSERT INTO public.enrollments (user_id, course_id)
  VALUES (_user, _course);

  RETURN 'enrolled';
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_free_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_free_course(uuid, uuid) TO authenticated;
