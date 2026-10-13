-- The free (starter) plan allows 3 students per organization. Pro stays unlimited (NULL).
update public.teacher_plans set max_students = 3 where code = 'starter';
