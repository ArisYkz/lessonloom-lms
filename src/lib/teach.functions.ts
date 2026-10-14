import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(input: string) {
  const map: Record<string, string> = {
    а: "a",
    ә: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    қ: "q",
    л: "l",
    м: "m",
    н: "n",
    ң: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ұ: "u",
    ү: "u",
    ф: "f",
    х: "h",
    һ: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    і: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const base = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "course") + "-" + Math.random().toString(36).slice(2, 7);
}

export const getMyOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("organizations")
      .select("id, name, slug, headline, about, logo_url, cover_url")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    const { data: sub } = await context.supabase
      .from("org_subscriptions")
      .select("plan_code, status")
      .eq("organization_id", data.id)
      .maybeSingle();
    const planCode = sub && sub.status === "ACTIVE" ? sub.plan_code : "starter";
    const { data: plan } = await context.supabase
      .from("teacher_plans")
      .select("code, name, price_kzt, max_courses, max_students, max_classrooms")
      .eq("code", planCode)
      .maybeSingle();
    return {
      ...data,
      plan: plan ?? {
        code: "starter",
        name: "Start",
        price_kzt: 4990,
        max_courses: 3,
        max_students: 3,
        max_classrooms: 1,
      },
    };
  });

export const createMyOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; headline: string; about: string }) => input)
  .handler(async ({ data, context }) => {
    if (!data.name.trim()) throw new Error("Name is required");
    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({
        owner_id: context.userId,
        name: data.name.trim(),
        slug: slugify(data.name),
        headline: data.headline,
        about: data.about,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "teacher" });
    return org;
  });

export const updateMyOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      headline: string;
      about: string;
      logoPath?: string | null;
      coverPath?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      name: data.name,
      headline: data.headline,
      about: data.about,
    };
    if (data.logoPath !== undefined) patch["logo_url"] = data.logoPath;
    if (data.coverPath !== undefined) patch["cover_url"] = data.coverPath;
    const { error } = await context.supabase
      .from("organizations")
      .update(patch as never)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyLearnerCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: org } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!org) return null;
    const { data, error } = await context.supabase.rpc("owned_org_learner_count", {
      _org: org.id,
    });
    if (error) throw new Error(error.message);
    return { learners: Number(data ?? 0) };
  });

export const getMyCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: org } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!org) return { org: null, courses: [], totalStudents: 0 };

    const { data: courses } = await context.supabase
      .from("courses")
      .select("id, slug, title, status, price_model, price_kzt, language, level, updated_at")
      .eq("organization_id", org.id)
      .order("updated_at", { ascending: false });

    const ids = (courses ?? []).map((c) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: enr } = await context.supabase
        .from("enrollments")
        .select("course_id")
        .in("course_id", ids);
      counts = (enr ?? []).reduce<Record<string, number>>((acc, e) => {
        acc[e.course_id] = (acc[e.course_id] ?? 0) + 1;
        return acc;
      }, {});
    }

    return {
      org,
      courses: (courses ?? []).map((c) => ({ ...c, students: counts[c.id] ?? 0 })),
      totalStudents: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: org } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!org) throw new Error("Create a teacher account first");
    const orgId = org.id;
    const { data: course, error } = await context.supabase
      .from("courses")
      .insert({
        organization_id: orgId,
        title: data.title.trim() || "Untitled course",
        slug: slugify(data.title),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return course;
  });

