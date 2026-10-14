import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listMyClassrooms } from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import { ClassroomCard } from "@/components/classroom-panel";
import { SessionPanel } from "@/components/session-panel";
import { HomeworkDuePanel } from "@/components/homework-due-panel";

export const Route = createFileRoute("/_authenticated/teach/classes/$classId")({
  head: () => ({
    meta: [{ title: "Class — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: ClassPage,
});

function ClassPage() {
  const { classId } = Route.useParams();
  const { t } = useI18n();
  const fetchClassrooms = useServerFn(listMyClassrooms);
  const { data, isLoading } = useQuery({
    queryKey: ["my-classrooms"],
    queryFn: () => fetchClassrooms(),
  });

  if (isLoading)
    return <p className="p-12 text-center text-muted-foreground">{t("common.loading")}</p>;

  const classroom = data?.find((c) => c.id === classId);
  if (!classroom)
    return <p className="p-12 text-center text-muted-foreground">{t("classroom.notFound")}</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        to="/teach/$courseId"
        params={{ courseId: classroom.courseId }}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {classroom.courseTitle || t("teach.title")}
      </Link>
      <h1 className="title-page mt-3">{classroom.name}</h1>

      <div className="mt-8 space-y-12">
        <ClassroomCard classroom={classroom} courseId={classroom.courseId} />
        <SessionPanel classroomId={classroom.id} />
        <HomeworkDuePanel classroomId={classroom.id} />
      </div>
    </div>
  );
}
