import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Sparkles, Users } from "lucide-react";
import { listCategories, listCourses } from "@/lib/catalog.functions";
import { CourseCard } from "@/components/course-card";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => ({
    courses: await listCourses({ data: { limit: 6 } }),
    categories: await listCategories(),
  }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bilim — learn from Kazakhstan's teachers" },
      {
        name: "description",
        content:
          "Discover online courses created by teachers across Kazakhstan. Enroll free, learn in Kazakh, Russian or English, and track your progress lesson by lesson.",
      },
      { property: "og:title", content: "Bilim — learn from Kazakhstan's teachers" },
      {
        property: "og:description",
        content: "Online courses by Kazakhstan's teachers, in Kazakh, Russian and English.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
  errorComponent: ({ error }) => <div className="p-10 text-center text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center">404</div>,
});

function Home() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(homeQuery);

  return (
    <div>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3.5" /> Қазақстан · Россия · English
            </span>
            <h1 className="font-display mt-6 text-5xl leading-tight text-foreground sm:text-7xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("home.heroSub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/catalog">
                  {t("home.browse")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/teach">{t("home.becomeTeacher")}</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <Stat icon={<BookOpen className="size-5" />} value={data.courses.length} label={t("home.featured")} />
            <Stat icon={<Users className="size-5" />} value={data.categories.length} label={t("home.categories")} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="title-section">{t("home.featured")}</h2>
        {data.courses.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t("home.empty")}</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="title-section">{t("home.categories")}</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {data.categories.map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.slug }}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              {locale === "kk" ? c.name_kk : locale === "en" ? c.name_en : c.name_ru}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-border bg-accent px-8 py-12 text-accent-foreground">
          <h2 className="title-section">{t("home.teacherTitle")}</h2>
          <p className="mt-2 max-w-2xl text-accent-foreground/80">{t("home.teacherSub")}</p>
          <Button asChild className="mt-6">
            <Link to="/teach">{t("home.teacherCta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </span>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
