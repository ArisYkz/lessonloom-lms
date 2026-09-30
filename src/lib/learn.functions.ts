import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role as string);
  });

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signPath } = await import("./media.server");
    const { data } = await context.supabase
      .from("profiles")
      .select("id, full_name, avatar_url, bio, preferred_locale, default_mode")
      .eq("id", context.userId)
      .maybeSingle();
    if (!data) return null;
    const { data: org } = await context.supabase.from("organizations").select("id").eq("owner_id", context.userId).maybeSingle();
    return { ...data, hasOrg: !!org, avatarUrl: await signPath(data.avatar_url) };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; bio: string; preferredLocale: string; avatarPath?: string | null; defaultMode?: "student" | "teacher" }) => input)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      full_name: data.fullName,
      bio: data.bio,
      preferred_locale: data.preferredLocale,
    };
    if (data.avatarPath !== undefined) patch["avatar_url"] = data.avatarPath;
    if (data.defaultMode) patch["default_mode"] = data.defaultMode === "teacher" ? "teacher" : "student";
    const { error } = await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signMany } = await import("./media.server");
    const { data: enrollments } = await context.supabase
      .from("enrollments")
      .select("course_id, created_at, courses(id, slug, title, thumbnail_url, organizations(name))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    const rows = enrollments ?? [];
    const courseIds = rows.map((r) => r.course_id);
    if (courseIds.length === 0) return [];

    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds);
    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("lesson_id, course_id")
      .eq("user_id", context.userId)
      .in("course_id", courseIds);

    const signed = await signMany(
      rows.map((r) => (r.courses as unknown as { thumbnail_url: string | null } | null)?.thumbnail_url),
    );

    return rows.map((r) => {
      const c = r.courses as unknown as {
        id: string;
        slug: string;
        title: string;
        thumbnail_url: string | null;
        organizations: { name: string } | null;
      };
      const total = (lessons ?? []).filter((l) => l.course_id === r.course_id).length;
      const done = (progress ?? []).filter((p) => p.course_id === r.course_id).length;
      return {
        slug: c.slug,
        title: c.title,
        teacherName: c.organizations?.name ?? "",
        thumbnailUrl: c.thumbnail_url ? (signed.get(c.thumbnail_url) ?? null) : null,
        total,
        done,
        percent: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    });
  });

export const enrollFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("enroll_free_course", {
      _course: data.courseId,
      _user: context.userId,
    });
    if (error) throw new Error(error.message);
    if (result === "plan_student_limit") throw new Error("PLAN_STUDENT_LIMIT");
    return { ok: true };
  });

export const getEnrollmentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: enrolled } = await context.supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: data.courseId,
      _user: context.userId,
    });
    return { enrolled: !!enrolled, access: !!access };
  });

export const getPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, slug, title, status, price_model, preview_seconds, organizations(name, slug)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) return null;

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: course.id,
      _user: context.userId,
    });
    const previewMode =
      !access && course.status === "published" && course.price_model === "subscription" && course.preview_seconds > 0;
    if (!access && !previewMode) return { title: course.title, access: false, preview: false, sections: [], progress: [] };

    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position");
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("id, section_id, title, type, position, duration_minutes, is_preview")
      .eq("course_id", course.id)
      .order("position");
    const visibleLessons = previewMode ? (lessons ?? []).filter((l) => l.type === "video" || l.is_preview) : (lessons ?? []);
    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", context.userId)
      .eq("course_id", course.id);

    return {
      courseId: course.id,
      title: course.title,
      teacherName: (course.organizations as unknown as { name: string } | null)?.name ?? "",
      teacherSlug: (course.organizations as unknown as { slug: string } | null)?.slug ?? "",
      access: true,
      preview: previewMode,
      previewSeconds: course.preview_seconds,
      sections: (sections ?? [])
        .map((s) => ({
          id: s.id,
          title: s.title,
          lessons: visibleLessons.filter((l) => l.section_id === s.id),
        }))
        .filter((s) => s.lessons.length > 0),
      progress: (progress ?? []).map((p) => p.lesson_id),
    };
  });

export const getLessonContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath } = await import("./media.server");
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, course_id, title, type, body, media_path, duration_minutes, is_preview, danmaku_enabled, courses(status, price_model, preview_seconds)")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: lesson.course_id,
      _user: context.userId,
    });
    const c = lesson.courses as unknown as { status: string; price_model: string; preview_seconds: number } | null;
    let previewLimit: number | null = null;
    if (!access) {
      const published = c?.status === "published";
      if (published && lesson.is_preview) {
        previewLimit = null;
      } else if (published && c?.price_model === "subscription" && lesson.type === "video" && c.preview_seconds > 0) {
        previewLimit = c.preview_seconds;
      } else {
        throw new Error("No access to this lesson");
      }
    }

    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      body: lesson.body,
      mediaUrl: await signPath(lesson.media_path, previewLimit ? 60 * 30 : 60 * 60 * 4),
      durationMinutes: lesson.duration_minutes,
      courseId: lesson.course_id,
      previewLimit,
      hasAccess: !!access,
      danmakuEnabled: lesson.danmaku_enabled,
    };
  });

export const setLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; courseId: string; completed: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.completed) {
      const { unmetRequirements } = await import("./engine.server");
      const missing = await unmetRequirements(data.lessonId, context.userId);
      if (missing.length > 0) return { ok: false, missing };
      const { error } = await context.supabase
        .from("lesson_progress")
        .upsert(
          { user_id: context.userId, lesson_id: data.lessonId, course_id: data.courseId, completed: true },
          { onConflict: "user_id,lesson_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      await context.supabase
        .from("lesson_progress")
        .delete()
        .eq("user_id", context.userId)
        .eq("lesson_id", data.lessonId);
    }
    return { ok: true, missing: [] as ("homework" | "quiz")[] };
  });
