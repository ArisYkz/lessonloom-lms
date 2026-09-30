import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role as string);
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signPath } = await import("./media.server");
    const { data } = await context.supabase
      .from("profiles")
      .select("id, full_name, avatar_url, bio, preferred_locale")
      .eq("id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return { ...data, avatarUrl: await signPath(data.avatar_url) };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; bio: string; preferredLocale: string; avatarPath?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      full_name: data.fullName,
      bio: data.bio,
      preferred_locale: data.preferredLocale,
    };
    if (data.avatarPath !== undefined) patch["avatar_url"] = data.avatarPath;
    const { error } = await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyLearning = createServerFn({ method: "GET" })
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
    const { data: course } = await context.supabase
      .from("courses")
      .select("id, price_model, status")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || course.status !== "published") throw new Error("Course unavailable");
    if (course.price_model !== "free") throw new Error("This course requires a subscription");

    const { error } = await context.supabase
      .from("enrollments")
      .insert({ user_id: context.userId, course_id: data.courseId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const getEnrollmentState = createServerFn({ method: "GET" })
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

export const getPlayer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, slug, title, organizations(name)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) return null;

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: course.id,
      _user: context.userId,
    });
    if (!access) return { title: course.title, access: false, sections: [], progress: [] };

    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position");
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("id, section_id, title, type, position, duration_minutes")
      .eq("course_id", course.id)
      .order("position");
    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", context.userId)
      .eq("course_id", course.id);

    return {
      courseId: course.id,
      title: course.title,
      teacherName: (course.organizations as unknown as { name: string } | null)?.name ?? "",
      access: true,
      sections: (sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        lessons: (lessons ?? []).filter((l) => l.section_id === s.id),
      })),
      progress: (progress ?? []).map((p) => p.lesson_id),
    };
  });

export const getLessonContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath } = await import("./media.server");
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, course_id, title, type, body, media_path, duration_minutes")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: lesson.course_id,
      _user: context.userId,
    });
    if (!access) throw new Error("No access to this lesson");

    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      body: lesson.body,
      mediaUrl: await signPath(lesson.media_path, 60 * 60 * 4),
      durationMinutes: lesson.duration_minutes,
    };
  });

export const setLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; courseId: string; completed: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.completed) {
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
    return { ok: true };
  });
