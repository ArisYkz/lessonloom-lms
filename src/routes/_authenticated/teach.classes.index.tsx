import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listMyClassrooms } from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teach/classes/")({
  head: () => ({
    meta: [{ title: "Classes — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: ClassList,
});

function ClassList() {
  const { t } = useI18n();
  const fetchClassrooms = useServerFn(listMyClassrooms);
  const { data, isLoading } = useQuery({
    queryKey: ["my-classrooms"],
    queryFn: () => fetchClassrooms(),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="title-page">{t("classroom.title")}</h1>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground">{t("classroom.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((classroom) => (
              <li key={classroom.id}>
                <Link
                  to="/teach/classes/$classId"
                  params={{ classId: classroom.id }}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-5 hover:border-primary"
                >
                  <span className="font-medium">{classroom.name}</span>
                  <Badge variant={classroom.status === "active" ? "secondary" : "outline"}>
                    {t(classroom.status === "active" ? "classroom.active" : "classroom.archived")}
                  </Badge>
                  {classroom.listed ? (
                    <Badge variant="outline">{t("classroom.listed")}</Badge>
                  ) : null}
                  <span className="text-sm text-muted-foreground">{classroom.courseTitle}</span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {t("classroom.open")} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
