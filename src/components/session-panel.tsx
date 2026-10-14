import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Pencil, RotateCcw, X } from "lucide-react";
import {
  cancelClassSession,
  createClassSession,
  listClassSessions,
  restoreClassSession,
  updateClassSession,
} from "@/lib/teach.functions";
import { dateKey, formatDateKey, formatTimeRange, viewerTimeZone } from "@/lib/calendar";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckinQrDialog } from "@/components/checkin-qr-dialog";
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

type SessionFormat = "online" | "in_person";

type SessionForm = {
  title: string;
  startsAt: string;
  durationMinutes: string;
  format: SessionFormat;
  meetingUrl: string;
  location: string;
};

type ClassSession = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  format: string;
  meetingUrl: string | null;
  location: string | null;
  status: string;
};

const EMPTY_FORM: SessionForm = {
  title: "",
  startsAt: "",
  durationMinutes: "60",
  format: "online",
  meetingUrl: "",
  location: "",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isPastLocal(local: string) {
  return new Date(local).getTime() <= Date.now();
}

function isFormReady(f: SessionForm) {
  return !!f.title.trim() && !!f.startsAt && (f.format !== "in_person" || !!f.location.trim());
}

function toForm(s: ClassSession): SessionForm {
  return {
    title: s.title,
    startsAt: toLocalInput(s.startsAt),
    durationMinutes: String(s.durationMinutes),
    format: s.format as SessionFormat,
    meetingUrl: s.meetingUrl ?? "",
    location: s.location ?? "",
  };
}

function sessionErrorKey(err: unknown): keyof Dict {
  const message = err instanceof Error ? err.message : "";
  if (message === "Class is archived") return "session.archivedClass";
  if (message === "Meeting link must use https") return "session.httpsOnly";
  if (message === "Meeting link required") return "session.meetingRequired";
  if (message === "Location required") return "session.locationRequired";
  if (message === "Session must start in the future") return "session.pastStart";
  if (message === "Session is cancelled") return "session.cancelledEdit";
  if (message === "Session is not cancelled") return "session.notCancelled";
  return "session.error";
}

function restoreErrorKey(err: unknown): keyof Dict {
  const message = err instanceof Error ? err.message : "";
  if (message === "Session must start in the future") return "session.restorePast";
  return sessionErrorKey(err);
}

function SessionFields({
  form,
  onChange,
}: {
  form: SessionForm;
  onChange: (next: SessionForm) => void;
}) {
  const { t } = useI18n();
  const nowLocal = toLocalInput(new Date().toISOString());
  return (
    <>
      <div>
        <Label>{t("session.titleLabel")}</Label>
        <Input
          className="mt-1"
          maxLength={160}
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("session.startsAt")}</Label>
          <Input
            type="datetime-local"
            className="mt-1"
            min={form.startsAt && form.startsAt < nowLocal ? undefined : nowLocal}
            value={form.startsAt}
            onChange={(e) => onChange({ ...form, startsAt: e.target.value })}
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
            onChange={(e) => onChange({ ...form, durationMinutes: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="session-format">{t("session.format")}</Label>
        <select
          id="session-format"
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.format}
          onChange={(e) => onChange({ ...form, format: e.target.value as SessionFormat })}
        >
          <option value="online">{t("session.formatOnline")}</option>
          <option value="in_person">{t("session.formatInPerson")}</option>
        </select>
      </div>
      {form.format === "online" ? (
        <div>
          <Label>{t("session.meetingUrl")}</Label>
          <Input
            type="url"
            className="mt-1"
            placeholder="https://"
            maxLength={500}
            value={form.meetingUrl}
            onChange={(e) => onChange({ ...form, meetingUrl: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("session.meetingUrlHelp")}</p>
        </div>
      ) : (
        <div>
          <Label>{t("session.location")}</Label>
          <Input
            className="mt-1"
            maxLength={200}
            value={form.location}
            onChange={(e) => onChange({ ...form, location: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("session.locationHelp")}</p>
        </div>
      )}
    </>
  );
}

function SessionEditDialog({ session, onSaved }: { session: ClassSession; onSaved: () => void }) {
  const { t } = useI18n();
  const update = useServerFn(updateClassSession);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(session));
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setForm(toForm(session));
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Unchanged start times are allowed so ongoing sessions can still be edited.
    if (form.startsAt !== toLocalInput(session.startsAt) && isPastLocal(form.startsAt)) {
      toast.error(t("session.pastStart"));
      return;
    }
    setBusy(true);
    try {
      await update({
        data: {
          sessionId: session.id,
          title: form.title.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          timeZone: viewerTimeZone(),
          format: form.format,
          meetingUrl: form.meetingUrl.trim(),
          location: form.location.trim(),
        },
      });
      setOpen(false);
      onSaved();
      toast.success(t("session.updated"));
    } catch (err) {
      toast.error(t(sessionErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={busy} onClick={openDialog}>
        <Pencil className="size-4" /> {t("session.edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("session.editTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <SessionFields form={form} onChange={setForm} />
            <div>
              <Button type="submit" disabled={busy || !isFormReady(form)}>
                {t("session.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SessionPanel({ classroomId }: { classroomId: string }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listClassSessions);
  const create = useServerFn(createClassSession);
  const cancel = useServerFn(cancelClassSession);
  const restore = useServerFn(restoreClassSession);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const timeZone = viewerTimeZone();
  const now = Date.now();

  const { data: sessions } = useQuery({
    queryKey: ["class-sessions", classroomId],
    queryFn: () => fetchSessions({ data: { classroomId } }),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["class-sessions", classroomId] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isPastLocal(form.startsAt)) {
      toast.error(t("session.pastStart"));
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          classroomId,
          title: form.title.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          timeZone,
          format: form.format,
          meetingUrl: form.meetingUrl.trim(),
          location: form.location.trim(),
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
      toast.success(t("session.cancelledDone"));
    } catch (err) {
      toast.error(t(sessionErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function restoreSession(sessionId: string) {
    setBusy(true);
    try {
      await restore({ data: { sessionId } });
      refresh();
      toast.success(t("session.restored"));
    } catch (err) {
      toast.error(t(restoreErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  const endsAt = (s: ClassSession) => new Date(s.startsAt).getTime() + s.durationMinutes * 60_000;
  const upcoming = (sessions ?? []).filter((s) => endsAt(s) >= now);
  const past = (sessions ?? []).filter((s) => endsAt(s) < now).reverse();
  const groups = [
    { key: "upcoming", label: t("session.upcoming"), items: upcoming },
    { key: "past", label: t("session.past"), items: past },
  ].filter((g) => g.items.length > 0);

  function renderRow(s: ClassSession) {
    const cancelled = s.status === "cancelled";
    const startsInFuture = new Date(s.startsAt).getTime() > now;
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
          {s.format === "in_person" ? (
            <p className="text-sm text-muted-foreground">
              {t("session.formatInPerson")}
              {s.location ? ` · ${s.location}` : null}
            </p>
          ) : s.meetingUrl ? (
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
        {!cancelled ? <CheckinQrDialog sessionId={s.id} /> : null}
        {cancelled ? <Badge variant="outline">{t("session.cancelled")}</Badge> : null}
        {cancelled && startsInFuture ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => restoreSession(s.id)}>
            <RotateCcw className="size-4" /> {t("session.restore")}
          </Button>
        ) : null}
        {!cancelled ? <SessionEditDialog session={s} onSaved={refresh} /> : null}
        {!cancelled ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy} aria-label={t("session.cancel")}>
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
        ) : null}
      </li>
    );
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
        <SessionFields form={form} onChange={setForm} />
        <div>
          <Button
            type="submit"
            disabled={busy || !isFormReady(form)}
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

      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{g.label}</h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {g.items.map(renderRow)}
          </ul>
        </section>
      ))}
    </section>
  );
}
