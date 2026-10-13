import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOCALES } from "@/i18n/dictionary";

export const getMyRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role as string);
  });

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signPath } = await import("./media.server");
    const { data } = await context.supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, bio, preferred_locale, default_mode, show_photo_to_classmates",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (!data) return null;
    const { data: org } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    return { ...data, hasOrg: !!org, avatarUrl: await signPath(data.avatar_url) };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fullName: string;
      bio: string;
      preferredLocale: string;
      avatarPath?: string | null;
      defaultMode?: "student" | "teacher";
      showPhotoToClassmates?: boolean;
    }) => {
      if (!LOCALES.some((l) => l.code === input.preferredLocale)) {
        throw new Error("Unsupported locale");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      full_name: data.fullName,
      bio: data.bio,
      preferred_locale: data.preferredLocale,
    };
    if (data.avatarPath !== undefined) patch["avatar_url"] = data.avatarPath;
    if (data.showPhotoToClassmates !== undefined)
      patch["show_photo_to_classmates"] = data.showPhotoToClassmates;
    if (data.defaultMode)
      patch["default_mode"] = data.defaultMode === "teacher" ? "teacher" : "student";
    const { error } = await context.supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type CourseCard = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  organizations: { name: string } | null;
};

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
    const enrolled = new Set(rows.map((r) => r.course_id));

    const { data: memberships } = await context.supabase
      .from("classroom_memberships")
      .select("classroom_id")
      .eq("user_id", context.userId)
      .eq("status", "active");
    const classroomIds = (memberships ?? []).map((m) => m.classroom_id);
    const { data: classrooms } = classroomIds.length
      ? await context.supabase
          .from("classrooms")
          .select("id, course_id")
          .in("id", classroomIds)
          .eq("status", "active")
      : { data: [] };
    const classroomByCourse = new Map<string, string>();
    for (const c of classrooms ?? []) {
      if (!enrolled.has(c.course_id) && !classroomByCourse.has(c.course_id)) {
        classroomByCourse.set(c.course_id, c.id);
      }
    }
    const classCourseIds = [...classroomByCourse.keys()];
    const { data: classCourses } = classCourseIds.length
      ? await context.supabase
          .from("courses")
          .select("id, slug, title, thumbnail_url, organizations(name)")
          .in("id", classCourseIds)
      : { data: [] };

    const cards = [
      ...rows.map((r) => r.courses as unknown as CourseCard),
      ...(classCourses ?? []).map((c) => c as unknown as CourseCard),
    ];
    const courseIds = cards.map((c) => c.id);
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

    const signed = await signMany(cards.map((c) => c.thumbnail_url));

    return cards.map((c) => {
      const total = (lessons ?? []).filter((l) => l.course_id === c.id).length;
      const done = (progress ?? []).filter((p) => p.course_id === c.id).length;
      return {
        courseId: c.id,
        slug: c.slug,
        title: c.title,
        teacherName: c.organizations?.name ?? "",
        classroomId: classroomByCourse.get(c.id) ?? null,
        thumbnailUrl: c.thumbnail_url ? (signed.get(c.thumbnail_url) ?? null) : null,
        total,
        done,
        percent: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    });
  });

export const getMySessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    // Sessions are RLS-scoped to active class members of active classes.
    let query = context.supabase
      .from("class_sessions")
      .select(
        "id, title, starts_at, duration_minutes, time_zone, meeting_url, classroom_id, classrooms(name)",
      )
      .eq("status", "scheduled")
      .order("starts_at", { ascending: true });
    if (data.from) query = query.gte("starts_at", data.from);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      durationMinutes: s.duration_minutes,
      timeZone: s.time_zone,
      meetingUrl: s.meeting_url,
      classroomId: s.classroom_id,
      classroomName: s.classrooms?.name ?? "",
    }));
  });

type ClassMemberRow = { avatarPath: string | null };

export const getMyClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_my_classes");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const membersOf = (members: unknown) => members as ClassMemberRow[];
    const { signMany } = await import("./media.server");
    const signed = await signMany(
      rows.flatMap((r) => membersOf(r.members).map((m) => m.avatarPath)),
    );
    return rows.map((r) => ({
      classroomId: r.classroom_id,
      classroomName: r.classroom_name,
      courseId: r.course_id,
      courseSlug: r.course_slug,
      courseTitle: r.course_title,
      teacherName: r.teacher_name,
      members: membersOf(r.members).map((m) => ({
        avatarUrl: m.avatarPath ? (signed.get(m.avatarPath) ?? null) : null,
      })),
    }));
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

export const joinClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: classroomId, error } = await context.supabase.rpc("join_classroom", {
      _code: data.code,
    });
    if (error) {
      throw new Error(
        error.message.includes("Invalid join code") ? "INVALID_JOIN_CODE" : error.message,
      );
    }
    return { classroomId };
  });

export const leaveClassCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("leave_course_classes", {
      _course: data.courseId,
    });
    if (error) throw new Error(error.message);
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
      !access &&
      course.status === "published" &&
      course.price_model === "subscription" &&
      course.preview_seconds > 0;
    if (!access && !previewMode)
      return { title: course.title, access: false, preview: false, sections: [], progress: [] };

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
    const visibleLessons = previewMode
      ? (lessons ?? []).filter((l) => l.type === "video" || l.is_preview)
      : (lessons ?? []);
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
      .select(
        "id, course_id, title, type, body, media_path, duration_minutes, is_preview, danmaku_enabled, courses(status, price_model, preview_seconds)",
      )
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const { data: access } = await context.supabase.rpc("has_course_access", {
      _course: lesson.course_id,
      _user: context.userId,
    });
    const c = lesson.courses as unknown as {
      status: string;
      price_model: string;
      preview_seconds: number;
    } | null;
    let previewLimit: number | null = null;
    if (!access) {
      const published = c?.status === "published";
      if (published && lesson.is_preview) {
        previewLimit = null;
      } else if (
        published &&
        c?.price_model === "subscription" &&
        lesson.type === "video" &&
        c.preview_seconds > 0
      ) {
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
      const { error } = await context.supabase.from("lesson_progress").upsert(
        {
          user_id: context.userId,
          lesson_id: data.lessonId,
          course_id: data.courseId,
          completed: true,
        },
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
