// Student-side learning activities: resources, homework, quizzes, discussion.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clean = (s: string, max: number) => s.trim().slice(0, max);

export const getLessonActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, signMany } = await import("./media.server");
    const { lessonCourse, assertAccess, isEditor, namesFor } = await import("./engine.server");
    const lc = await lessonCourse(data.lessonId);
    await assertAccess(context.supabase, lc.courseId, context.userId);
    const editor = await isEditor(context.supabase, lc.courseId);

    const { data: resources } = await supabaseAdmin
      .from("lesson_resources")
      .select("id, title, media_path")
      .eq("lesson_id", lc.lessonId)
      .order("position");
    const resUrls = await signMany((resources ?? []).map((r) => r.media_path), 60 * 60 * 4);

    const { data: hw } = await supabaseAdmin
      .from("homework")
      .select("id, instructions, allow_text, allow_file, required, max_score")
      .eq("lesson_id", lc.lessonId)
      .maybeSingle();
    let submission = null;
    if (hw) {
      const { data: sub } = await supabaseAdmin
        .from("homework_submissions")
        .select("id, body, file_paths, status, score, feedback, submitted_at, reviewed_at")
        .eq("homework_id", hw.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (sub) {
        const files = await Promise.all(
          sub.file_paths.map(async (p) => ({ name: p.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, ""), url: await signPath(p, 3600) })),
        );
        submission = { ...sub, files };
      }
    }

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("id, passing_score, required")
      .eq("lesson_id", lc.lessonId)
      .maybeSingle();
    let quizOut = null;
    if (quiz) {
      const { data: qs } = await supabaseAdmin
        .from("quiz_questions")
        .select("id, question, position")
        .eq("quiz_id", quiz.id)
        .order("position");
      const { data: opts } = await supabaseAdmin
        .from("quiz_options")
        .select("id, question_id, text, position")
        .in("question_id", (qs ?? []).map((q) => q.id).concat("00000000-0000-0000-0000-000000000000"))
        .order("position");
      const { data: attempts } = await supabaseAdmin
        .from("quiz_attempts")
        .select("score, total, passed, created_at")
        .eq("quiz_id", quiz.id)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1);
      quizOut = {
        id: quiz.id,
        passingScore: quiz.passing_score,
        required: quiz.required,
        questions: (qs ?? []).map((q) => ({
          id: q.id,
          question: q.question,
          options: (opts ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, text: o.text })),
        })),
        lastAttempt: attempts?.[0] ?? null,
      };
    }

    let threads: {
      id: string; body: string; author: string; mine: boolean; hidden: boolean; createdAt: string;
      replies: { id: string; body: string; author: string; hidden: boolean; isTeacher: boolean; createdAt: string }[];
    }[] = [];
    if (lc.discussionEnabled) {
      let tq = supabaseAdmin
        .from("discussion_threads")
        .select("id, user_id, body, hidden, created_at")
        .eq("lesson_id", lc.lessonId)
        .order("created_at", { ascending: false });
      if (!editor) tq = tq.eq("hidden", false);
      const { data: ts } = await tq;
      const ids = (ts ?? []).map((x) => x.id);
      let rq = supabaseAdmin
        .from("discussion_replies")
        .select("id, thread_id, user_id, body, hidden, created_at")
        .in("thread_id", ids.concat("00000000-0000-0000-0000-000000000000"))
        .order("created_at");
      if (!editor) rq = rq.eq("hidden", false);
      const { data: rs } = await rq;
      const names = await namesFor([...(ts ?? []).map((x) => x.user_id), ...(rs ?? []).map((x) => x.user_id)]);
      threads = (ts ?? []).map((x) => ({
        id: x.id,
        body: x.body,
        author: names.get(x.user_id) ?? "—",
        mine: x.user_id === context.userId,
        hidden: x.hidden,
        createdAt: x.created_at,
        replies: (rs ?? [])
          .filter((r) => r.thread_id === x.id)
          .map((r) => ({
            id: r.id,
            body: r.body,
            author: names.get(r.user_id) ?? "—",
            hidden: r.hidden,
            isTeacher: r.user_id === lc.ownerId,
            createdAt: r.created_at,
          })),
      }));
    }

    return {
      isEditor: editor,
      resources: (resources ?? []).map((r) => ({ id: r.id, title: r.title, url: resUrls.get(r.media_path) ?? null })),
      homework: hw ? { ...hw, submission } : null,
      quiz: quizOut,
      discussionEnabled: lc.discussionEnabled,
      threads,
    };
  });