export const getCourseForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { signPath, signMany } = await import("./media.server");
    const { data: course } = await context.supabase
      .from("courses")
      .select("*")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) return null;

    const { data: sections } = await context.supabase
      .from("sections")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select(
        "id, section_id, title, type, position, duration_minutes, is_preview, danmaku_enabled, body, media_path",
      )
      .eq("course_id", course.id)
      .order("position");

    const signed = await signMany((lessons ?? []).map((l) => l.media_path));

    return {
      course: { ...course, thumbnailUrl: await signPath(course.thumbnail_url) },
      sections: (sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        position: s.position,
        lessons: (lessons ?? [])
          .filter((l) => l.section_id === s.id)
          .map((l) => ({
            ...l,
            mediaUrl: l.media_path ? (signed.get(l.media_path) ?? null) : null,
          })),
      })),
    };
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { courseId: string; patch: Record<string, string | number | null> }) => input,
  )
  .handler(async ({ data, context }) => {
    const allowed = [
      "title",
      "short_description",
      "description",
      "thumbnail_url",
      "category_id",
      "level",
      "language",
      "price_model",
      "price_kzt",
      "estimated_minutes",
      "preview_seconds",
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) if (key in data.patch) patch[key] = data.patch[key];

    // Keep the public URL readable: refresh the slug from the title until the
    // course has been published (published URLs must stay stable).
    if (typeof patch["title"] === "string" && patch["title"].trim()) {
      const { data: current } = await context.supabase
        .from("courses")
        .select("status, published_at")
        .eq("id", data.courseId)
        .maybeSingle();
      if (current && current.status !== "published" && !current.published_at) {
        patch["slug"] = slugify(patch["title"] as string);
      }
    }

    const { error } = await context.supabase
      .from("courses")
      .update(patch as never)
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCourseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; status: "draft" | "pending_review" }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("courses")
      .update({ status: data.status, rejection_reason: null, updated_at: new Date().toISOString() })
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string; courseId: string; title: string; position?: number }) => input,
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const patch: Record<string, unknown> = { title: data.title };
      if (data.position !== undefined) patch["position"] = data.position;
      const { error } = await context.supabase
        .from("sections")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await context.supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("course_id", data.courseId);
    const { data: row, error } = await context.supabase
      .from("sections")
      .insert({ course_id: data.courseId, title: data.title, position: count ?? 0 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      courseId: string;
      sectionId: string;
      title: string;
      type: "video" | "text" | "file";
      body?: string | null;
      mediaPath?: string | null;
      durationMinutes?: number;
      position?: number;
      isPreview?: boolean;
      danmakuEnabled?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      title: data.title,
      type: data.type,
    };
    if (data.body !== undefined) patch["body"] = data.body;
    if (data.mediaPath !== undefined) patch["media_path"] = data.mediaPath;
    if (data.durationMinutes !== undefined) patch["duration_minutes"] = data.durationMinutes;
    if (data.position !== undefined) patch["position"] = data.position;
    if (data.isPreview !== undefined) patch["is_preview"] = data.isPreview;
    if (data.danmakuEnabled !== undefined) patch["danmaku_enabled"] = data.danmakuEnabled;

    if (data.id) {
      const { error } = await context.supabase
        .from("lessons")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await context.supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("section_id", data.sectionId);
    const { data: row, error } = await context.supabase
      .from("lessons")
      .insert({
        ...patch,
        course_id: data.courseId,
        section_id: data.sectionId,
        position: data.position ?? count ?? 0,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { table: "sections" | "lessons"; items: { id: string; position: number }[] }) => input,
  )
  .handler(async ({ data, context }) => {
    for (const item of data.items) {
      await context.supabase.from(data.table).update({ position: item.position }).eq("id", item.id);
    }
    return { ok: true };
  });

export const getCourseStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("courses")
      .select("id, title")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) return null;

    const { data: enrollments } = await context.supabase
      .from("enrollments")
      .select("user_id, created_at")
      .eq("course_id", data.courseId)
      .order("created_at", { ascending: false });

    // Enrollments are RLS-scoped to the course owner; profile names are not readable by teachers.
    const enrolledIds = (enrollments ?? []).map((e) => e.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = enrolledIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", enrolledIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("id")
      .eq("course_id", data.courseId);
    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("user_id")
      .eq("course_id", data.courseId);
    const { data: subs } = await context.supabase
      .from("homework_submissions")
      .select("user_id, status")
      .eq("course_id", data.courseId);
    const { data: attempts } = await context.supabase
      .from("quiz_attempts")
      .select("user_id, quiz_id, score, total, passed")
      .eq("course_id", data.courseId);

    const total = (lessons ?? []).length;
    return {
      title: course.title,
      students: (enrollments ?? []).map((e) => {
        const done = (progress ?? []).filter((p) => p.user_id === e.user_id).length;
        const mySubs = (subs ?? []).filter((s) => s.user_id === e.user_id);
        const myAttempts = (attempts ?? []).filter((a) => a.user_id === e.user_id);
        const best = new Map<string, number>();
        for (const a of myAttempts) {
          const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
          best.set(a.quiz_id, Math.max(best.get(a.quiz_id) ?? 0, pct));
        }
        const bests = [...best.values()];
        return {
          name: names.get(e.user_id) || "—",
          joined: e.created_at,
          percent: total === 0 ? 0 : Math.round((done / total) * 100),
          homeworkPending: mySubs.filter((s) => s.status === "submitted").length,
          homeworkReviewed: mySubs.filter((s) => s.status === "reviewed").length,
          quizAverage: bests.length
            ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length)
            : null,
        };
      }),
    };
  });

