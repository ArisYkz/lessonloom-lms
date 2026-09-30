import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedClient = { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown }> };

async function assertAdmin(supabase: unknown, userId: string) {
  const { data } = await (supabase as AuthedClient).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("courses")
      .select("id, slug, title, short_description, status, language, level, price_model, price_kzt, updated_at, organizations(name, slug)")
      .in("status", ["pending_review", "published", "rejected"])
      .order("updated_at", { ascending: false });
    return (data ?? []).map((c) => ({
      ...c,
      teacherName: (c.organizations as unknown as { name: string } | null)?.name ?? "",
    }));
  });

export const reviewCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; decision: "approve" | "reject" | "unpublish"; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch =
      data.decision === "approve"
        ? { status: "published" as const, published_at: new Date().toISOString(), rejection_reason: null }
        : data.decision === "reject"
          ? { status: "rejected" as const, rejection_reason: data.reason ?? "" }
          : { status: "draft" as const };

    const { error } = await supabaseAdmin.from("courses").update(patch).eq("id", data.courseId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: `course.${data.decision}`,
      target_type: "course",
      target_id: data.courseId,
      detail: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, suspended, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emails = new Map(authUsers.users.map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      email: emails.get(p.id) ?? "",
      suspended: p.suspended,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "student" | "teacher" | "admin"; grant: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: data.role },
        { onConflict: "user_id,role" },
      );
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; suspended: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ suspended: data.suspended }).eq("id", data.userId);
    return { ok: true };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; slug: string; nameEn: string; nameRu: string; nameKk: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = { slug: data.slug, name_en: data.nameEn, name_ru: data.nameRu, name_kk: data.nameKk };
    const { error } = data.id
      ? await context.supabase.from("categories").update(row).eq("id", data.id)
      : await context.supabase.from("categories").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeacherPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orgs }, { data: subs }, { data: plans }] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, name, slug, owner_id").order("created_at", { ascending: false }),
      supabaseAdmin.from("org_subscriptions").select("organization_id, plan_code, status"),
      supabaseAdmin.from("teacher_plans").select("code, name, price_kzt, max_courses").order("position"),
    ]);
    return {
      plans: plans ?? [],
      orgs: (orgs ?? []).map((o) => {
        const s = (subs ?? []).find((x) => x.organization_id === o.id);
        return { id: o.id, name: o.name, slug: o.slug, planCode: s && s.status === "ACTIVE" ? s.plan_code : "starter" };
      }),
    };
  });

export const setTeacherPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; planCode: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("org_subscriptions").upsert(
      { organization_id: data.organizationId, plan_code: data.planCode, status: "ACTIVE", provider: "manual", updated_at: new Date().toISOString() },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "teacher_plan.set",
      target_type: "organization",
      target_id: data.organizationId,
      detail: { plan: data.planCode },
    });
    return { ok: true };
  });
