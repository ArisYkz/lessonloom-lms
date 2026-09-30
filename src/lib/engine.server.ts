import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rpc = { rpc: (fn: any, args: any) => PromiseLike<{ data: unknown }> };

export async function assertAccess(supabase: unknown, courseId: string, userId: string) {
  const { data } = await (supabase as Rpc).rpc("has_course_access", { _course: courseId, _user: userId });
  if (!data) throw new Error("No access to this course");
}

export async function isEditor(supabase: unknown, courseId: string) {
  const { data } = await (supabase as Rpc).rpc("can_edit_course", { _course: courseId });
  return !!data;
}

export async function assertEditor(supabase: unknown, courseId: string) {
  if (!(await isEditor(supabase, courseId))) throw new Error("Forbidden");
}

export async function lessonCourse(lessonId: string) {
  const { data } = await supabaseAdmin
    .from("lessons")
    .select("id, course_id, title, discussion_enabled, courses(slug, title, organizations(owner_id))")
    .eq("id", lessonId)
    .maybeSingle();
  if (!data) throw new Error("Lesson not found");
  const c = data.courses as unknown as { slug: string; title: string; organizations: { owner_id: string } | null };
  return {
    lessonId: data.id,
    courseId: data.course_id,
    title: data.title,
    discussionEnabled: data.discussion_enabled,
    slug: c.slug,
    courseTitle: c.title,
    ownerId: c.organizations?.owner_id ?? null,
  };
}

export async function notify(userId: string | null, kind: string, title: string, link: string) {
  if (!userId) return;
  await supabaseAdmin.from("notifications").insert({ user_id: userId, kind, title, link });
}

export async function namesFor(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || "—"]));
}

/** Returns lesson ids whose required homework/quiz the user has not satisfied. */
export async function unmetRequirements(lessonId: string, userId: string) {
  const missing: ("homework" | "quiz")[] = [];
  const { data: hw } = await supabaseAdmin.from("homework").select("id, required").eq("lesson_id", lessonId).maybeSingle();
  if (hw?.required) {
    const { data: sub } = await supabaseAdmin
      .from("homework_submissions")
      .select("status")
      .eq("homework_id", hw.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub || sub.status === "needs_revision") missing.push("homework");
  }
  const { data: quiz } = await supabaseAdmin.from("quizzes").select("id, required").eq("lesson_id", lessonId).maybeSingle();
  if (quiz?.required) {
    const { data: passed } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quiz.id)
      .eq("user_id", userId)
      .eq("passed", true)
      .limit(1);
    if (!passed || passed.length === 0) missing.push("quiz");
  }
  return missing;
}
