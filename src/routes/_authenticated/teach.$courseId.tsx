import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users } from "lucide-react";
import {
  deleteLesson,
  deleteSection,
  getCourseForEdit,
  getCourseStudents,
  saveLesson,
  saveSection,
  setCourseStatus,
  updateCourse,
} from "@/lib/teach.functions";
import { listCategories } from "@/lib/catalog.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LessonExtrasEditor } from "@/components/lesson-extras-editor";

export const Route = createFileRoute("/_authenticated/teach/$courseId")({
  head: () => ({
    meta: [
      { title: "Course builder — Bilim" },
      { name: "description", content: "Edit course details, curriculum, pricing and publishing." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Course builder — Bilim" },
      { property: "og:description", content: "Edit your course on Bilim." },
    ],
  }),
  component: Builder,
});

type LessonRow = {
  id: string;
  title: string;
  type: "video" | "text" | "file";
  body: string | null;
  media_path: string | null;
  duration_minutes: number;
  is_preview: boolean;
};

function Builder() {
  const { courseId } = Route.useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchCourse = useServerFn(getCourseForEdit);
  const { data, isLoading } = useQuery({
    queryKey: ["course-edit", courseId],
    queryFn: () => fetchCourse({ data: { courseId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["course-edit", courseId] });

  if (isLoading) return <p className="p-12 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <p className="p-12 text-center text-muted-foreground">{t("course.notFound")}</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/teach" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← {t("teach.title")}
        </Link>
        <Badge variant="secondary" className="ml-auto">
          {t(`status.${data.course.status}` as keyof Dict)}
        </Badge>
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[2.25rem]">{data.course.title}</h1>
      {data.course.status === "rejected" && data.course.rejection_reason ? (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">{t("teach.rejectedTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("teach.rejectedReason")}</p>
          <p className="mt-1 text-foreground">{data.course.rejection_reason}</p>
        </div>
      ) : null}

      <Tabs defaultValue="basics" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="basics">{t("builder.basics")}</TabsTrigger>
          <TabsTrigger value="curriculum">{t("builder.curriculum")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("builder.pricing")}</TabsTrigger>
          <TabsTrigger value="publish">{t("builder.publish")}</TabsTrigger>
          <TabsTrigger value="students">{t("teach.students")}</TabsTrigger>
        </TabsList>

        <TabsContent value="basics">
          <BasicsTab course={data.course} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="curriculum">
          <CurriculumTab courseId={courseId} sections={data.sections} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingTab course={data.course} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="publish">
          <PublishTab course={data.course} lessonCount={data.sections.reduce((n, s) => n + s.lessons.length, 0)} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="students">
          <StudentsTab courseId={courseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    if (!user) throw new Error("Not signed in");
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("course-media").upload(path, file);
      if (error) throw new Error(error.message);
      return path;
    } finally {
      setUploading(false);
    }
  }
  return { upload, uploading };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function BasicsTab({ course, onSaved }: { course: any; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const save = useServerFn(updateCourse);
  const fetchCats = useServerFn(listCategories);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });
  const { upload, uploading } = useUpload();

  const [form, setForm] = useState({
    title: course.title as string,
    short_description: course.short_description as string,
    description: course.description as string,
    category_id: (course.category_id as string | null) ?? "",
    level: course.level as string,
    language: course.language as string,
    estimated_minutes: course.estimated_minutes as number,
    thumbnail_url: (course.thumbnail_url as string | null) ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          courseId: course.id,
          patch: {
            ...form,
            category_id: form.category_id || null,
            estimated_minutes: Number(form.estimated_minutes) || 0,
            thumbnail_url: form.thumbnail_url || null,
          },
        },
      });
      onSaved();
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
      <div>
        <Label>{t("builder.title")}</Label>
        <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <Label>{t("builder.short")}</Label>
        <Input
          className="mt-1"
          value={form.short_description}
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
        />
      </div>
      <div>
        <Label>{t("builder.description")}</Label>
        <Textarea
          className="mt-1"
          rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>{t("builder.category")}</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {locale === "kk" ? c.name_kk : locale === "en" ? c.name_en : c.name_ru}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("builder.level")}</Label>
          <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">{t("level.beginner")}</SelectItem>
              <SelectItem value="intermediate">{t("level.intermediate")}</SelectItem>
              <SelectItem value="advanced">{t("level.advanced")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("builder.language")}</Label>
          <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kk">{t("lang.kk")}</SelectItem>
              <SelectItem value="ru">{t("lang.ru")}</SelectItem>
              <SelectItem value="en">{t("lang.en")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("builder.duration")}</Label>
          <Input
            type="number"
            min={0}
            className="mt-1"
            value={form.estimated_minutes}
            onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>{t("builder.thumbnail")}</Label>
          <div className="mt-1 flex items-center gap-3">
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const path = await upload(file);
                  setForm((f) => ({ ...f, thumbnail_url: path }));
                  toast.success(t("builder.uploaded"));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t("common.error"));
                }
              }}
            />
            {uploading ? <span className="text-xs text-muted-foreground">{t("builder.uploading")}</span> : null}
          </div>
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {t("builder.save")}
      </Button>
    </form>
  );
}

