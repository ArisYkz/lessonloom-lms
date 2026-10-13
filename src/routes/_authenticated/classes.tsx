import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { User } from "lucide-react";

import { getMyClasses, getMySessions } from "@/lib/learn.functions";
import { formatTimeRange, viewerTimeZone } from "@/lib/calendar";
import { useI18n } from "@/i18n/provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [{ title: "My classes — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: MyClasses,
});

function MyClasses() {
  const { t, locale } = useI18n();
  const fetchClasses = useServerFn(getMyClasses);
  const fetchSessions = useServerFn(getMySessions);
  const [from] = useState(() => new Date().toISOString());
  const [query, setQuery] = useState("");

  const { data: classes, isLoading } = useQuery({
    queryKey: ["my-classes"],
    queryFn: () => fetchClasses(),
  });
  const { data: sessions } = useQuery({
    queryKey: ["my-sessions", "upcoming", from],
    queryFn: () => fetchSessions({ data: { from } }),
  });

  const nextByClass = useMemo(() => {
    const map = new Map<string, NonNullable<typeof sessions>[number]>();
    for (const s of sessions ?? []) {
      if (!map.has(s.classroomId)) map.set(s.classroomId, s);
    }
    return map;
  }, [sessions]);

  const needle = query.trim().toLowerCase();
  const visible = (classes ?? []).filter(
    (c) =>
      !needle ||
      [c.classroomName, c.courseTitle, c.teacherName].some((v) => v.toLowerCase().includes(needle)),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="title-page">{t("classes.title")}</h1>
        <Input
          className="w-64"
          placeholder={t("classes.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (classes ?? []).length === 0 ? (
          <p className="text-muted-foreground">{t("classes.empty")}</p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground">{t("classes.noMatch")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((c) => {
              const next = nextByClass.get(c.classroomId);
              return (
                <article
                  key={c.classroomId}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div>
                    <p className="title-panel">{c.classroomName}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.courseTitle} · {t("classes.teacher")}: {c.teacherName}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("classes.nextSession")}
                    </p>
                    {next ? (
                      <p className="mt-1 font-medium">
                        {formatTimeRange(
                          next.startsAt,
                          next.durationMinutes,
                          viewerTimeZone(),
                          locale,
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{t("classes.noSession")}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("classes.classmates")} · {c.members.length}
                    </p>
                    <div className="mt-2 flex -space-x-2">
                      {c.members.map((m, i) => (
                        <Avatar key={i} className="size-7 border-2 border-card">
                          {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                          <AvatarFallback>
                            <User className="size-3.5 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {next?.meetingUrl ? (
                      <Button asChild size="sm">
                        <a href={next.meetingUrl} target="_blank" rel="noreferrer">
                          {t("session.join")}
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link to="/learn/$slug" params={{ slug: c.courseSlug }}>
                        {t("classes.openCourse")}
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
