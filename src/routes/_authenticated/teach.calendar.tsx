import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { listMyClassrooms, listTeacherSessions } from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeekAgenda } from "@/components/week-agenda";
import { SessionRow } from "@/components/session-row";

export const Route = createFileRoute("/_authenticated/teach/calendar")({
  head: () => ({
    meta: [{ title: "Calendar — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: TeacherCalendar,
});

const ALL_CLASSES = "all";

function startsAtOf(item: { startsAt: string }) {
  return item.startsAt;
}

function TeacherCalendar() {
  const { t } = useI18n();
  const fetchSessions = useServerFn(listTeacherSessions);
  const fetchClassrooms = useServerFn(listMyClassrooms);
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["teacher-sessions"],
    queryFn: () => fetchSessions(),
  });
  const { data: classrooms } = useQuery({
    queryKey: ["my-classrooms"],
    queryFn: () => fetchClassrooms(),
  });

  const visible = useMemo(
    () =>
      (sessions ?? []).filter((s) => classFilter === ALL_CLASSES || s.classroomId === classFilter),
    [sessions, classFilter],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="title-page">{t("calendar.teacherTitle")}</h1>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>{t("calendar.allClasses")}</SelectItem>
            {(classrooms ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <WeekAgenda
            items={visible}
            getKey={(s) => s.id}
            getStartsAt={startsAtOf}
            renderItem={(s) => (
              <SessionRow
                title={s.title}
                startsAt={s.startsAt}
                durationMinutes={s.durationMinutes}
                classroomName={s.classroomName}
                meetingUrl={s.meetingUrl}
                cancelled={s.status === "cancelled"}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
