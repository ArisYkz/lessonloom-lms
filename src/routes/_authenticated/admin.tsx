import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteCategory,
  getReviewQueue,
  listUsers,
  reviewCourse,
  saveCategory,
  setUserRole,
  setUserSuspended,
} from "@/lib/admin.functions";
import { listReports, updateReport } from "@/lib/report.functions";
import { listTeacherPlans, setTeacherPlan } from "@/lib/admin.functions";
import { getMyRoles } from "@/lib/learn.functions";
import { listCategories } from "@/lib/catalog.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Bilim" },
      { name: "description", content: "Review submitted courses, manage users and categories." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — Bilim" },
      { property: "og:description", content: "Platform administration." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const fetchRoles = useServerFn(getMyRoles);
  const { data: roles, isLoading } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });

  if (isLoading) return <p className="p-12 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!roles?.includes("admin")) {
    return <p className="p-20 text-center text-muted-foreground">{t("admin.notAdmin")}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-page">{t("admin.title")}</h1>
      <Tabs defaultValue="review" className="mt-8">
        <TabsList>
          <TabsTrigger value="review">{t("admin.review")}</TabsTrigger>
          <TabsTrigger value="reports">{t("admin.tabs.reports")}</TabsTrigger>
          <TabsTrigger value="users">{t("admin.users")}</TabsTrigger>
          <TabsTrigger value="categories">{t("admin.categories")}</TabsTrigger>
          <TabsTrigger value="plans">{t("admin.tabs.plans")}</TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          <ReviewTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchReports = useServerFn(listReports);
  const update = useServerFn(updateReport);
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports"], queryFn: () => fetchReports() });
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function act(id: string, status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED") {
    try {
      await update({ data: { id, status, adminNote: notes[id] ?? "" } });
      await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("OK");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (isLoading) return <p className="mt-6 text-muted-foreground">{t("common.loading")}</p>;
  if (!data || data.length === 0) return <p className="mt-6 text-muted-foreground">{t("admin.reports.empty")}</p>;

  return (
    <div className="mt-6 space-y-4">
      {data.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t(`report.status.${r.status}` as keyof Dict)}</Badge>
            <Badge variant="outline">{r.targetType}</Badge>
            <span className="text-sm font-medium">{r.targetTitle || r.targetId}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{r.reason}</p>
          {r.description ? <p className="mt-1 text-sm text-muted-foreground">{r.description}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.reports.reporter")}: {r.reporterName || "—"}
          </p>
          {r.status === "OPEN" || r.status === "UNDER_REVIEW" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-64"
                placeholder={t("admin.reports.note")}
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              />
              {r.status === "OPEN" ? (
                <Button size="sm" variant="outline" onClick={() => act(r.id, "UNDER_REVIEW")}>
                  {t("admin.reports.underReview")}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => act(r.id, "RESOLVED")}>
                {t("admin.reports.resolve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(r.id, "DISMISSED")}>
                {t("admin.reports.dismiss")}
              </Button>
            </div>
          ) : r.adminNote ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("admin.reports.note")}: {r.adminNote}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(getReviewQueue);
  const decide = useServerFn(reviewCourse);
  const { data } = useQuery({ queryKey: ["review-queue"], queryFn: () => fetchQueue() });
  const [reason, setReason] = useState<Record<string, string>>({});

  async function act(courseId: string, decision: "approve" | "reject" | "unpublish") {
    try {
      await decide({ data: { courseId, decision, reason: reason[courseId] ?? "" } });
      await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      toast.success("OK");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const pending = (data ?? []).filter((c) => c.status === "pending_review");
  const rest = (data ?? []).filter((c) => c.status !== "pending_review");

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="title-panel">{t("admin.review")}</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-muted-foreground">{t("admin.queueEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {pending.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  {c.teacherName} · {c.short_description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => act(c.id, "approve")}>
                    {t("admin.approve")}
                  </Button>
                  <Input
                    className="h-9 w-64"
                    placeholder={t("admin.rejectReason")}
                    value={reason[c.id] ?? ""}
                    onChange={(e) => setReason((r) => ({ ...r, [c.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="destructive" onClick={() => act(c.id, "reject")}>
                    {t("admin.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="title-panel">{t("teach.courses")}</h2>
        <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
          {rest.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.teacherName}</p>
              </div>
              <Badge variant="secondary">{t(`status.${c.status}` as keyof Dict)}</Badge>
              {c.status === "published" ? (
                <Button size="sm" variant="outline" onClick={() => act(c.id, "unpublish")}>
                  {t("builder.unpublish")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UsersTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const setSuspended = useServerFn(setUserSuspended);
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
      {(data ?? []).map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{u.name || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
          {!u.roles.includes("teacher") ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => setRole({ data: { userId: u.id, role: "teacher", grant: true } }))}
            >
              {t("admin.makeTeacher")}
            </Button>
          ) : null}
          {!u.roles.includes("admin") ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => setRole({ data: { userId: u.id, role: "admin", grant: true } }))}
            >
              {t("admin.makeAdmin")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={u.suspended ? "secondary" : "destructive"}
            onClick={() => run(() => setSuspended({ data: { userId: u.id, suspended: !u.suspended } }))}
          >
            {u.suspended ? t("admin.unsuspend") : t("admin.suspend")}
          </Button>
        </div>
      ))}
    </div>
  );
}

function CategoriesTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchCats = useServerFn(listCategories);
  const save = useServerFn(saveCategory);
  const remove = useServerFn(deleteCategory);
  const { data } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });
  const [form, setForm] = useState({ slug: "", nameEn: "", nameRu: "", nameKk: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({ data: form });
      setForm({ slug: "", nameEn: "", nameRu: "", nameKk: "" });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={add} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-5">
        <Input
          placeholder={t("admin.slug")}
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
        />
        <Input
          placeholder="EN"
          value={form.nameEn}
          onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          required
        />
        <Input
          placeholder="RU"
          value={form.nameRu}
          onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
          required
        />
        <Input
          placeholder="KK"
          value={form.nameKk}
          onChange={(e) => setForm({ ...form, nameKk: e.target.value })}
          required
        />
        <Button type="submit">{t("admin.addCategory")}</Button>
      </form>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {(data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name_ru}</p>
              <p className="text-xs text-muted-foreground">{c.slug}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await remove({ data: { id: c.id } });
                await queryClient.invalidateQueries({ queryKey: ["categories"] });
              }}
            >
              {t("builder.delete")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listTeacherPlans);
  const setPlan = useServerFn(setTeacherPlan);
  const { data } = useQuery({ queryKey: ["admin-plans"], queryFn: () => fetchPlans() });
  if (!data) return <p className="mt-6 text-muted-foreground">{t("common.loading")}</p>;
  return (
    <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
      {data.orgs.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 font-medium">{o.name}</p>
          {data.plans.map((p) => (
            <Button
              key={p.code}
              size="sm"
              variant={o.planCode === p.code ? "default" : "outline"}
              onClick={async () => {
                try {
                  await setPlan({ data: { organizationId: o.id, planCode: p.code } });
                  await qc.invalidateQueries({ queryKey: ["admin-plans"] });
                  toast.success(t("builder.saved"));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t("common.error"));
                }
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
