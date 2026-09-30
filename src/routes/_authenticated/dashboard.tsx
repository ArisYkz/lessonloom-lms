import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen } from "lucide-react";
import { getMyLearning } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My learning — Bilim" },
      { name: "description", content: "Your enrolled courses and progress on Bilim." },
      { property: "og:title", content: "My learning — Bilim" },
      { property: "og:description", content: "Your enrolled courses and progress." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const fetchLearning = useServerFn(getMyLearning);
  const { data, isLoading } = useQuery({ queryKey: ["my-learning"], queryFn: () => fetchLearning() });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.25rem]">{t("learn.myCourses")}</h1>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">{t("common.loading")}</p>
      ) : !data || data.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">{t("learn.noCourses")}</p>
          <Button asChild className="mt-4">
            <Link to="/catalog">{t("learn.findCourses")}</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link
              key={c.slug}
              to="/learn/$slug"
              params={{ slug: c.slug }}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              <div className="aspect-video bg-accent">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.title} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <BookOpen className="size-8 text-accent-foreground" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="font-semibold">{c.title}</h2>
                <p className="text-sm text-muted-foreground">{c.teacherName}</p>
                <div className="mt-auto pt-3">
                  <Progress value={c.percent} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.done}/{c.total} · {c.percent}% {t("learn.progress")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
