-- Child rows must reference parents in the same course.
-- Foreign keys are added NOT VALID: new and updated rows are checked at once,
-- while existing rows are checked by VALIDATE CONSTRAINT after they have been audited.

alter table public.sections add constraint sections_id_course_key unique (id, course_id);
alter table public.lessons add constraint lessons_id_course_key unique (id, course_id);
alter table public.quizzes add constraint quizzes_id_course_key unique (id, course_id);
alter table public.quizzes add constraint quizzes_id_lesson_course_key unique (id, lesson_id, course_id);
alter table public.quiz_questions add constraint quiz_questions_id_course_key unique (id, course_id);
alter table public.homework add constraint homework_id_lesson_course_key unique (id, lesson_id, course_id);
alter table public.discussion_threads add constraint discussion_threads_id_course_key unique (id, course_id);

alter table public.lessons add constraint lessons_section_same_course_fkey
  foreign key (section_id, course_id) references public.sections (id, course_id) on delete cascade not valid;

alter table public.lesson_resources add constraint lesson_resources_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;

alter table public.homework add constraint homework_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;

alter table public.homework_submissions add constraint homework_submissions_homework_same_lesson_fkey
  foreign key (homework_id, lesson_id, course_id) references public.homework (id, lesson_id, course_id) on delete cascade not valid;

alter table public.quizzes add constraint quizzes_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;

alter table public.quiz_questions add constraint quiz_questions_quiz_same_course_fkey
  foreign key (quiz_id, course_id) references public.quizzes (id, course_id) on delete cascade not valid;

alter table public.quiz_options add constraint quiz_options_question_same_course_fkey
  foreign key (question_id, course_id) references public.quiz_questions (id, course_id) on delete cascade not valid;

alter table public.quiz_attempts add constraint quiz_attempts_quiz_same_lesson_fkey
  foreign key (quiz_id, lesson_id, course_id) references public.quizzes (id, lesson_id, course_id) on delete cascade not valid;

alter table public.discussion_threads add constraint discussion_threads_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;

alter table public.discussion_replies add constraint discussion_replies_thread_same_course_fkey
  foreign key (thread_id, course_id) references public.discussion_threads (id, course_id) on delete cascade not valid;

alter table public.lesson_progress add constraint lesson_progress_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;

alter table public.danmaku add constraint danmaku_lesson_same_course_fkey
  foreign key (lesson_id, course_id) references public.lessons (id, course_id) on delete cascade not valid;
