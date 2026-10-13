import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, X } from "lucide-react";
import { cancelClassSession, createClassSession, listClassSessions } from "@/lib/teach.functions";
import { dateKey, formatDateKey, formatTimeRange, viewerTimeZone } from "@/lib/calendar";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const EMPTY_FORM = { title: "", startsAt: "", durationMinutes: "60", meetingUrl: "" };

function sessionErrorKey(err: unknown): keyof Dict {
  const message = err instanceof Error ? err.message : "";
  if (message === "Class is archived") return "session.archivedClass";
  if (message === "Meeting link must use https") return "session.httpsOnly";
  return "session.error";
}

export function SessionPanel({ classroomId }: { classroomId: string }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listClassSessions);
  const create = useServerFn(createClassSession);
  const cancel = useServerFn(cancelClassSession);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const timeZone = viewerTimeZone();

  const { data: sessions } = useQuery({
    queryKey: ["class-sessions", classroomId],
    queryFn: () => fetchSessions({ data: { classroomId } }),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["class-sessions", classroomId] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          classroomId,
          title: form.title.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          timeZone,
          meetingUrl: form.meetingUrl.trim(),
        },
      });
      setForm(EMPTY_FORM);
      refresh();
      toast.success(t("session.created"));
    } catch (err) {
      toast.error(t(sessionErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession(sessionId: string) {
    setBusy(true);
    try {
      await cancel({ data: { sessionId } });
      refresh();
    } catch (err) {
      toast.error(t(sessionErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("session.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("session.zoneNote")}: {timeZone}
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <Label>{t("session.titleLabel")}</Label>
          <Input
            className="mt-1"
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("session.startsAt")}</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("session.duration")}</Label>
            <Input
              type="number"
              min={5}
              max={480}
              className="mt-1"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>{t("session.meetingUrl")}</Label>
          <Input
            type="url"
            className="mt-1"
            placeholder="https://"
            maxLength={500}
            value={form.meetingUrl}
            onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("session.meetingUrlHelp")}</p>
        </div>
        <div>
          <Button
            type="submit"
            disabled={busy || !form.title.trim() || !form.startsAt}
            className="justify-self-start"
          >
            <CalendarPlus className="size-4" /> {t("session.create")}
          </Button>
        </div>
      </form>

      {sessions && sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          {t("session.empty")}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(sessions ?? []).map((s) => {
          const cancelled = s.status === "cancelled";
          return (
            <li
              key={s.id}
              className={`flex flex-wrap items-center gap-3 p-4 ${cancelled ? "opacity-60" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateKey(dateKey(new Date(s.startsAt), timeZone), locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {formatTimeRange(s.startsAt, s.durationMinutes, timeZone, locale)}
                </p>
                {s.meetingUrl ? (
                  <a
                    href={s.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t("session.meeting")}
                  </a>
                ) : null}
              </div>
              {cancelled ? (
                <Badge variant="outline">{t("session.cancelled")}</Badge>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={t("session.cancel")}
                    >
                      <X className="size-4" /> {t("session.cancel")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("session.cancel")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("session.cancelConfirm")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cancelSession(s.id)}>
                        {t("session.cancel")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
