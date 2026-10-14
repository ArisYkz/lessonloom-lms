import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { getMyClasses, getMySessions } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { dateKey, dayBoundsIso, viewerTimeZone } from "@/lib/calendar";
import { WeekAgenda } from "@/components/week-agenda";
import { SessionRow } from "@/components/session-row";
import { SessionRangeFilter, type SessionRange } from "@/components/session-range-filter";

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
  const fetchClasses = useServerFn(getMyClasses);
  const todayKey = dateKey(new Date(), viewerTimeZone());
  const [range, setRange] = useState<SessionRange>({ from: todayKey, to: "" });
  const bounds = useMemo(() => {
    const next: { from?: string; to?: string } = {};
    if (range.from) next.from = dayBoundsIso(range.from).from;
    if (range.to) next.to = dayBoundsIso(range.to).to;
    return next;
  }, [range]);
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["my-sessions", bounds],
    queryFn: () => fetchSessions({ data: bounds }),
  });
  const { data: classes } = useQuery({
    queryKey: ["my-classes"],
    queryFn: () => fetchClasses(),
  });
  const membersByClass = useMemo(
    () => new Map((classes ?? []).map((c) => [c.classroomId, c.members])),
    [classes],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="title-page">{t("calendar.studentTitle")}</h1>
      <div className="mt-6">
        <SessionRangeFilter
          value={range}
          onChange={setRange}
          onReset={() => setRange({ from: "", to: "" })}
        />
      </div>
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
                format={s.format}
                meetingUrl={s.meetingUrl}
                location={s.location}
                cancelled={s.status === "cancelled"}
                attendees={membersByClass.get(s.classroomId)}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