function CurriculumTab({
  courseId,
  sections,
  onChanged,
}: {
  courseId: string;
  sections: { id: string; title: string; lessons: LessonRow[] }[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const addSection = useServerFn(saveSection);
  const removeSection = useServerFn(deleteSection);
  const [newTitle, setNewTitle] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addSection({ data: { courseId, title: newTitle.trim() } });
    setNewTitle("");
    onChanged();
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder={t("builder.sectionTitle")} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <Button type="submit">
          <Plus className="size-4" /> {t("builder.addSection")}
        </Button>
      </form>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {t("builder.noLessons")}
        </p>
      ) : null}

      {sections.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <SectionTitle id={s.id} courseId={courseId} title={s.title} onChanged={onChanged} />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await removeSection({ data: { id: s.id } });
                onChanged();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {s.lessons.map((l) => (
              <LessonEditor key={l.id} courseId={courseId} sectionId={s.id} lesson={l} onChanged={onChanged} />
            ))}
            <LessonEditor courseId={courseId} sectionId={s.id} onChanged={onChanged} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({
  id,
  courseId,
  title,
  onChanged,
}: {
  id: string;
  courseId: string;
  title: string;
  onChanged: () => void;
}) {
  const save = useServerFn(saveSection);
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  return (
    <Input
      className="font-medium"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={async () => {
        if (value !== title) {
          await save({ data: { id, courseId, title: value } });
          onChanged();
        }
      }}
    />
  );
}

function LessonEditor({
  courseId,
  sectionId,
  lesson,
  onChanged,
}: {
  courseId: string;
  sectionId: string;
  lesson?: LessonRow;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const save = useServerFn(saveLesson);
  const remove = useServerFn(deleteLesson);
  const { upload, uploading } = useUpload();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    type: (lesson?.type ?? "video") as "video" | "text" | "file",
    body: lesson?.body ?? "",
    mediaPath: lesson?.media_path ?? "",
    durationMinutes: lesson?.duration_minutes ?? 0,
    isPreview: lesson?.is_preview ?? false,
  });
  const [busy, setBusy] = useState(false);

  if (!lesson && !open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {t("builder.addLesson")}
      </Button>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          ...(lesson ? { id: lesson.id } : {}),
          courseId,
          sectionId,
          title: form.title || t("builder.lessonTitle"),
          type: form.type,
          body: form.body,
          mediaPath: form.mediaPath || null,
          durationMinutes: Number(form.durationMinutes) || 0,
          isPreview: form.isPreview,
        },
      });
      if (!lesson) {
        setForm({ title: "", type: "video", body: "", mediaPath: "", durationMinutes: 0, isPreview: false });
        setOpen(false);
      }
      onChanged();
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]">
        <Input
          placeholder={t("builder.lessonTitle")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">{t("lessonType.video")}</SelectItem>
            <SelectItem value="text">{t("lessonType.text")}</SelectItem>
            <SelectItem value="file">{t("lessonType.file")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
        />
      </div>

      <Textarea
        rows={form.type === "text" ? 8 : 4}
        placeholder={t("builder.lessonBody")}
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
      />
      {form.type === "text" ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept={form.type === "video" ? "video/*" : undefined}
            className="max-w-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const path = await upload(file);
                setForm((f) => ({ ...f, mediaPath: path }));
                toast.success(t("builder.uploaded"));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t("common.error"));
              }
            }}
          />
          {uploading ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Upload className="size-3" /> {t("builder.uploading")}
            </span>
          ) : form.mediaPath ? (
            <Badge variant="secondary">{t("builder.uploaded")}</Badge>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={form.isPreview} onCheckedChange={(v) => setForm({ ...form, isPreview: v })} />
          {t("course.preview")}
        </label>
        <div className="ml-auto flex gap-2">
          {lesson ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await remove({ data: { id: lesson.id } });
                onChanged();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={busy}>
            {t("builder.save")}
          </Button>
        </div>
      </div>
      {lesson ? <LessonExtrasEditor lessonId={lesson.id} /> : null}
    </div>
  );
}

