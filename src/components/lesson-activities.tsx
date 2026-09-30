import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Download, EyeOff, Eye, Paperclip, X } from "lucide-react";
import {
  getLessonActivities,
  moderateDiscussion,
  postDiscussion,
  submitHomework,
  submitQuiz,
} from "@/lib/activity.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

type Activities = Awaited<ReturnType<typeof getLessonActivities>>;

export function LessonActivities({ lessonId, onChanged }: { lessonId: string; onChanged: () => void }) {
  const fetchActivities = useServerFn(getLessonActivities);
  const { data, refetch } = useQuery({
    queryKey: ["activities", lessonId],
    queryFn: () => fetchActivities({ data: { lessonId } }),
  });
  if (!data) return null;
  const reload = () => {
    void refetch();
    onChanged();
  };
  return (
    <div className="mt-8 space-y-6">
      {data.resources.length > 0 ? <Resources items={data.resources} /> : null}
      {data.homework ? <Homework lessonId={lessonId} hw={data.homework} onDone={reload} /> : null}
      {data.quiz && data.quiz.questions.length > 0 ? <Quiz key={lessonId} lessonId={lessonId} quiz={data.quiz} onDone={reload} /> : null}
      {data.discussionEnabled ? <Discussion lessonId={lessonId} data={data} onDone={reload} /> : null}
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Resources({ items }: { items: Activities["resources"] }) {
  const { t } = useI18n();
  return (
    <Card title={t("act.resources")}>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <a href={r.url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <Download className="size-4" /> {r.title}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Homework({ lessonId, hw, onDone }: { lessonId: string; hw: NonNullable<Activities["homework"]>; onDone: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const submit = useServerFn(submitHomework);
  const sub = hw.submission;
  const [editing, setEditing] = useState(!sub);
  const [body, setBody] = useState(sub?.body ?? "");
  const [files, setFiles] = useState<{ path: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const status = (sub?.status ?? "not_started") as "not_started" | "submitted" | "needs_revision" | "reviewed";

  async function upload(file: File) {
    if (!user) return;
    const path = `${user.id}/submissions/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("course-media").upload(path, file);
    if (error) throw new Error(error.message);
    setFiles((f) => [...f, { path, name: file.name }]);
  }

  async function send() {
    setBusy(true);
    try {
      await submit({ data: { lessonId, body, filePaths: files.map((f) => f.path) } });
      setEditing(false);
      setFiles([]);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("act.homework")}
      badge={
        <>
          {hw.required ? <Badge variant="outline">{t("act.required")}</Badge> : null}
          <Badge variant={status === "reviewed" ? "default" : "secondary"} className="ml-auto">
            {t(`act.status.${status}` as keyof Dict)}
          </Badge>
        </>
      }
    >
      {hw.instructions ? <Markdown>{hw.instructions}</Markdown> : null}

      {sub && !editing ? (
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          {sub.body ? <p className="whitespace-pre-wrap text-sm">{sub.body}</p> : null}
          {sub.files.map((f) => (
            <a key={f.name} href={f.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Paperclip className="size-4" /> {f.name}
            </a>
          ))}
          {sub.feedback || sub.score !== null ? (
            <div className="rounded-lg bg-secondary/60 p-4">
              <p className="text-sm font-medium">{t("act.feedback")}</p>
              {sub.score !== null ? (
                <p className="mt-1 text-sm">
                  {t("act.score")}: {sub.score}
                  {hw.max_score ? ` / ${hw.max_score}` : ""}
                </p>
              ) : null}
              {sub.feedback ? <p className="mt-2 whitespace-pre-wrap text-sm">{sub.feedback}</p> : null}
            </div>
          ) : null}
          {status !== "reviewed" ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("act.resubmit")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {hw.allow_text ? <Textarea rows={6} placeholder={t("act.yourAnswer")} value={body} onChange={(e) => setBody(e.target.value)} /> : null}
          {hw.allow_file ? (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t("act.attachFiles")}</label>
              <Input
                type="file"
                className="max-w-xs"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) await upload(f).catch((err) => toast.error(err.message));
                }}
              />
              {files.map((f) => (
                <div key={f.path} className="flex items-center gap-2 text-sm">
                  <Paperclip className="size-4" /> {f.name}
                  <button type="button" onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))} aria-label="remove">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <Button onClick={send} disabled={busy || (!body.trim() && files.length === 0)}>
            {t("act.submitHomework")}
          </Button>
        </div>
      )}
    </Card>
  );
}

type QuizResult = Awaited<ReturnType<typeof submitQuiz>>;

function Quiz({ lessonId, quiz, onDone }: { lessonId: string; quiz: NonNullable<Activities["quiz"]>; onDone: () => void }) {
  const { t } = useI18n();
  const submit = useServerFn(submitQuiz);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      setResult(await submit({ data: { lessonId, answers } }));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const last = quiz.lastAttempt;
  return (
    <Card
      title={t("act.quiz")}
      badge={
        <>
          {quiz.required ? <Badge variant="outline">{t("act.required")}</Badge> : null}
          {last && !result ? (
            <Badge variant={last.passed ? "default" : "secondary"} className="ml-auto">
              {t("act.lastAttempt")}: {last.score}/{last.total} · {last.passed ? t("act.passed") : t("act.failed")}
            </Badge>
          ) : null}
        </>
      }
    >
      <ol className="space-y-6">
        {quiz.questions.map((q, i) => {
          const r = result?.results.find((x) => x.questionId === q.id);
          return (
            <li key={q.id}>
              <p className="font-medium">
                {i + 1}. <span className="whitespace-pre-wrap">{q.question}</span>
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((o) => {
                  const chosen = answers[q.id] === o.id;
                  const isCorrect = r?.correctOptionId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent disabled:cursor-default",
                        chosen && !result && "border-primary bg-accent",
                        result && isCorrect && "border-primary bg-primary/10",
                        result && chosen && !isCorrect && "border-destructive bg-destructive/10",
                      )}
                    >
                      <span className={cn("size-4 shrink-0 rounded-full border border-border", chosen && "border-4 border-primary")} />
                      {o.text}
                    </button>
                  );
                })}
              </div>
              {r ? (
                <p className={cn("mt-2 text-sm", r.isCorrect ? "text-primary" : "text-destructive")}>
                  {r.isCorrect ? t("act.correct") : t("act.incorrect")}
                  {r.explanation ? <span className="text-muted-foreground"> — {r.explanation}</span> : null}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex items-center gap-3">
        {result ? (
          <>
            <p className="font-medium">
              {result.score}/{result.total} · {result.passed ? t("act.passed") : t("act.failed")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
            >
              {t("act.retake")}
            </Button>
          </>
        ) : (
          <Button onClick={check} disabled={busy || Object.keys(answers).length < quiz.questions.length}>
            {t("act.submitQuiz")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Discussion({ lessonId, data, onDone }: { lessonId: string; data: Activities; onDone: () => void }) {
  const { t } = useI18n();
  const post = useServerFn(postDiscussion);
  const moderate = useServerFn(moderateDiscussion);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  async function send(threadId?: string) {
    const text = threadId ? reply : body;
    if (!text.trim()) return;
    try {
      await post({ data: { lessonId, body: text, ...(threadId ? { threadId } : {}) } });
      if (threadId) {
        setReply("");
        setReplyTo(null);
      } else setBody("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }
  async function toggle(kind: "thread" | "reply", id: string, hidden: boolean) {
    await moderate({ data: { kind, id, hidden } });
    void qc.invalidateQueries({ queryKey: ["activities", lessonId] });
  }

  const ModBtn = ({ kind, id, hidden }: { kind: "thread" | "reply"; id: string; hidden: boolean }) =>
    data.isEditor ? (
      <button type="button" onClick={() => toggle(kind, id, !hidden)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
        {hidden ? <Eye className="inline size-3" /> : <EyeOff className="inline size-3" />} {hidden ? t("act.unhide") : t("act.hide")}
      </button>
    ) : null;

  return (
    <Card title={t("act.discussion")}>
      <div className="space-y-2">
        <Textarea rows={3} placeholder={t("act.askQuestion")} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button size="sm" onClick={() => send()} disabled={!body.trim()}>
          {t("act.postQuestion")}
        </Button>
      </div>
      {data.threads.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("act.noQuestions")}</p>
      ) : (
        <ul className="mt-6 space-y-5">
          {data.threads.map((th) => (
            <li key={th.id} className={cn("border-t border-border pt-5", th.hidden && "opacity-50")}>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{th.author}</span>
                <span className="text-muted-foreground">{new Date(th.createdAt).toLocaleDateString()}</span>
                {th.hidden ? <Badge variant="outline">{t("act.hidden")}</Badge> : null}
                <ModBtn kind="thread" id={th.id} hidden={th.hidden} />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{th.body}</p>
              <ul className="mt-3 space-y-3 border-l border-border pl-4">
                {th.replies.map((r) => (
                  <li key={r.id} className={cn(r.hidden && "opacity-50")}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{r.author}</span>
                      {r.isTeacher ? (
                        <Badge variant="secondary">
                          <Check className="size-3" /> {t("act.teacher")}
                        </Badge>
                      ) : null}
                      <ModBtn kind="reply" id={r.id} hidden={r.hidden} />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
                  </li>
                ))}
              </ul>
              {replyTo === th.id ? (
                <div className="mt-3 space-y-2 pl-4">
                  <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => send(th.id)} disabled={!reply.trim()}>
                      {t("act.reply")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setReplyTo(th.id)} className="mt-2 pl-4 text-xs text-primary hover:underline">
                  {t("act.reply")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
