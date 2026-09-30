import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { blockDanmakuUser, deleteDanmaku, listCourseDanmaku, setDanmakuHidden } from "@/lib/danmaku.functions";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function DanmakuModeration({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchList = useServerFn(listCourseDanmaku);
  const hide = useServerFn(setDanmakuHidden);
  const del = useServerFn(deleteDanmaku);
  const block = useServerFn(blockDanmakuUser);
  const { data, isLoading } = useQuery({ queryKey: ["danmaku-mod", courseId], queryFn: () => fetchList({ data: { courseId } }) });

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["danmaku-mod", courseId] });
      toast.success(t("builder.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (isLoading) return <p className="mt-6 text-muted-foreground">{t("common.loading")}</p>;
  const blockedUsers = [...new Map((data?.blocks ?? []).map((b) => [b.user_id, b])).values()];

  return (
    <div className="mt-6 space-y-6">
      {blockedUsers.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="title-card">{t("dm.blockedUsers")}</h3>
          <ul className="mt-3 space-y-2">
            {blockedUsers.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3 text-sm">
                <span>{b.userName}</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => run(() => block({ data: { courseId, userId: b.user_id, allCourses: false, block: false } }))}>
                  {t("dm.unblock")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-card">
        <h3 className="title-card border-b border-border p-5">{t("dm.moderation")}</h3>
        {!data || data.comments.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("dm.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.comments.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className={c.hidden ? "text-muted-foreground line-through" : ""}>{c.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.userName} · {c.lessonTitle} · {fmt(c.time_ms)}
                    {c.hidden ? <Badge variant="secondary" className="ml-2">{t("dm.hidden")}</Badge> : null}
                    {c.blocked ? <Badge variant="destructive" className="ml-2">{t("dm.blocked")}</Badge> : null}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(() => hide({ data: { id: c.id, hidden: !c.hidden } }))}>
                  {c.hidden ? t("dm.unhide") : t("dm.hide")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(() => del({ data: { id: c.id } }))}>
                  {t("dm.delete")}
                </Button>
                {!c.blocked ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => run(() => block({ data: { courseId, userId: c.user_id, allCourses: false, block: true } }))}>
                      {t("dm.block")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run(() => block({ data: { courseId, userId: c.user_id, allCourses: true, block: true } }))}>
                      {t("dm.blockAll")}
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
