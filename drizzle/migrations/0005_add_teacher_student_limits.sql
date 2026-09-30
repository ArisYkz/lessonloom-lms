ALTER TABLE public.teacher_plans
ADD COLUMN IF NOT EXISTS max_students integer;

ALTER TABLE public.teacher_plans
ADD CONSTRAINT teacher_plans_max_students_positive
CHECK (max_students IS NULL OR max_students > 0);