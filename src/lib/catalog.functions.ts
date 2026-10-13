import { createServerFn } from "@tanstack/react-start";

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  level: string;
  language: string;
  priceModel: string;
  priceKzt: number;
  estimatedMinutes: number;
  categorySlug: string | null;
  teacherName: string;
  teacherSlug: string;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  thumbnail_url: string | null;
  level: string;
  language: string;
  price_model: string;
  price_kzt: number;
  estimated_minutes: number;
  categories: { slug: string } | null;
  organizations: { name: string; slug: string } | null;
};

const COURSE_SELECT =
  "id, slug, title, short_description, thumbnail_url, level, language, price_model, price_kzt, estimated_minutes, published_at, categories(slug), organizations(name, slug)";

async function toCards(rows: CourseRow[]): Promise<CourseCard[]> {
  const { signMany } = await import("./media.server");
  const signed = await signMany(rows.map((r) => r.thumbnail_url));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    shortDescription: r.short_description,
    thumbnailUrl: r.thumbnail_url ? (signed.get(r.thumbnail_url) ?? null) : null,
    level: r.level,
    language: r.language,
    priceModel: r.price_model,
    priceKzt: r.price_kzt,
    estimatedMinutes: r.estimated_minutes,
    categorySlug: r.categories?.slug ?? null,
    teacherName: r.organizations?.name ?? "",
    teacherSlug: r.organizations?.slug ?? "",
  }));
}

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./supabase-public.server");
  const { data } = await createPublicClient()
    .from("categories")
    .select("id, slug, name_en, name_ru, name_kk")
    .order("position");
  return data ?? [];
});

export const listCourses = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      search?: string;
      category?: string;
      language?: string;
      level?: string;
      limit?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./supabase-public.server");
    const supabase = createPublicClient();
    let q = supabase
      .from("courses")
      .select(COURSE_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.search) q = q.ilike("title", `%${data.search}%`);
    if (data.language) q = q.eq("language", data.language);
    if (data.level) q = q.eq("level", data.level as "beginner");
    if (data.limit) q = q.limit(data.limit);

    const { data: rows } = await q;
    let list = (rows ?? []) as unknown as CourseRow[];
    if (data.category) list = list.filter((r) => r.categories?.slug === data.category);
    return toCards(list);
  });

export const getCourseBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./supabase-public.server");
    const { signPath } = await import("./media.server");
    const supabase = createPublicClient();

    const { data: course } = await supabase
      .from("courses")
      .select(
        "id, slug, title, short_description, description, thumbnail_url, level, language, price_model, price_kzt, preview_seconds, estimated_minutes, category_id, categories(slug, name_en, name_ru, name_kk), organizations(id, name, slug, headline, logo_url, owner_id)",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (!course) return null;

    const { data: sections } = await supabase
      .from("sections")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position");

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, section_id, title, type, position, duration_minutes, is_preview")
      .eq("course_id", course.id)
      .order("position");

    const org = course.organizations as unknown as {
      id: string;
      name: string;
      slug: string;
      headline: string | null;
      logo_url: string | null;
    } | null;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortDescription: course.short_description,
      description: course.description,
      thumbnailUrl: await signPath(course.thumbnail_url),
      level: course.level,
      language: course.language,
      priceModel: course.price_model,
      priceKzt: course.price_kzt,
      previewSeconds: course.preview_seconds,
      estimatedMinutes: course.estimated_minutes,
      category: course.categories as unknown as {
        slug: string;
        name_en: string;
        name_ru: string;
        name_kk: string;
      } | null,
      teacher: org
        ? {
            name: org.name,
            slug: org.slug,
            headline: org.headline,
            logoUrl: await signPath(org.logo_url),
          }
        : null,
      sections: (sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        lessons: (lessons ?? []).filter((l) => l.section_id === s.id),
      })),
      lessonCount: (lessons ?? []).length,
    };
  });

export const getTeacherBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./supabase-public.server");
    const { signPath } = await import("./media.server");
    const supabase = createPublicClient();

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, headline, about, logo_url, cover_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return null;

    const { data: rows } = await supabase
      .from("courses")
      .select(COURSE_SELECT)
      .eq("organization_id", org.id)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    const cards = await toCards((rows ?? []) as unknown as CourseRow[]);
    const { data: stats } = await supabase.rpc("course_stats");
    const ids = new Set(cards.map((c) => c.id));
    const students = (stats ?? [])
      .filter((s) => ids.has(s.course_id))
      .reduce((n, s) => n + Number(s.students), 0);
    return {
      name: org.name,
      slug: org.slug,
      headline: org.headline,
      about: org.about,
      logoUrl: await signPath(org.logo_url),
      coverUrl: await signPath(org.cover_url),
      students,
      courses: cards,
    };
  });

export type FeedCard = CourseCard & { students: number; teacherLogoUrl: string | null };

export const getHomeFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./supabase-public.server");
  const { signMany } = await import("./media.server");
  const supabase = createPublicClient();
  const [{ data: rows }, { data: stats }, { data: cats }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, slug, title, short_description, thumbnail_url, level, language, price_model, price_kzt, estimated_minutes, published_at, categories(slug), organizations(name, slug, logo_url)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(200),
    supabase.rpc("course_stats"),
    supabase.from("categories").select("slug, name_en, name_ru, name_kk").order("position"),
  ]);
  const list = (rows ?? []) as unknown as (CourseRow & {
    organizations: { name: string; slug: string; logo_url: string | null } | null;
  })[];
  const statMap = new Map((stats ?? []).map((s) => [s.course_id, s]));
  const base = await toCards(list);
  const logos = await signMany(list.map((r) => r.organizations?.logo_url));
  const cards: FeedCard[] = base.map((c, i) => {
    const logo = list[i]!.organizations?.logo_url;
    return {
      ...c,
      students: Number(statMap.get(c.id)?.students ?? 0),
      teacherLogoUrl: logo ? (logos.get(logo) ?? null) : null,
    };
  });
  const recent = (id: string) => Number(statMap.get(id)?.recent ?? 0);
  const trending = [...cards]
    .sort((a, b) => recent(b.id) - recent(a.id) || b.students - a.students)
    .slice(0, 12);

  const teacherMap = new Map<
    string,
    { name: string; slug: string; logoUrl: string | null; students: number; courses: number }
  >();
  for (const c of cards) {
    const t = teacherMap.get(c.teacherSlug) ?? {
      name: c.teacherName,
      slug: c.teacherSlug,
      logoUrl: c.teacherLogoUrl,
      students: 0,
      courses: 0,
    };
    t.students += c.students;
    t.courses += 1;
    teacherMap.set(c.teacherSlug, t);
  }
  const teachers = [...teacherMap.values()]
    .filter((t) => t.slug)
    .sort((a, b) => b.students - a.students)
    .slice(0, 12);

  return {
    trending,
    newest: cards.slice(0, 12),
    free: cards.filter((c) => c.priceModel === "free").slice(0, 12),
    teachers,
    categories: (cats ?? [])
      .map((cat) => ({
        ...cat,
        courses: cards.filter((c) => c.categorySlug === cat.slug).slice(0, 12),
      }))
      .filter((cat) => cat.courses.length > 0),
  };
});
