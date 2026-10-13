import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Clock, Lock, PlayCircle, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { getCourseBySlug } from "@/lib/catalog.functions";
import { enrollFree, getEnrollmentState } from "@/lib/learn.functions";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReportButton } from "@/components/report-button";

const courseQuery = (slug: string) =>
  queryOptions({
    queryKey: ["course", slug],
    queryFn: () => getCourseBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/courses/$slug")({
  loader: async ({ context, params }) => {
    const course = await context.queryClient.ensureQueryData(courseQuery(params.slug));
    if (!course) throw notFound();
    return course;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Course not found — Bilim" }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      meta: [
        { title: `${loaderData.title} — Bilim` },
        { name: "description", content: loaderData.shortDescription ?? loaderData.title },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.shortDescription ?? loaderData.title },
      ],
    };
  },
  component: CoursePage,
  errorComponent: ({ error }) => <div className="p-10 text-center text-sm">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-20 text-center text-muted-foreground">Course not found</div>
  ),
});

function CoursePage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: course } = useSuspenseQuery(courseQuery(slug));
  const enroll = useServerFn(enrollFree);
  const stateFn = useServerFn(getEnrollmentState);

  const { data: state } = useQuery({
    queryKey: ["enrollment", course?.id, user?.id],
    queryFn: () => stateFn({ data: { courseId: course!.id } }),
    enabled: !!user && !!course,
  });

  if (!course) return null;

  async function handleEnroll() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/courses/${slug}` } });
      return;
    }
    try {
      await enroll({ data: { courseId: course!.id } });
      await queryClient.invalidateQueries({ queryKey: ["enrollment"] });
      navigate({ to: "/learn/$slug", params: { slug } });
    } catch (e) {
      const limitReached = e instanceof Error && e.message === "PLAN_STUDENT_LIMIT";
      toast.error(t(limitReached ? "classroom.PLAN_STUDENT_LIMIT" : "common.error"));
    }
  }

  const isFree = course.priceModel === "free";
  const categoryName = course.category
    ? locale === "kk"
      ? course.category.name_kk
      : locale === "en"
        ? course.category.name_en
        : course.category.name_ru
    : null;

  return (
    <div>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {categoryName ? <Badge variant="secondary">{categoryName}</Badge> : null}
              <Badge variant="secondary" className="uppercase">
                {course.language}
              </Badge>
              <span>{t(`level.${course.level}` as keyof Dict)}</span>
            </div>
            <h1 className="title-page mt-5">{course.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{course.shortDescription}</p>
            <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" /> {course.lessonCount} {t("course.lessons")}
              </span>
              {course.estimatedMinutes > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" /> {course.estimatedMinutes} {t("course.minutes")}
                </span>
              ) : null}
              {course.teacher ? (
                <Link
                  to="/teachers/$slug"
                  params={{ slug: course.teacher.slug }}
                  className="hover:text-foreground"
                >
                  {t("course.teacher")}: {course.teacher.name}
                </Link>
              ) : null}
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-background p-5">
            <div className="aspect-video overflow-hidden rounded-lg bg-accent">
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <BookOpen className="size-8 text-accent-foreground" />
                </div>
              )}
            </div>
            <p className="mt-4 text-2xl font-semibold">
              {isFree
                ? t("price.free")
                : `${course.priceKzt.toLocaleString("ru-RU")} ₸ ${t("price.perMonth")}`}
            </p>
            {state?.access ? (
              <Button asChild className="mt-4 w-full" size="lg">
                <Link to="/learn/$slug" params={{ slug }}>
                  {t("course.continue")}
                </Link>
              </Button>
            ) : isFree ? (
              <Button className="mt-4 w-full" size="lg" onClick={handleEnroll}>
                {user ? t("course.enrollFree") : t("course.signInToEnroll")}
              </Button>
            ) : (
              <>
                <Button className="mt-4 w-full" size="lg" disabled>
                  {t("course.subscribe")}
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t("course.paymentsSoon")}
                </p>
                {course.previewSeconds > 0 ? (
                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link to="/learn/$slug" params={{ slug }}>
                      {t("preview.watch")} · {Math.round(course.previewSeconds / 60)}{" "}
                      {t("preview.minutes")}
                    </Link>
                  </Button>
                ) : null}
              </>
            )}
            <div className="mt-3 flex justify-center">
              <ReportButton targetType="course" targetId={course.id} />
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="title-section">{t("course.about")}</h2>
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{course.description}</p>

          <h2 className="title-section mt-10">{t("course.curriculum")}</h2>
          <Accordion type="multiple" className="mt-3">
            {course.sections.map((s) => (
              <AccordionItem key={s.id} value={s.id}>
                <AccordionTrigger className="text-left">
                  {s.title}
                  <span className="ml-auto mr-2 text-xs font-normal text-muted-foreground">
                    {s.lessons.length} {t("course.lessons")}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {s.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        {l.type === "video" ? (
                          <PlayCircle className="size-4" />
                        ) : l.type === "file" ? (
                          <Paperclip className="size-4" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                        <span className="text-foreground">{l.title}</span>
                        {l.duration_minutes ? (
                          <span className="text-xs">
                            · {l.duration_minutes} {t("course.minutes")}
                          </span>
                        ) : null}
                        {l.is_preview ? (
                          <Badge variant="outline" className="ml-2">
                            {t("course.preview")}
                          </Badge>
                        ) : (
                          <Lock className="ml-auto size-3.5" />
                        )}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {course.teacher ? (
          <aside className="h-fit rounded-xl border border-border bg-card p-5">
            <h3 className="title-card">{t("course.teacher")}</h3>
            <p className="mt-2 text-lg">{course.teacher.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{course.teacher.headline}</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/teachers/$slug" params={{ slug: course.teacher.slug }}>
                {course.teacher.name}
              </Link>
            </Button>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
