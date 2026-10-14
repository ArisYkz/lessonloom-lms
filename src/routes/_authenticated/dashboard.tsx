import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import {
  getMyLearning,
  joinClassroom,
  leaveClassCourse,
  unenrollCourse,
} from "@/lib/learn.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import { formatTimeRange, viewerTimeZone } from "@/lib/calendar";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchLearning = useServerFn(getMyLearning);
  const join = useServerFn(joinClassroom);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["my-learning"],
    queryFn: () => fetchLearning(),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { alreadyMember } = await join({ data: { code: code.trim() } });
      setCode("");
      if (alreadyMember) toast.info(t("join.alreadyMember"));
      else toast.success(t("join.success"));
      queryClient.invalidateQueries({ queryKey: ["my-learning"] });
      queryClient.invalidateQueries({ queryKey: ["enrollment"] });
    } catch (err) {
      toast.error(t(classroomErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-page">{t("learn.myCourses")}</h1>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="title-section">{t("join.title")}</h2>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <Input
            placeholder={t("join.placeholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={busy || !code.trim()}>
            {t("join.submit")}
          </Button>
        </form>
      </section>

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
            <div key={c.slug} className="flex flex-col gap-2">
              <Link
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
                  <h2 className="title-card">{c.title}</h2>
                  <p className="text-sm text-muted-foreground">{c.teacherName}</p>
                  {c.classroomId ? (
                    <Badge variant="secondary" className="w-fit">
                      {t("join.viaClass")}
                    </Badge>
                  ) : null}
                  {c.nextSession ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("classes.nextSession")}: </span>
                      {c.nextSession.title} ·{" "}
                      {formatTimeRange(
                        c.nextSession.startsAt,
                        c.nextSession.durationMinutes,
                        viewerTimeZone(),
                        locale,
                      )}
                      {c.nextSession.location ? ` · ${c.nextSession.location}` : null}
                    </p>
                  ) : null}
                  {c.homeworkDue ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{t("learn.homeworkDue")}: </span>
                      {c.homeworkDue.title} · {formatDueAt(c.homeworkDue.dueAt, locale)}
                      {c.homeworkDue.overdue ? (
                        <Badge variant="destructive">{t("learn.overdue")}</Badge>
                      ) : null}
                    </p>
                  ) : null}
                  <div className="mt-auto pt-3">
                    <Progress value={c.percent} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.done}/{c.total} · {c.percent}% {t("learn.progress")}
                    </p>
                  </div>
                </div>
              </Link>
              <LeaveCourseButton courseId={c.courseId} viaClass={Boolean(c.classroomId)} />
              {c.nextSession?.meetingUrl ? (
                <a
                  href={c.nextSession.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {t("session.join")}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDueAt(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// A course reached through a class is left by leaving the class; a directly enrolled one
// is left by deleting the enrollment, which is what unenrollCourse does.
function LeaveCourseButton({ courseId, viaClass }: { courseId: string; viaClass: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const leaveClass = useServerFn(leaveClassCourse);
  const unenroll = useServerFn(unenrollCourse);
  const [busy, setBusy] = useState(false);
  const action = viaClass ? "join.leave" : "learn.unenroll";

  async function confirmLeave() {
    setBusy(true);
    try {
      if (viaClass) await leaveClass({ data: { courseId } });
      else await unenroll({ data: { courseId } });
      queryClient.invalidateQueries({ queryKey: ["my-learning"] });
      queryClient.invalidateQueries({ queryKey: ["enrollment"] });
    } catch (err) {
      toast.error(t(classroomErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy} className="self-start">
          {t(action)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(action)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(viaClass ? "join.leaveConfirm" : "learn.unenrollConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmLeave}>{t(action)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
