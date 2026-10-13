import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import {
  createCourse,
  createMyOrg,
  getMyCourses,
  getMyOrg,
  updateMyOrg,
} from "@/lib/teach.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Org = NonNullable<Awaited<ReturnType<typeof getMyOrg>>>;

function OrgProfile({ org }: { org: Org }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const save = useServerFn(updateMyOrg);
  const [name, setName] = useState(org.name);
  const [headline, setHeadline] = useState(org.headline ?? "");
  const [about, setAbout] = useState(org.about ?? "");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const path = `${user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("course-media").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  }

  async function submit(extra: { logoPath?: string; coverPath?: string } = {}) {
    setBusy(true);
    try {
      await save({ data: { name, headline, about, ...extra } });
      await queryClient.invalidateQueries({ queryKey: ["my-org"] });
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const plan = org.plan;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <Label>{t("teach.orgName")}</Label>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>{t("teach.headline")}</Label>
          <Input className="mt-1" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <Label>{t("teach.about")}</Label>
          <Textarea
            rows={3}
            className="mt-1"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{t("teacher.logo")}</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await submit({ logoPath: await upload(f) });
              }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{t("teacher.cover")}</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await submit({ coverPath: await upload(f) });
              }}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => submit()} disabled={busy}>
            {t("builder.save")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/teachers/$slug" params={{ slug: org.slug }}>
              {org.name} ↗
            </Link>
          </Button>
        </div>
      </div>
      <div className="h-fit rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t("plan.title")}</p>
        <p className="title-panel mt-1">{plan.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${plan.price_kzt.toLocaleString("ru-RU")} ₸ ${t("plan.perMonth")}`} ·{" "}
          {t("plan.courses")}: {plan.max_courses ?? t("plan.unlimited")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("plan.students")}: {plan.max_students?.toLocaleString("ru-RU") ?? t("plan.unlimited")}
        </p>
        {plan.max_courses !== null ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("plan.upgradeSoon")}</p>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/teach/")({
  head: () => ({
    meta: [
      { title: "Teacher studio — Bilim" },
      {
        name: "description",
        content: "Create courses, build your curriculum and track your students on Bilim.",
      },
      { property: "og:title", content: "Teacher studio — Bilim" },
      { property: "og:description", content: "Create and manage your courses on Bilim." },
    ],
  }),
  component: TeachHome,
});

function TeachHome() {
  const { t } = useI18n();
  const fetchOrg = useServerFn(getMyOrg);
  const { data: org, isLoading } = useQuery({ queryKey: ["my-org"], queryFn: () => fetchOrg() });

  if (isLoading)
    return (
      <p className="mx-auto max-w-6xl px-4 py-12 text-muted-foreground">{t("common.loading")}</p>
    );
  if (!org) return <OrgSetup />;
  return (
    <>
      <CourseList orgName={org.name} />
      <OrgProfile org={org} />
    </>
  );
}

function OrgSetup() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const create = useServerFn(createMyOrg);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { name, headline, about } });
      await queryClient.invalidateQueries({ queryKey: ["my-org"] });
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="title-page">{t("teach.setupTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("teach.setupSub")}</p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <Label htmlFor="orgName">{t("teach.orgName")}</Label>
          <Input
            id="orgName"
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="headline">{t("teach.headline")}</Label>
          <Input
            id="headline"
            className="mt-1"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="about">{t("teach.about")}</Label>
          <Textarea
            id="about"
            rows={4}
            className="mt-1"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {t("teach.create")}
        </Button>
      </form>
    </div>
  );
}

function CourseList({ orgName }: { orgName: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchCourses = useServerFn(getMyCourses);
  const create = useServerFn(createCourse);
  const { data: result, isLoading } = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => fetchCourses(),
  });
  const data = result?.courses;
  const totalStudents = result?.totalStudents ?? 0;
  const [busy, setBusy] = useState(false);

  async function newCourse() {
    setBusy(true);
    try {
      const course = await create({ data: { title: t("teach.newCourse") } });
      await navigate({ to: "/teach/$courseId", params: { courseId: course.id } });
      await queryClient.invalidateQueries({ queryKey: ["my-courses"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("PLAN_LIMIT") ? t("plan.limitReached") : msg || t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="title-page">{t("teach.title")}</h1>
          <p className="mt-1 text-muted-foreground">{orgName}</p>
        </div>
        <Button variant="outline" className="ml-auto" asChild>
          <Link to="/teach/inbox">{t("act.inbox")}</Link>
        </Button>
        <Button onClick={newCourse} disabled={busy}>
          <Plus className="size-4" /> {t("teach.newCourse")}
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatBox label={t("teach.courses")} value={data?.length ?? 0} />
        <StatBox label={t("teach.totalStudents")} value={totalStudents} />
        <StatBox
          label={t("teach.published")}
          value={(data ?? []).filter((c) => c.status === "published").length}
        />
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">{t("common.loading")}</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {t("teach.noCourses")}
        </p>
      ) : (
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{t(`status.${c.status}` as keyof Dict)}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" /> {c.students}
                  </span>
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/teach/$courseId" params={{ courseId: c.id }}>
                  {t("teach.edit")}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
