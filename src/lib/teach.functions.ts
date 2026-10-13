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
      .select("code, name, price_kzt, max_courses, max_students")
      .eq("code", planCode)
      .maybeSingle();
    return {
      ...data,
      plan: plan ?? {
        code: "starter",
        name: "Start",
        price_kzt: 4990,
        max_courses: 3,
        max_students: 100,
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
      .select("user_id, created_at, profiles:user_id(full_name)")
      .eq("course_id", data.courseId)
      .order("created_at", { ascending: false });

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
          name: (e.profiles as unknown as { full_name: string } | null)?.full_name || "—",
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
