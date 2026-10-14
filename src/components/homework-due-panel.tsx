import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listClassHomework, setClassroomHomeworkDue } from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function homeworkErrorKey(err: unknown): keyof Dict {
  if (!(err instanceof Error)) return "classHomework.error";
  if (err.message === "Class is archived") return "session.archivedClass";
  if (err.message === "Due date must be in the future") return "homework.dueInPast";
  return "classHomework.error";
}

export function HomeworkDuePanel({ classroomId }: { classroomId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchHomework = useServerFn(listClassHomework);
  const { data: items } = useQuery({
    queryKey: ["class-homework", classroomId],
    queryFn: () => fetchHomework({ data: { classroomId } }),
  });

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("classHomework.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("classHomework.help")}</p>
      </div>

      {items && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          {t("classHomework.empty")}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(items ?? []).map((item) => (
          <HomeworkDueRow
            key={item.homeworkId}
            classroomId={classroomId}
            homeworkId={item.homeworkId}
            lessonTitle={item.lessonTitle}
            dueAt={item.dueAt}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: ["class-homework", classroomId] })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function HomeworkDueRow({
  classroomId,
  homeworkId,
  lessonTitle,
  dueAt,
  onSaved,
}: {
  classroomId: string;
  homeworkId: string;
  lessonTitle: string;
  dueAt: string | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const save = useServerFn(setClassroomHomeworkDue);
  const [draft, setDraft] = useState(() => toDateTimeLocal(dueAt));
  const [busy, setBusy] = useState(false);

  async function persist(next: string) {
    if (next && new Date(next).getTime() <= Date.now()) {
      toast.error(t("homework.dueInPast"));
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          classroomId,
          homeworkId,
          dueAt: next ? new Date(next).toISOString() : null,
        },
      });
      setDraft(next);
      onSaved();
      toast.success(t(next ? "classHomework.saved" : "classHomework.cleared"));
    } catch (err) {
      toast.error(t(homeworkErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <p className="min-w-0 flex-1 font-medium">{lessonTitle}</p>
      <Input
        type="datetime-local"
        className="w-auto"
        aria-label={t("classHomework.due")}
        min={toDateTimeLocal(new Date().toISOString())}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        disabled={busy || draft === toDateTimeLocal(dueAt)}
        onClick={() => persist(draft)}
      >
        {t("classHomework.save")}
      </Button>
      {dueAt ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => persist("")}>
          {t("classHomework.clear")}
        </Button>
      ) : null}
    </li>
  );
}
