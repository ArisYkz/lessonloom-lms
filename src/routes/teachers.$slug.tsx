import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getTeacherBySlug } from "@/lib/catalog.functions";
import { CourseCard } from "@/components/course-card";
import { useI18n } from "@/i18n/provider";
import { Avatar } from "@/components/feed-card";

const teacherQuery = (slug: string) =>
  queryOptions({
    queryKey: ["teacher", slug],
    queryFn: () => getTeacherBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/teachers/$slug")({
  loader: async ({ context, params }) => {
    const teacher = await context.queryClient.ensureQueryData(teacherQuery(params.slug));
    if (!teacher) throw notFound();
    return teacher;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Teacher not found — Bilim" }, { name: "robots", content: "noindex" }] };
    }
    const desc = loaderData.headline ?? `Courses by ${loaderData.name} on Bilim.`;
    return {
      meta: [
        { title: `${loaderData.name} — Bilim` },
        { name: "description", content: desc },
        { property: "og:title", content: `${loaderData.name} — Bilim` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TeacherPage,
  errorComponent: ({ error }) => <div className="p-10 text-center text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-20 text-center text-muted-foreground">Not found</div>,
});

function TeacherPage() {
  const { slug } = Route.useParams();
  const { t } = useI18n();
  const { data } = useSuspenseQuery(teacherQuery(slug));
  if (!data) return null;

  return (
    <div>
      <div className="h-44 w-full bg-secondary sm:h-64">
        {data.coverUrl ? <img src={data.coverUrl} alt="" className="size-full object-cover" /> : null}
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <div className="-mt-12 flex flex-wrap items-end gap-5">
          <div className="rounded-full border-4 border-background bg-background">
            <Avatar name={data.name} url={data.logoUrl} size="size-28" />
          </div>
          <div className="pb-2">
            <h1 className="font-display text-4xl sm:text-5xl">{data.name}</h1>
            {data.headline ? <p className="mt-1 text-muted-foreground">{data.headline}</p> : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {data.courses.length} {t("feed.courses")} · {data.students.toLocaleString("ru-RU")} {t("feed.students")}
            </p>
          </div>
        </div>
        {data.about ? <p className="mt-6 max-w-3xl whitespace-pre-wrap text-muted-foreground">{data.about}</p> : null}

        <h2 className="mt-12 text-xl font-semibold">{t("teach.courses")}</h2>
        {data.courses.length === 0 ? (
          <p className="mt-4 pb-16 text-muted-foreground">{t("home.empty")}</p>
        ) : (
          <div className="mt-6 grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
