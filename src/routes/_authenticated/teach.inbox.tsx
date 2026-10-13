import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { getHomeworkInbox, getSubmission, reviewSubmission } from "@/lib/teach-activity.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teach/inbox")({
  head: () => ({
    meta: [
      { title: "Homework inbox — Bilim" },
      { name: "description", content: "Review student homework and give feedback." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Homework inbox — Bilim" },
      { property: "og:description", content: "Review student homework and give feedback." },
    ],
  }),
  component: Inbox,
});

type Status = "submitted" | "needs_revision" | "reviewed";

function Inbox() {
  const { t } = useI18n();
  const fetchInbox = useServerFn(getHomeworkInbox);
  const [status, setStatus] = useState<Status>("submitted");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["inbox", status],
    queryFn: () => fetchInbox({ data: { status } }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link to="/teach" className="text-sm text-muted-foreground hover:underline">
        ← {t("nav.teach")}
      </Link>
      <h1 className="title-page mt-3">{t("act.inbox")}</h1>
      <p className="mt-1 text-muted-foreground">{t("act.inboxSub")}</p>

      <div className="mt-6 flex gap-2">
        {(["submitted", "needs_revision", "reviewed"] as Status[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => {
              setStatus(s);
              setSelected(null);
            }}
          >
            {t(`act.status.${s}` as keyof Dict)}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="h-fit divide-y divide-border rounded-xl border border-border bg-card">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !data || data.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("act.inboxEmpty")}</p>
          ) : (
            data.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn(
                  "block w-full p-4 text-left transition-colors hover:bg-accent",
                  selected === r.id && "bg-accent",
                )}
              >
                <p className="font-medium">{r.student}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.course} · {r.lesson}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.submittedAt).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
        {selected ? <Review key={selected} id={selected} onDone={() => setSelected(null)} /> : null}
      </div>
    </div>
  );
}

function Review({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchSub = useServerFn(getSubmission);
  const review = useServerFn(reviewSubmission);
  const { data } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => fetchSub({ data: { id } }),
  });
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setFeedback(data.feedback ?? "");
      setScore(data.score !== null ? String(data.score) : "");
    }
  }, [data]);

  if (!data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  async function send(status: "needs_revision" | "reviewed") {
    setBusy(true);
    try {
      await review({ data: { id, status, feedback, score: score === "" ? null : Number(score) } });
      await qc.invalidateQueries({ queryKey: ["inbox"] });
      toast.success(t("builder.saved"));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <h2 className="title-panel">{data.student}</h2>
        <Badge variant="secondary" className="ml-auto">
          {t(`act.status.${data.status}` as keyof Dict)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{data.lesson}</p>
      {data.instructions ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t("act.instructions")}
          </summary>
          <div className="mt-2">
            <Markdown>{data.instructions}</Markdown>
          </div>
        </details>
      ) : null}
      <div className="mt-5 space-y-3 border-t border-border pt-5">
        {data.body ? <p className="whitespace-pre-wrap text-sm">{data.body}</p> : null}
        {data.files.map((f) => (
          <a
            key={f.name}
            href={f.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Paperclip className="size-4" /> {f.name}
          </a>
        ))}
      </div>
      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <Textarea
          rows={5}
          placeholder={t("act.feedback")}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("act.score")}
            <Input
              type="number"
              min={0}
              className="w-24"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            {data.maxScore ? `/ ${data.maxScore}` : null}
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => send("needs_revision")}>
              {t("act.returnForRevision")}
            </Button>
            <Button disabled={busy} onClick={() => send("reviewed")}>
              {t("act.markReviewed")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
