import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { listDanmaku, postDanmaku } from "@/lib/danmaku.functions";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

type Dm = { id: string; time_ms: number; text: string; color: string; mode: string };
const COLORS = ["#ffffff", "#fde047", "#86efac", "#93c5fd", "#fca5a5", "#f0abfc"];
const LANES = 10;

export function DanmakuPlayer({
  src,
  lessonId,
  enabled,
  canPost,
  previewLimit,
  courseSlug,
}: {
  src: string;
  lessonId: string;
  enabled: boolean;
  canPost: boolean;
  previewLimit: number | null;
  courseSlug: string;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fetchList = useServerFn(listDanmaku);
  const post = useServerFn(postDanmaku);
  const [items, setItems] = useState<Dm[]>([]);
  const [show, setShow] = useState(true);
  const [opacity, setOpacity] = useState(90);
  const [density, setDensity] = useState(100);
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [locked, setLocked] = useState(false);
  const shown = useRef(new Set<string>());
  const lastT = useRef(0);
  const laneFree = useRef<number[]>(Array(LANES).fill(0));

  useEffect(() => {
    shown.current.clear();
    setLocked(false);
    if (!enabled) return setItems([]);
    let active = true;
    fetchList({ data: { lessonId } })
      .then((r) => active && setItems(r))
      .catch(() => {});
    const ch = supabase
      .channel(`dm-${lessonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "danmaku", filter: `lesson_id=eq.${lessonId}` },
        (p) => {
          const row = p.new as Dm & { hidden: boolean };
          if (!row.hidden)
            setItems((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch);
    };
  }, [lessonId, enabled, fetchList]);

  function spawn(d: Dm, stage: HTMLDivElement) {
    const el = document.createElement("div");
    el.textContent = d.text;
    el.style.cssText = `position:absolute;white-space:nowrap;font-weight:600;font-size:clamp(14px,2vw,20px);color:${d.color};text-shadow:0 0 2px #000,0 0 2px #000;pointer-events:none;`;
    const now = performance.now();
    if (d.mode === "top" || d.mode === "bottom") {
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
      el.style[d.mode === "top" ? "top" : "bottom"] = "8%";
      stage.appendChild(el);
      setTimeout(() => el.remove(), 4000);
      return;
    }
    let lane = laneFree.current.findIndex((f) => f <= now);
    if (lane < 0) lane = Math.floor(Math.random() * LANES);
    laneFree.current[lane] = now + 2500;
    el.style.top = `${(lane / LANES) * 85 + 2}%`;
    el.style.left = "100%";
    stage.appendChild(el);
    const dist = stage.clientWidth + el.clientWidth;
    el.animate([{ transform: "translateX(0)" }, { transform: `translateX(-${dist}px)` }], {
      duration: 8000,
      easing: "linear",
    }).onfinish = () => el.remove();
  }

  function onTime() {
    const v = videoRef.current;
    const stage = stageRef.current;
    if (!v) return;
    if (previewLimit && v.currentTime >= previewLimit) {
      v.pause();
      v.currentTime = previewLimit;
      setLocked(true);
      return;
    }
    const ms = v.currentTime * 1000;
    if (Math.abs(ms - lastT.current) > 2000) shown.current.clear(); // seek
    if (stage && show && !v.paused) {
      for (const d of items) {
        if (d.time_ms > lastT.current && d.time_ms <= ms && !shown.current.has(d.id)) {
          shown.current.add(d.id);
          if (Math.random() * 100 < density) spawn(d, stage);
        }
      }
    }
    lastT.current = ms;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const v = videoRef.current;
    if (!text.trim() || !v) return;
    try {
      const row = await post({ data: { lessonId, timeMs: v.currentTime * 1000, text, color } });
      setText("");
      shown.current.add(row.id);
      setItems((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
      if (stageRef.current && show) spawn(row, stageRef.current);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      const key = `dm.${code}` as keyof Dict;
      toast.error(code.startsWith("DANMAKU_") ? t(key) : code || t("common.error"));
    }
  }

  return (
    <div className="mt-5">
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <video
          ref={videoRef}
          src={src}
          controls={!locked}
          controlsList="nodownload"
          onTimeUpdate={onTime}
          onSeeking={() => {
            const v = videoRef.current;
            if (v && previewLimit && v.currentTime > previewLimit) v.currentTime = previewLimit;
          }}
          className="aspect-video w-full"
        />
        <div
          ref={stageRef}
          className="pointer-events-none absolute inset-0 bottom-12"
          style={{ opacity: show ? opacity / 100 : 0 }}
        />
        {previewLimit && !locked ? (
          <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground">
            {t("preview.badge")} · {Math.round(previewLimit / 60)} {t("preview.minutes")}
          </span>
        ) : null}
        {locked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground/85 p-6 text-center text-background">
            <Lock className="size-8" />
            <p className="text-xl font-semibold">{t("preview.title")}</p>
            <p className="max-w-sm text-sm opacity-80">{t("preview.body")}</p>
            <Button asChild>
              <Link to="/courses/$slug" params={{ slug: courseSlug }}>
                {t("preview.subscribe")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {enabled ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={show} onCheckedChange={setShow} />
            <MessageSquare className="size-4" /> {t("dm.toggle")}
          </label>
          <label className="flex w-36 items-center gap-2 text-xs text-muted-foreground">
            {t("dm.opacity")}
            <Slider
              value={[opacity]}
              min={20}
              max={100}
              step={5}
              onValueChange={(v) => setOpacity(v[0] ?? 90)}
            />
          </label>
          <label className="flex w-36 items-center gap-2 text-xs text-muted-foreground">
            {t("dm.density")}
            <Slider
              value={[density]}
              min={10}
              max={100}
              step={10}
              onValueChange={(v) => setDensity(v[0] ?? 100)}
            />
          </label>
          {canPost ? (
            <form onSubmit={send} className="flex min-w-[260px] flex-1 items-center gap-2">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`size-5 rounded-full border ${color === c ? "ring-2 ring-primary ring-offset-1" : "border-border"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <Input
                value={text}
                maxLength={100}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("dm.placeholder")}
                className="h-9"
              />
              <Button type="submit" size="sm">
                {t("dm.send")}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">{t("dm.subscribeToPost")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
