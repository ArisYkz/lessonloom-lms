import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyCourses, getMyLearnerCount, getMyOrg } from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/teach/plan")({
  head: () => ({
    meta: [{ title: "Plan — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { t } = useI18n();
  const fetchOrg = useServerFn(getMyOrg);
  const fetchLearners = useServerFn(getMyLearnerCount);
  const fetchCourses = useServerFn(getMyCourses);
  const { data: org, isLoading } = useQuery({ queryKey: ["my-org"], queryFn: () => fetchOrg() });
  const { data: learners } = useQuery({
    queryKey: ["my-learner-count"],
    queryFn: () => fetchLearners(),
  });
  const { data: courses } = useQuery({ queryKey: ["my-courses"], queryFn: () => fetchCourses() });

  if (isLoading) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-muted-foreground">{t("common.loading")}</p>
    );
  }
  if (!org) return <Navigate to="/teach" replace />;

  const plan = org.plan;
  const studentsUsed = learners?.learners ?? 0;
  const coursesUsed = courses?.courses.length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t("plan.title")}</p>
        <p className="title-panel mt-1">{plan.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${plan.price_kzt.toLocaleString("ru-RU")} ₸ ${t("plan.perMonth")}`}
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-card p-6">
        <p className="font-medium">{t("plan.usage")}</p>
        <Usage
          label={t("plan.studentsUsed")}
          used={studentsUsed}
          max={plan.max_students}
          unlimited={t("plan.unlimited")}
        />
        <Usage
          label={t("plan.coursesUsed")}
          used={coursesUsed}
          max={plan.max_courses}
          unlimited={t("plan.unlimited")}
        />
        <p className="text-sm text-muted-foreground">{t("plan.upgradeSoon")}</p>
      </div>
    </div>
  );
}

function Usage({
  label,
  used,
  max,
  unlimited,
}: {
  label: string;
  used: number;
  max: number | null;
  unlimited: string;
}) {
  const percent = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} / {max ?? unlimited}
        </span>
      </div>
      {max ? <Progress value={percent} className="mt-2" /> : null}
    </div>
  );
}