export const listClassrooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: classrooms, error } = await context.supabase
      .from("classrooms")
      .select(
        "id, name, status, listed, created_at, start_date, end_date, capacity, price_kzt, enrollment_open",
      )
      .eq("course_id", data.courseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (classrooms ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      listed: c.listed,
      startDate: c.start_date,
      endDate: c.end_date,
      capacity: c.capacity,
      priceKzt: c.price_kzt,
      enrollmentOpen: c.enrollment_open,
    }));
  });

export const createClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; name: string }) => input)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (name.length < 1 || name.length > 120)
      throw new Error("Class name must be 1-120 characters");
    const { data: classroomId, error } = await context.supabase.rpc("create_classroom", {
      _course: data.courseId,
      _name: name,
    });
    if (error) throw new Error(error.message);
    return { id: classroomId };
  });

export const getClassroomJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: code, error } = await context.supabase.rpc("get_classroom_join_code", {
      _classroom: data.classroomId,
    });
    if (error) throw new Error(error.message);
    return { code };
  });

export const rotateClassroomJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: code, error } = await context.supabase.rpc("rotate_classroom_join_code", {
      _classroom: data.classroomId,
    });
    if (error) throw new Error(error.message);
    return { code };
  });

export const setClassroomStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string; status: "active" | "archived" }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_classroom_status", {
      _classroom: data.classroomId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string; name: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rename_classroom", {
      _classroom: data.classroomId,
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClassroomMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string }) => input)
  .handler(async ({ data, context }) => {
    // Membership rows are RLS-scoped to the class owner; profile names are not readable by teachers.
    const { data: memberships, error } = await context.supabase
      .from("classroom_memberships")
      .select("user_id, joined_at")
      .eq("classroom_id", data.classroomId)
      .eq("status", "active")
      .order("joined_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = memberships ?? [];
    if (rows.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        rows.map((m) => m.user_id),
      );
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return rows.map((m) => ({
      userId: m.user_id,
      name: names.get(m.user_id) || "—",
      joined: m.joined_at,
    }));
  });

export const removeClassroomMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string; userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_classroom_member", {
      _classroom: data.classroomId,
      _user: data.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClassroomListed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string; listed: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_classroom_listed", {
      _classroom: data.classroomId,
      _listed: data.listed,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClassroomOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      classroomId: string;
      startDate: string | null;
      endDate: string | null;
      capacity: number | null;
      priceKzt: number | null;
      enrollmentOpen: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_classroom_offering", {
      _classroom: data.classroomId,
      _start_date: data.startDate,
      _end_date: data.endDate,
      _capacity: data.capacity,
      _price_kzt: data.priceKzt,
      _enrollment_open: data.enrollmentOpen,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyClassrooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: classrooms, error } = await context.supabase
      .from("classrooms")
      .select(
        "id, name, status, listed, course_id, start_date, end_date, capacity, price_kzt, enrollment_open",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = classrooms ?? [];
    const courseIds = [...new Set(rows.map((c) => c.course_id))];
    const { data: courses } = courseIds.length
      ? await context.supabase.from("courses").select("id, title").in("id", courseIds)
      : { data: [] };
    const titles = new Map((courses ?? []).map((c) => [c.id, c.title]));
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      listed: c.listed,
      startDate: c.start_date,
      endDate: c.end_date,
      capacity: c.capacity,
      priceKzt: c.price_kzt,
      enrollmentOpen: c.enrollment_open,
      courseId: c.course_id,
      courseTitle: titles.get(c.course_id) ?? "",
    }));
  });