export const submitHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; body: string; filePaths: string[] }) => ({
    lessonId: input.lessonId,
    body: clean(input.body ?? "", 20000),
    filePaths: (input.filePaths ?? []).slice(0, 5),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lessonCourse, assertAccess, notify, namesFor } = await import("./engine.server");
    const lc = await lessonCourse(data.lessonId);
    await assertAccess(context.supabase, lc.courseId, context.userId);
    if (data.filePaths.some((p) => !p.startsWith(`${context.userId}/submissions/`))) throw new Error("Invalid file");
    const { data: hw } = await supabaseAdmin.from("homework").select("id").eq("lesson_id", lc.lessonId).maybeSingle();
    if (!hw) throw new Error("No homework for this lesson");
    if (!data.body && data.filePaths.length === 0) throw new Error("Empty submission");

    const { data: existing } = await supabaseAdmin
      .from("homework_submissions")
      .select("id, status")
      .eq("homework_id", hw.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.status === "reviewed") throw new Error("Already reviewed");
    const row = {
      homework_id: hw.id,
      lesson_id: lc.lessonId,
      course_id: lc.courseId,
      user_id: context.userId,
      body: data.body,
      file_paths: data.filePaths,
      status: "submitted" as const,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("homework_submissions").upsert(row, { onConflict: "homework_id,user_id" });
    if (error) throw new Error(error.message);
    const names = await namesFor([context.userId]);
    await notify(lc.ownerId, "homework_submitted", `${names.get(context.userId)} · ${lc.title}`, "/teach/inbox");
    return { ok: true };
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; answers: Record<string, string> }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lessonCourse, assertAccess } = await import("./engine.server");
    const lc = await lessonCourse(data.lessonId);
    await assertAccess(context.supabase, lc.courseId, context.userId);
    const { data: quiz } = await supabaseAdmin.from("quizzes").select("id, passing_score").eq("lesson_id", lc.lessonId).maybeSingle();
    if (!quiz) throw new Error("No quiz");
    const { data: qs } = await supabaseAdmin.from("quiz_questions").select("id, explanation").eq("quiz_id", quiz.id);
    const { data: opts } = await supabaseAdmin
      .from("quiz_options")
      .select("id, question_id, is_correct")
      .in("question_id", (qs ?? []).map((q) => q.id).concat("00000000-0000-0000-0000-000000000000"));
    const results = (qs ?? []).map((q) => {
      const correct = (opts ?? []).find((o) => o.question_id === q.id && o.is_correct)?.id ?? null;
      const chosen = data.answers[q.id] ?? null;
      return { questionId: q.id, correctOptionId: correct, chosen, isCorrect: !!correct && chosen === correct, explanation: q.explanation };
    });
    const total = results.length;
    const score = results.filter((r) => r.isCorrect).length;
    const passed = total > 0 && (score / total) * 100 >= quiz.passing_score;
    await supabaseAdmin.from("quiz_attempts").insert({
      quiz_id: quiz.id,
      lesson_id: lc.lessonId,
      course_id: lc.courseId,
      user_id: context.userId,
      score,
      total,
      passed,
      answers: data.answers,
    });
    return { score, total, passed, results };
  });

export const postDiscussion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; threadId?: string; body: string }) => ({
    ...input,
    body: clean(input.body ?? "", 5000),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lessonCourse, assertAccess, notify, namesFor } = await import("./engine.server");
    const lc = await lessonCourse(data.lessonId);
    await assertAccess(context.supabase, lc.courseId, context.userId);
    if (!lc.discussionEnabled) throw new Error("Discussion is off");
    if (!data.body) throw new Error("Empty message");
    const since = new Date(Date.now() - 60_000).toISOString();
    const [{ count: t1 }, { count: t2 }] = await Promise.all([
      supabaseAdmin.from("discussion_threads").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since),
      supabaseAdmin.from("discussion_replies").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since),
    ]);
    if ((t1 ?? 0) + (t2 ?? 0) >= 5) throw new Error("Too many messages. Please wait a minute.");
    const names = await namesFor([context.userId]);
    const who = names.get(context.userId) ?? "";
    const link = `/learn/${lc.slug}`;
    if (data.threadId) {
      const { data: thread } = await supabaseAdmin
        .from("discussion_threads")
        .select("id, user_id, lesson_id")
        .eq("id", data.threadId)
        .maybeSingle();
      if (!thread || thread.lesson_id !== lc.lessonId) throw new Error("Thread not found");
      await supabaseAdmin
        .from("discussion_replies")
        .insert({ thread_id: thread.id, course_id: lc.courseId, user_id: context.userId, body: data.body });
      if (thread.user_id !== context.userId) await notify(thread.user_id, "discussion_reply", `${who} · ${lc.title}`, link);
    } else {
      await supabaseAdmin
        .from("discussion_threads")
        .insert({ lesson_id: lc.lessonId, course_id: lc.courseId, user_id: context.userId, body: data.body });
      if (lc.ownerId !== context.userId) await notify(lc.ownerId, "discussion_question", `${who} · ${lc.title}`, link);
    }
    return { ok: true };
  });

export const moderateDiscussion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "thread" | "reply"; id: string; hidden: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertEditor } = await import("./engine.server");
    const table = data.kind === "thread" ? "discussion_threads" : "discussion_replies";
    const { data: row } = await supabaseAdmin.from(table).select("course_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    await assertEditor(context.supabase, row.course_id);
    await supabaseAdmin.from(table).update({ hidden: data.hidden }).eq("id", data.id);
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, kind, title, link, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });
