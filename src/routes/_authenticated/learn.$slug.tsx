import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { getLessonContent, getPlayer, setLessonComplete } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { LessonActivities } from "@/components/lesson-activities";
import { DanmakuPlayer } from "@/components/danmaku-player";

export const Route = createFileRoute("/_authenticated/learn/$slug")({
  head: () => ({
    meta: [
      { title: "Course player — Bilim" },
      { name: "description", content: "Watch lessons and track your progress." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Course player — Bilim" },
      { property: "og:description", content: "Watch lessons and track your progress." },
    ],
  }),
  component: Player,
});

function Player() {
  const { slug } = Route.useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchPlayer = useServerFn(getPlayer);
  const fetchLesson = useServerFn(getLessonContent);
  const complete = useServerFn(setLessonComplete);
  const [lessonId, setLessonId] = useState<string | null>(null);

  const { data: player, isLoading } = useQuery({
    queryKey: ["player", slug],
    queryFn: () => fetchPlayer({ data: { slug } }),
  });

  const flat = useMemo(
    () => (player?.sections ?? []).flatMap((s) => s.lessons.map((l) => ({ ...l, sectionTitle: s.title }))),
    [player],
  );

  useEffect(() => {
    if (!lessonId && flat.length > 0) setLessonId(flat[0]!.id);
  }, [flat, lessonId]);

  const { data: lesson } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchLesson({ data: { lessonId: lessonId! } }),
    enabled: !!lessonId,
  });

  if (isLoading) return <p className="p-12 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!player) return <p className="p-12 text-center text-muted-foreground">{t("course.notFound")}</p>;
  if (!player.access) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">{t("learn.noAccess")}</p>
        <Button asChild className="mt-4">
          <Link to="/courses/$slug" params={{ slug }}>
            {t("common.back")}
          </Link>
        </Button>
      </div>
    );
  }

  const done = new Set(player.progress);
  const index = flat.findIndex((l) => l.id === lessonId);
  const percent = flat.length === 0 ? 0 : Math.round((done.size / flat.length) * 100);
  const isDone = lessonId ? done.has(lessonId) : false;

  async function toggle() {
    if (!lessonId || !player) return;
    try {
      const res = await complete({ data: { lessonId, courseId: player.courseId!, completed: !isDone } });
      if (res.missing.length > 0) {
        toast.error(res.missing.map((m) => t(m === "homework" ? "act.missingHomework" : "act.missingQuiz")).join(" "));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["player", slug] });
      await queryClient.invalidateQueries({ queryKey: ["my-learning"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <Link
          to="/courses/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {player.title}
        </Link>

        {lesson ? (
          <div className="mt-4">
            <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>

            {lesson.type === "video" && lesson.mediaUrl ? (
              <DanmakuPlayer
                key={lesson.id}
                src={lesson.mediaUrl}
                lessonId={lesson.id}
                enabled={lesson.danmakuEnabled}
                canPost={lesson.hasAccess}
                previewLimit={lesson.previewLimit}
                courseSlug={slug}
              />
            ) : null}

            {lesson.type === "file" && lesson.mediaUrl ? (
              <Button asChild variant="outline" className="mt-5">
                <a href={lesson.mediaUrl} target="_blank" rel="noreferrer">
                  <Download className="size-4" /> {t("learn.download")}
                </a>
              </Button>
            ) : null}

            {lesson.body ? (
              <div className="mt-6 text-foreground">
                <Markdown>{lesson.body}</Markdown>
              </div>
            ) : null}

            {lesson.hasAccess ? <LessonActivities
              lessonId={lesson.id}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: ["player", slug] })}
            /> : null}

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              {lesson.hasAccess ? (
                <Button variant={isDone ? "secondary" : "default"} onClick={toggle}>
                  <Check className="size-4" /> {isDone ? t("learn.completed") : t("learn.complete")}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/courses/$slug" params={{ slug }}>{t("preview.subscribe")}</Link>
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={index <= 0}
                  onClick={() => setLessonId(flat[index - 1]!.id)}
                >
                  <ChevronLeft className="size-4" /> {t("learn.prev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={index < 0 || index >= flat.length - 1}
                  onClick={() => setLessonId(flat[index + 1]!.id)}
                >
                  {t("learn.next")} <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-10 text-muted-foreground">{t("learn.selectLesson")}</p>
        )}
      </div>

      <aside className="h-fit rounded-xl border border-border bg-card p-4 lg:sticky lg:top-20">
        {percent === 100 ? (
          <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{t("act.courseComplete")}</p>
        ) : null}
        <Progress value={percent} />
        <p className="mt-2 text-xs text-muted-foreground">
          {done.size}/{flat.length} · {percent}% {t("learn.progress")}
        </p>
        <div className="mt-4 space-y-4">
          {player.sections.map((s) => (
            <div key={s.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</p>
              <ul className="mt-2 space-y-1">
                {s.lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setLessonId(l.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                        lessonId === l.id && "bg-accent font-medium",
                      )}
                    >
                      {done.has(l.id) ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : l.type === "video" ? (
                        <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{l.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
