import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BANNED = ["http://", "https://", "www.", "хуй", "пизд", "бля", "fuck", "shit"];
const COLORS = ["#ffffff", "#fde047", "#86efac", "#93c5fd", "#fca5a5", "#f0abfc"];

/** Student + teacher: visible comments for a lesson (RLS hides hidden ones from non-editors). */
export const listDanmaku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("danmaku")
      .select("id, time_ms, text, color, mode, user_id, hidden")
      .eq("lesson_id", data.lessonId)
      .eq("hidden", false)
      .order("time_ms")
      .limit(3000);
    return (rows ?? []).map((r) => ({ ...r, mine: r.user_id === context.userId }));
  });

export const postDanmaku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { lessonId: string; timeMs: number; text: string; color?: string; mode?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const text = data.text.trim().replace(/\s+/g, " ");
    if (!text || text.length > 100) throw new Error("DANMAKU_LENGTH");
    const lower = text.toLowerCase();
    if (BANNED.some((w) => lower.includes(w))) throw new Error("DANMAKU_BLOCKED_WORD");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, course_id, danmaku_enabled, courses(organization_id)")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson || !lesson.danmaku_enabled) throw new Error("DANMAKU_OFF");
    const orgId = (lesson.courses as unknown as { organization_id: string } | null)
      ?.organization_id;

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: lesson.course_id,
      _user: context.userId,
    });
    if (!access) throw new Error("No access to this lesson");

    const { data: blocks } = await supabaseAdmin
      .from("danmaku_blocks")
      .select("course_id")
      .eq("organization_id", orgId!)
      .eq("user_id", context.userId);
    if ((blocks ?? []).some((b) => b.course_id === null || b.course_id === lesson.course_id))
      throw new Error("DANMAKU_BLOCKED");

    const { data: last } = await supabaseAdmin
      .from("danmaku")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < 5000)
      throw new Error("DANMAKU_RATE");

    const color = COLORS.includes(data.color ?? "") ? data.color! : "#ffffff";
    const mode = ["scroll", "top", "bottom"].includes(data.mode ?? "") ? data.mode! : "scroll";
    const { data: row, error } = await supabaseAdmin
      .from("danmaku")
      .insert({
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        user_id: context.userId,
        time_ms: Math.max(0, Math.round(data.timeMs)),
        text,
        color,
        mode,
      })
      .select("id, time_ms, text, color, mode")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Teacher: all comments across a course, for moderation. */
export const listCourseDanmaku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: can } = await context.supabase.rpc("can_edit_course", { _course: data.courseId });
    if (!can) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { data: lessons }, { data: course }] = await Promise.all([
      supabaseAdmin
        .from("danmaku")
        .select("id, lesson_id, user_id, time_ms, text, hidden, created_at")
        .eq("course_id", data.courseId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("lessons").select("id, title").eq("course_id", data.courseId),
      supabaseAdmin.from("courses").select("organization_id").eq("id", data.courseId).single(),
    ]);
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const [{ data: profiles }, { data: blocks }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      supabaseAdmin
        .from("danmaku_blocks")
        .select("id, user_id, course_id")
        .eq("organization_id", course!.organization_id),
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const titles = new Map((lessons ?? []).map((l) => [l.id, l.title]));
    return {
      comments: (rows ?? []).map((r) => ({
        ...r,
        lessonTitle: titles.get(r.lesson_id) ?? "",
        userName: names.get(r.user_id) || "—",
        blocked: (blocks ?? []).some(
          (b) => b.user_id === r.user_id && (b.course_id === null || b.course_id === data.courseId),
        ),
      })),
      blocks: (blocks ?? []).map((b) => ({ ...b, userName: names.get(b.user_id) || "—" })),
    };
  });

export const setDanmakuHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; hidden: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("danmaku")
      .select("course_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { data: can } = await context.supabase.rpc("can_edit_course", { _course: row.course_id });
    if (!can) throw new Error("Forbidden");
    await supabaseAdmin.from("danmaku").update({ hidden: data.hidden }).eq("id", data.id);
    return { ok: true };
  });

export const deleteDanmaku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("danmaku")
      .select("course_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { data: can } = await context.supabase.rpc("can_edit_course", { _course: row.course_id });
    if (!can) throw new Error("Forbidden");
    await supabaseAdmin.from("danmaku").delete().eq("id", data.id);
    return { ok: true };
  });

export const blockDanmakuUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { courseId: string; userId: string; allCourses: boolean; block: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: can } = await context.supabase.rpc("can_edit_course", { _course: data.courseId });
    if (!can) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("organization_id")
      .eq("id", data.courseId)
      .single();
    const orgId = course!.organization_id;
    if (data.block) {
      await supabaseAdmin.from("danmaku_blocks").insert({
        organization_id: orgId,
        course_id: data.allCourses ? null : data.courseId,
        user_id: data.userId,
      });
      await supabaseAdmin
        .from("danmaku")
        .update({ hidden: true })
        .eq("user_id", data.userId)
        .eq("course_id", data.courseId);
    } else {
      await supabaseAdmin
        .from("danmaku_blocks")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", data.userId);
    }
    return { ok: true };
  });
