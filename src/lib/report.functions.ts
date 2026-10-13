import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ReportTarget = "course" | "teacher" | "lesson";
type ReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      targetType: ReportTarget;
      targetId: string;
      reason: string;
      description?: string;
    }) => {
      if (!input.reason?.trim()) throw new Error("Reason is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", context.userId)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 10) throw new Error("Too many reports. Please try again later.");
    const { error } = await context.supabase.from("reports").insert({
      reporter_id: context.userId,
      target_type: data.targetType,
      target_id: data.targetId,
      reason: data.reason.trim(),
      description: data.description?.trim() ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select(
        "id, target_type, target_id, reason, description, status, admin_note, created_at, resolved_at, profiles!reports_reporter_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Resolve target titles for display
    const courseIds = [
      ...new Set((data ?? []).filter((r) => r.target_type === "course").map((r) => r.target_id)),
    ];
    const orgIds = [
      ...new Set((data ?? []).filter((r) => r.target_type === "teacher").map((r) => r.target_id)),
    ];
    const lessonIds = [
      ...new Set((data ?? []).filter((r) => r.target_type === "lesson").map((r) => r.target_id)),
    ];
    const [courses, orgs, lessons] = await Promise.all([
      courseIds.length
        ? supabaseAdmin.from("courses").select("id, title").in("id", courseIds)
        : { data: [] },
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
        : { data: [] },
      lessonIds.length
        ? supabaseAdmin.from("lessons").select("id, title").in("id", lessonIds)
        : { data: [] },
    ]);
    const titles = new Map<string, string>();
    for (const c of courses.data ?? []) titles.set(c.id, c.title);
    for (const o of orgs.data ?? []) titles.set(o.id, o.name);
    for (const l of lessons.data ?? []) titles.set(l.id, l.title);
    return (data ?? []).map((r) => ({
      id: r.id,
      targetType: r.target_type as ReportTarget,
      targetId: r.target_id,
      targetTitle: titles.get(r.target_id) ?? "",
      reason: r.reason,
      description: r.description,
      status: r.status as ReportStatus,
      adminNote: r.admin_note,
      createdAt: r.created_at,
      reporterName: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
    }));
  });

export const updateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: ReportStatus; adminNote?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reports")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        resolved_at:
          data.status === "RESOLVED" || data.status === "DISMISSED"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: `report.${data.status.toLowerCase()}`,
      target_type: "report",
      target_id: data.id,
      detail: { admin_note: data.adminNote ?? null },
    });
    return { ok: true };
  });
