DROP POLICY IF EXISTS "profiles are public" ON public.profiles;
CREATE POLICY "own profile or admin read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enroll_free_course(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_course(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_free_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) TO authenticated;