export const listClassSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: sessions, error } = await context.supabase
      .from("class_sessions")
      .select(
        "id, title, starts_at, duration_minutes, time_zone, format, meeting_url, location, status",
      )
      .eq("classroom_id", data.classroomId)
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (sessions ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      durationMinutes: s.duration_minutes,
      timeZone: s.time_zone,
      format: s.format,
      meetingUrl: s.meeting_url,
      location: s.location,
      status: s.status,
    }));
  });

export const listTeacherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Session rows are RLS-scoped to the teacher's own classes.
    const { data, error } = await context.supabase
      .from("class_sessions")
      .select(
        "id, classroom_id, title, starts_at, duration_minutes, time_zone, format, meeting_url, location, status, classrooms(name)",
      )
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      id: s.id,
      classroomId: s.classroom_id,
      classroomName: s.classrooms?.name ?? "",
      title: s.title,
      startsAt: s.starts_at,
      durationMinutes: s.duration_minutes,
      timeZone: s.time_zone,
      format: s.format,
      meetingUrl: s.meeting_url,
      location: s.location,
      status: s.status,
    }));
  });

export const createClassSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      classroomId: string;
      title: string;
      startsAt: string;
      durationMinutes: number;
      timeZone: string;
      format: "online" | "in_person";
      meetingUrl: string;
      location: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_class_session", {
      _classroom: data.classroomId,
      _title: data.title,
      _starts_at: data.startsAt,
      _duration_minutes: data.durationMinutes,
      _time_zone: data.timeZone,
      _format: data.format,
      _meeting_url: data.meetingUrl,
      _location: data.location,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const cancelClassSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_class_session", {
      _session: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreClassSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("restore_class_session", {
      _session: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClassSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sessionId: string;
      title: string;
      startsAt: string;
      durationMinutes: number;
      timeZone: string;
      format: "online" | "in_person";
      meetingUrl: string;
      location: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("update_class_session", {
      _session: data.sessionId,
      _title: data.title,
      _starts_at: data.startsAt,
      _duration_minutes: data.durationMinutes,
      _time_zone: data.timeZone,
      _format: data.format,
      _meeting_url: data.meetingUrl,
      _location: data.location,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateSessionCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc("rotate_session_checkin", {
      _session: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const listSessionCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_checkins")
      .select("user_id, checked_in_at")
      .eq("session_id", data.sessionId)
      .order("checked_in_at", { ascending: true });
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    if (list.length === 0) return [];
    // Profile names are not readable by teachers under RLS, same as listClassroomMembers.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        list.map((r) => r.user_id),
      );
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    return list.map((r) => ({
      userId: r.user_id,
      name: names.get(r.user_id) ?? "",
      checkedInAt: r.checked_in_at,
    }));
  });

export const listClassHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classroomId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: classroom, error: classError } = await context.supabase
      .from("classrooms")
      .select("course_id")
      .eq("id", data.classroomId)
      .maybeSingle();
    if (classError) throw new Error(classError.message);
    if (!classroom) return [];

    const [{ data: homework, error }, { data: due, error: dueError }] = await Promise.all([
      context.supabase
        .from("homework")
        .select("id, instructions, lessons(title)")
        .eq("course_id", classroom.course_id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("classroom_homework_due")
        .select("homework_id, due_at")
        .eq("classroom_id", data.classroomId),
    ]);
    if (error) throw new Error(error.message);
    if (dueError) throw new Error(dueError.message);

    const dueByHomework = new Map((due ?? []).map((d) => [d.homework_id, d.due_at]));
    return (homework ?? []).map((h) => ({
      homeworkId: h.id,
      lessonTitle: (h.lessons as unknown as { title: string } | null)?.title ?? "",
      instructions: h.instructions,
      dueAt: dueByHomework.get(h.id) ?? null,
    }));
  });

export const setClassroomHomeworkDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { classroomId: string; homeworkId: string; dueAt: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_classroom_homework_due", {
      _classroom: data.classroomId,
      _homework: data.homeworkId,
      _due_at: data.dueAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
