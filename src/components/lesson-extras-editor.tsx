import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import {
  addResource,
  deleteResource,
  getLessonExtras,
  saveHomework,
  saveQuiz,
  setDiscussionEnabled,
  type QuizInput,
} from "@/lib/teach-activity.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const blankQ = (): QuizInput => ({
  question: "",
  explanation: "",
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
});

export function LessonExtrasEditor({ lessonId }: { lessonId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const fetchExtras = useServerFn(getLessonExtras);
  const saveHw = useServerFn(saveHomework);
  const saveQz = useServerFn(saveQuiz);
  const setDisc = useServerFn(setDiscussionEnabled);
  const addRes = useServerFn(addResource);
  const delRes = useServerFn(deleteResource);
  const { data, refetch } = useQuery({
    queryKey: ["lesson-extras", lessonId],
    queryFn: () => fetchExtras({ data: { lessonId } }),
  });

  const [hw, setHw] = useState({
    enabled: false,
    instructions: "",
    allowText: true,
    allowFile: true,
    required: false,
    maxScore: "",
  });
  const [qz, setQz] = useState({
    enabled: false,
    passingScore: 70,
    required: false,
    questions: [blankQ()],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHw({
      enabled: !!data.homework,
      instructions: data.homework?.instructions ?? "",
      allowText: data.homework?.allow_text ?? true,
      allowFile: data.homework?.allow_file ?? true,
      required: data.homework?.required ?? false,
      maxScore: data.homework?.max_score ? String(data.homework.max_score) : "",
    });
    setQz({
      enabled: !!data.quiz,
      passingScore: data.quiz?.passingScore ?? 70,
      required: data.quiz?.required ?? false,
      questions: data.quiz?.questions.length ? data.quiz.questions : [blankQ()],
    });
  }, [data]);

  if (!data) return null;

  async function saveAll() {
    setBusy(true);
    try {
      await saveHw({
        data: { lessonId, ...hw, maxScore: hw.maxScore ? Number(hw.maxScore) : null },
      });
      await saveQz({ data: { lessonId, ...qz } });
      await refetch();
      toast.success(t("builder.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const updateQ = (i: number, patch: Partial<QuizInput>) =>
    setQz({ ...qz, questions: qz.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <div className="space-y-5 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("act.lessonExtras")}
      </p>

      {/* Resources */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("act.resources")}</p>
        {data.resources.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <Paperclip className="size-4 text-muted-foreground" /> {r.title}
            <button
              type="button"
              className="ml-auto"
              onClick={async () => {
                await delRes({ data: { id: r.id } });
                void refetch();
              }}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
        ))}
        <Input
          type="file"
          className="max-w-xs"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || !user) return;
            const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
            const { error } = await supabase.storage.from("course-media").upload(path, f);
            if (error) return void toast.error(error.message);
            await addRes({ data: { lessonId, title: f.name, path } });
            void refetch();
          }}
        />
      </div>

      {/* Discussion */}
      <label className="flex items-center gap-2 text-sm font-medium">
        <Switch
          checked={data.discussionEnabled}
          onCheckedChange={async (v) => {
            await setDisc({ data: { lessonId, enabled: v } });
            void refetch();
          }}
        />
        {t("act.enableDiscussion")}
      </label>

      {/* Homework */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={hw.enabled} onCheckedChange={(v) => setHw({ ...hw, enabled: v })} />
          {t("act.enableHomework")}
        </label>
        {hw.enabled ? (
          <div className="space-y-3 pl-2">
            <Textarea
              rows={4}
              placeholder={t("act.instructions")}
              value={hw.instructions}
              onChange={(e) => setHw({ ...hw, instructions: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <Switch
                  checked={hw.allowText}
                  onCheckedChange={(v) => setHw({ ...hw, allowText: v })}
                />{" "}
                {t("act.allowText")}
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={hw.allowFile}
                  onCheckedChange={(v) => setHw({ ...hw, allowFile: v })}
                />{" "}
                {t("act.allowFile")}
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={hw.required}
                  onCheckedChange={(v) => setHw({ ...hw, required: v })}
                />{" "}
                {t("act.required")}
              </label>
              <Input
                type="number"
                min={0}
                className="w-48"
                placeholder={t("act.maxScore")}
                value={hw.maxScore}
                onChange={(e) => setHw({ ...hw, maxScore: e.target.value })}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Quiz */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={qz.enabled} onCheckedChange={(v) => setQz({ ...qz, enabled: v })} />
          {t("act.enableQuiz")}
        </label>
        {qz.enabled ? (
          <div className="space-y-4 pl-2">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                {t("act.passingScore")}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-20"
                  value={qz.passingScore}
                  onChange={(e) => setQz({ ...qz, passingScore: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={qz.required}
                  onCheckedChange={(v) => setQz({ ...qz, required: v })}
                />{" "}
                {t("act.required")}
              </label>
            </div>
            {qz.questions.map((q, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={`${t("act.question")} ${i + 1}`}
                    value={q.question}
                    onChange={(e) => updateQ(i, { question: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setQz({ ...qz, questions: qz.questions.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${lessonId}-${i}`}
                      checked={o.isCorrect}
                      aria-label={t("act.correct")}
                      onChange={() =>
                        updateQ(i, {
                          options: q.options.map((x, m) => ({ ...x, isCorrect: m === k })),
                        })
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Input
                      placeholder={`${t("act.option")} ${k + 1}`}
                      value={o.text}
                      onChange={(e) =>
                        updateQ(i, {
                          options: q.options.map((x, m) =>
                            m === k ? { ...x, text: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => updateQ(i, { options: q.options.filter((_, m) => m !== k) })}
                      disabled={q.options.length <= 2}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateQ(i, { options: [...q.options, { text: "", isCorrect: false }] })
                  }
                >
                  <Plus className="size-4" /> {t("act.addOption")}
                </Button>
                <Input
                  placeholder={t("act.explanation")}
                  value={q.explanation}
                  onChange={(e) => updateQ(i, { explanation: e.target.value })}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQz({ ...qz, questions: [...qz.questions, blankQ()] })}
            >
              <Plus className="size-4" /> {t("act.addQuestion")}
            </Button>
          </div>
        ) : null}
      </div>

      <Button size="sm" variant="secondary" onClick={saveAll} disabled={busy}>
        {t("act.saveActivities")}
      </Button>
    </div>
  );
}
