import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMySessions } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { WeekAgenda } from "@/components/week-agenda";
import { SessionRow } from "@/components/session-row";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [{ title: "My calendar — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: StudentCalendar,
});

function startsAtOf(item: { startsAt: string }) {
  return item.startsAt;
}

function StudentCalendar() {
  const { t } = useI18n();
  const fetchSessions = useServerFn(getMySessions);
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => fetchSessions(),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="title-page">{t("calendar.studentTitle")}</h1>
      <div className="mt-8">
        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <WeekAgenda
            items={sessions ?? []}
            getKey={(s) => s.id}
            getStartsAt={startsAtOf}
            renderItem={(s) => (
              <SessionRow
                title={s.title}
                startsAt={s.startsAt}
                durationMinutes={s.durationMinutes}
                classroomName={s.classroomName}
                meetingUrl={s.meetingUrl}
                cancelled={false}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
