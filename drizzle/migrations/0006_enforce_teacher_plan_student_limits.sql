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
  _student_count bigint;
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

  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = _course AND user_id = _user
  ) THEN
    RETURN 'already_enrolled';
  END IF;

  SELECT tp.max_students
  INTO _max_students
  FROM public.teacher_plans tp
  WHERE tp.code = COALESCE(
    (
      SELECT os.plan_code
      FROM public.org_subscriptions os
      WHERE os.organization_id = _organization
        AND os.status = 'ACTIVE'
      LIMIT 1
    ),
    'starter'
  );

  IF _max_students IS NOT NULL THEN
    SELECT count(DISTINCT learner_id)
    INTO _student_count
    FROM (
      SELECT e.user_id AS learner_id
      FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE c.organization_id = _organization
      UNION
      SELECT s.user_id AS learner_id
      FROM public.subscriptions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE c.organization_id = _organization
        AND s.status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ) learners;

    IF _student_count >= _max_students THEN
      RETURN 'plan_student_limit';
    END IF;
  END IF;

  INSERT INTO public.enrollments (user_id, course_id)
  VALUES (_user, _course);

  RETURN 'enrolled';
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_free_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_free_course(uuid, uuid) TO authenticated;