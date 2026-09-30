ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_mode text NOT NULL DEFAULT 'student';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS preview_seconds integer NOT NULL DEFAULT 600;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS danmaku_enabled boolean NOT NULL DEFAULT true;
ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'danmaku';

-- public course stats (counts only, no personal data)
CREATE OR REPLACE FUNCTION public.course_stats()
RETURNS TABLE(course_id uuid, students bigint, recent bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select c.id,
    (select count(*) from public.enrollments e where e.course_id = c.id)
      + (select count(*) from public.subscriptions s where s.course_id = c.id and s.status = 'ACTIVE'),
    (select count(*) from public.enrollments e where e.course_id = c.id and e.created_at > now() - interval '14 days')
  from public.courses c where c.status = 'published'
$$;
GRANT EXECUTE ON FUNCTION public.course_stats() TO anon, authenticated;

-- Teacher platform plans
CREATE TABLE public.teacher_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_kzt integer NOT NULL DEFAULT 0,
  max_courses integer,
  position integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.teacher_plans TO anon, authenticated;
GRANT ALL ON public.teacher_plans TO service_role;
ALTER TABLE public.teacher_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.teacher_plans FOR SELECT USING (true);
CREATE POLICY "admins manage plans" ON public.teacher_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.teacher_plans (code, name, price_kzt, max_courses, position) VALUES
  ('starter','Starter',0,1,0), ('pro','Pro',9900,NULL,1);

CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.teacher_plans(code),
  status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
  provider text NOT NULL DEFAULT 'manual',
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin reads org sub" ON public.org_subscriptions FOR SELECT TO authenticated
  USING (public.owns_org(organization_id) OR public.has_role(auth.uid(),'admin'));

-- Danmaku
CREATE TABLE public.danmaku (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  time_ms integer NOT NULL,
  text text NOT NULL,
  color text NOT NULL DEFAULT '#ffffff',
  mode text NOT NULL DEFAULT 'scroll',
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX danmaku_lesson_idx ON public.danmaku(lesson_id, time_ms);
GRANT SELECT ON public.danmaku TO authenticated;
GRANT ALL ON public.danmaku TO service_role;
ALTER TABLE public.danmaku ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read visible danmaku" ON public.danmaku FOR SELECT TO authenticated
  USING ((hidden = false AND public.course_is_published(course_id)) OR public.can_edit_course(course_id));

CREATE TABLE public.danmaku_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.danmaku_blocks TO authenticated;
GRANT ALL ON public.danmaku_blocks TO service_role;
ALTER TABLE public.danmaku_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org owner reads blocks" ON public.danmaku_blocks FOR SELECT TO authenticated
  USING (public.owns_org(organization_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.danmaku;