function PricingTab({ course, onSaved }: { course: any; onSaved: () => void }) {
  const { t } = useI18n();
  const save = useServerFn(updateCourse);
  const [priceModel, setPriceModel] = useState<string>(course.price_model);
  const [priceKzt, setPriceKzt] = useState<number>(course.price_kzt);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          courseId: course.id,
          patch: { price_model: priceModel, price_kzt: priceModel === "free" ? 0 : Number(priceKzt) || 0 },
        },
      });
      onSaved();
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPriceModel("free")}
          className={`rounded-xl border p-4 text-left ${priceModel === "free" ? "border-primary bg-accent" : "border-border"}`}
        >
          <p className="font-medium">{t("builder.freeCourse")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("price.free")}</p>
        </button>
        <button
          type="button"
          onClick={() => setPriceModel("subscription")}
          className={`rounded-xl border p-4 text-left ${priceModel === "subscription" ? "border-primary bg-accent" : "border-border"}`}
        >
          <p className="font-medium">{t("builder.subscriptionCourse")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("price.subscription")}</p>
        </button>
      </div>

      {priceModel === "subscription" ? (
        <div>
          <Label>{t("builder.priceKzt")}</Label>
          <Input
            type="number"
            min={0}
            className="mt-1 max-w-xs"
            value={priceKzt}
            onChange={(e) => setPriceKzt(Number(e.target.value))}
          />
          <p className="mt-2 text-sm text-muted-foreground">{t("builder.paymentsNote")}</p>
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy}>
        {t("builder.save")}
      </Button>
    </div>
  );
}

function PublishTab({
  course,
  lessonCount,
  onSaved,
}: {
  course: any;
  lessonCount: number;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setStatus = useServerFn(setCourseStatus);
  const [busy, setBusy] = useState(false);

  const ready = course.title && course.short_description && lessonCount > 0;

  async function submit(status: "draft" | "pending_review") {
    setBusy(true);
    try {
      await setStatus({ data: { courseId: course.id, status } });
      onSaved();
      toast.success(status === "pending_review" ? t("builder.submitted") : t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{t("builder.publishNote")}</p>
      <ul className="space-y-1 text-sm">
        <li>{course.title ? "✓" : "•"} {t("builder.title")}</li>
        <li>{course.short_description ? "✓" : "•"} {t("builder.short")}</li>
        <li>
          {lessonCount > 0 ? "✓" : "•"} {lessonCount} {t("course.lessons")}
        </li>
      </ul>

      <div className="flex flex-wrap gap-3">
        {course.status === "published" ? (
          <Button variant="outline" onClick={() => navigate({ to: "/courses/$slug", params: { slug: course.slug } })}>
            {t("builder.preview")}
          </Button>
        ) : (
          <Button disabled={!ready || busy || course.status === "pending_review"} onClick={() => submit("pending_review")}>
            {course.status === "pending_review" ? t("builder.submitted") : t("builder.submit")}
          </Button>
        )}
        {course.status === "pending_review" ? (
          <Button variant="outline" disabled={busy} onClick={() => submit("draft")}>
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StudentsTab({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const fetchStudents = useServerFn(getCourseStudents);
  const { data } = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => fetchStudents({ data: { courseId } }),
  });

  if (!data || data.students.length === 0) {
    return <p className="mt-6 text-muted-foreground">{t("teach.noStudents")}</p>;
  }

  return (
    <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
      {data.students.map((s, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Users className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate">{s.name}</span>
          {s.homeworkPending > 0 ? (
            <Badge variant="secondary">
              {s.homeworkPending} {t("act.pendingHw")}
            </Badge>
          ) : null}
          {s.quizAverage !== null ? (
            <span className="text-sm text-muted-foreground">
              {t("act.quizAvg")}: {s.quizAverage}%
            </span>
          ) : null}
          <span className="w-12 text-right text-sm text-muted-foreground">{s.percent}%</span>
        </div>
      ))}
    </div>
  );
}
