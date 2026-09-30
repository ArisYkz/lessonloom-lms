ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS discussion_enabled boolean NOT NULL DEFAULT false;

CREATE TYPE public.submission_status AS ENUM ('submitted','needs_revision','reviewed');

CREATE TABLE public.lesson_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  media_path text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructions text NOT NULL DEFAULT '',
  allow_text boolean NOT NULL DEFAULT true,
  allow_file boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT false,
  max_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  file_paths text[] NOT NULL DEFAULT '{}',
  status public.submission_status NOT NULL DEFAULT 'submitted',
  score integer,
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (homework_id, user_id)
);
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  passing_score integer NOT NULL DEFAULT 70,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question text NOT NULL,
  explanation text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.homework_submissions (course_id, status);
CREATE INDEX ON public.quiz_attempts (user_id, quiz_id);
CREATE INDEX ON public.discussion_threads (lesson_id);
CREATE INDEX ON public.notifications (user_id, created_at DESC);

GRANT SELECT ON public.lesson_resources, public.homework, public.homework_submissions, public.quizzes,
  public.quiz_questions, public.quiz_options, public.quiz_attempts, public.discussion_threads,
  public.discussion_replies TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.lesson_resources, public.homework, public.homework_submissions, public.quizzes,
  public.quiz_questions, public.quiz_options, public.quiz_attempts, public.discussion_threads,
  public.discussion_replies, public.notifications TO service_role;

ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources for learners" ON public.lesson_resources FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()));
CREATE POLICY "homework for learners" ON public.homework FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()));
CREATE POLICY "own or teacher submissions" ON public.homework_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.can_edit_course(course_id));
CREATE POLICY "quizzes for learners" ON public.quizzes FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()));
CREATE POLICY "questions for learners" ON public.quiz_questions FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()));
CREATE POLICY "options for editors" ON public.quiz_options FOR SELECT TO authenticated USING (public.can_edit_course(course_id));
CREATE POLICY "own or teacher attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.can_edit_course(course_id));
CREATE POLICY "threads for learners" ON public.discussion_threads FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()) AND (NOT hidden OR public.can_edit_course(course_id)));
CREATE POLICY "replies for learners" ON public.discussion_replies FOR SELECT TO authenticated USING (public.has_course_access(course_id, auth.uid()) AND (NOT hidden OR public.can_edit_course(course_id)));
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mark own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);