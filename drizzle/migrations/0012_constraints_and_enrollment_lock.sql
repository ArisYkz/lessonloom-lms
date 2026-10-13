-- Value and user-reference checks. NOT VALID: new and updated rows are checked now;
-- existing rows are checked by VALIDATE CONSTRAINT after the data audit.

ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (preferred_locale IN ('kk', 'ru', 'en')) NOT VALID;

ALTER TABLE public.danmaku ADD CONSTRAINT danmaku_color_check
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$') NOT VALID;

ALTER TABLE public.danmaku ADD CONSTRAINT danmaku_mode_check
  CHECK (mode IN ('scroll', 'top', 'bottom')) NOT VALID;

ALTER TABLE public.homework_submissions ADD CONSTRAINT homework_submissions_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.homework_submissions ADD CONSTRAINT homework_submissions_reviewer_auth_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.discussion_threads ADD CONSTRAINT discussion_threads_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.discussion_replies ADD CONSTRAINT discussion_replies_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.danmaku ADD CONSTRAINT danmaku_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.danmaku_blocks ADD CONSTRAINT danmaku_blocks_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_auth_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;

-- Indexes for foreign-key columns, so cascades and set-nulls do not scan whole tables.
CREATE INDEX homework_submissions_user_idx ON public.homework_submissions (user_id);
CREATE INDEX homework_submissions_reviewer_idx ON public.homework_submissions (reviewed_by);
CREATE INDEX discussion_threads_user_idx ON public.discussion_threads (user_id);
CREATE INDEX discussion_replies_thread_idx ON public.discussion_replies (thread_id);
CREATE INDEX discussion_replies_user_idx ON public.discussion_replies (user_id);
CREATE INDEX danmaku_user_idx ON public.danmaku (user_id);
CREATE INDEX danmaku_blocks_organization_idx ON public.danmaku_blocks (organization_id);
CREATE INDEX danmaku_blocks_course_idx ON public.danmaku_blocks (course_id);
CREATE INDEX danmaku_blocks_user_idx ON public.danmaku_blocks (user_id);

-- Serializes free enrollments per organization so concurrent signups cannot
-- exceed the plan's student limit (the count below must not race with inserts).
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

  PERFORM 1 FROM public.organizations WHERE id = _organization FOR UPDATE;

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
