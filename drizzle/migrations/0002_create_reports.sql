CREATE TYPE public.report_status AS ENUM ('OPEN','UNDER_REVIEW','RESOLVED','DISMISSED');
CREATE TYPE public.report_target_type AS ENUM ('course','teacher','lesson');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  description text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'OPEN',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users read own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));