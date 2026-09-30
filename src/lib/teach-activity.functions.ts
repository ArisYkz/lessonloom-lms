// Teacher-side learning activities: lesson extras editing, homework review.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuizInput = {
  question: string;
  explanation: string;
  options: { text: string; isCorrect: boolean }[];
};

async function editableLesson(supabase: unknown, lessonId: string) {
  const { lessonCourse, assertEditor } = await import("./engine.server");
  const lc = await lessonCourse(lessonId);
  await assertEditor(supabase, lc.courseId);
  return lc;
}

export const getLessonExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lc = await editableLesson(context.supabase, data.lessonId);
    const [{ data: resources }, { data: hw }, { data: quiz }] = await Promise.all([
      supabaseAdmin.from("lesson_resources").select("id, title, media_path").eq("lesson_id", lc.lessonId).order("position"),
      supabaseAdmin.from("homework").select("instructions, allow_text, allow_file, required, max_score").eq("lesson_id", lc.lessonId).maybeSingle(),
      supabaseAdmin.from("quizzes").select("id, passing_score, required").eq("lesson_id", lc.lessonId).maybeSingle(),
    ]);
    let questions: QuizInput[] = [];
    if (quiz) {
      const { data: qs } = await supabaseAdmin.from("quiz_questions").select("id, question, explanation").eq("quiz_id", quiz.id).order("position");
      const { data: opts } = await supabaseAdmin
        .from("quiz_options")
        .select("question_id, text, is_correct")
        .in("question_id", (qs ?? []).map((q) => q.id).concat("00000000-0000-0000-0000-000000000000"))
        .order("position");
      questions = (qs ?? []).map((q) => ({
        question: q.question,
        explanation: q.explanation,
        options: (opts ?? []).filter((o) => o.question_id === q.id).map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      }));
    }
    return {
      discussionEnabled: lc.discussionEnabled,
      resources: resources ?? [],
      homework: hw,
      quiz: quiz ? { passingScore: quiz.passing_score, required: quiz.required, questions } : null,
    };
  });

export const setDiscussionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lc = await editableLesson(context.supabase, data.lessonId);
    await supabaseAdmin.from("lessons").update({ discussion_enabled: data.enabled }).eq("id", lc.lessonId);
    return { ok: true };
  });

export const addResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; title: string; path: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lc = await editableLesson(context.supabase, data.lessonId);
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Invalid file");
    await supabaseAdmin
      .from("lesson_resources")
      .insert({ lesson_id: lc.lessonId, course_id: lc.courseId, title: data.title.trim().slice(0, 200) || "File", media_path: data.path });
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertEditor } = await import("./engine.server");
    const { data: row } = await supabaseAdmin.from("lesson_resources").select("course_id").eq("id", data.id).maybeSingle();
    if (!row) return { ok: true };
    await assertEditor(context.supabase, row.course_id);
    await supabaseAdmin.from("lesson_resources").delete().eq("id", data.id);
    return { ok: true };
  });

export const saveHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { lessonId: string; enabled: boolean; instructions: string; allowText: boolean; allowFile: boolean; required: boolean; maxScore: number | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lc = await editableLesson(context.supabase, data.lessonId);
    if (!data.enabled) {
      await supabaseAdmin.from("homework").delete().eq("lesson_id", lc.lessonId);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("homework").upsert(
      {
        lesson_id: lc.lessonId,
        course_id: lc.courseId,
        instructions: data.instructions.slice(0, 20000),
        allow_text: data.allowText || !data.allowFile,
        allow_file: data.allowFile,
        required: data.required,
        max_score: data.maxScore && data.maxScore > 0 ? Math.round(data.maxScore) : null,
      },
      { onConflict: "lesson_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; enabled: boolean; passingScore: number; required: boolean; questions: QuizInput[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lc = await editableLesson(context.supabase, data.lessonId);
    if (!data.enabled) {
      await supabaseAdmin.from("quizzes").delete().eq("lesson_id", lc.lessonId);
      return { ok: true };
    }
    const questions = data.questions
      .map((q) => ({ ...q, question: q.question.trim(), options: q.options.filter((o) => o.text.trim()) }))
      .filter((q) => q.question && q.options.length >= 2);
    for (const q of questions) {
      if (q.options.filter((o) => o.isCorrect).length !== 1) throw new Error(`"${q.question}": mark exactly one correct answer`);
    }
    const { data: quiz, error } = await supabaseAdmin
      .from("quizzes")
      .upsert(
        { lesson_id: lc.lessonId, course_id: lc.courseId, passing_score: Math.min(100, Math.max(0, Math.round(data.passingScore))), required: data.required },
        { onConflict: "lesson_id" },
      )
      .select("id")
      .single();
    if (error || !quiz) throw new Error(error?.message ?? "Save failed");
    await supabaseAdmin.from("quiz_questions").delete().eq("quiz_id", quiz.id);
    for (const [i, q] of questions.entries()) {
      const { data: qrow } = await supabaseAdmin
        .from("quiz_questions")
        .insert({ quiz_id: quiz.id, course_id: lc.courseId, question: q.question, explanation: q.explanation.trim(), position: i })
        .select("id")
        .single();
      if (!qrow) continue;
      await supabaseAdmin.from("quiz_options").insert(
        q.options.map((o, j) => ({ question_id: qrow.id, course_id: lc.courseId, text: o.text.trim(), is_correct: o.isCorrect, position: j })),
      );
    }
    return { ok: true };
  });

export const getHomeworkInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status: "submitted" | "needs_revision" | "reviewed" }) => input)
  .handler(async ({ data, context }) => {
    const { namesFor } = await import("./engine.server");
    // RLS limits rows to courses this teacher can edit (plus their own submissions).
    const { data: rows } = await context.supabase
      .from("homework_submissions")
      .select("id, user_id, course_id, status, submitted_at, score, lessons(title), courses(title)")
      .eq("status", data.status)
      .neq("user_id", context.userId)
      .order("submitted_at", { ascending: data.status === "submitted" })
      .limit(200);
    const names = await namesFor((rows ?? []).map((r) => r.user_id));
    return (rows ?? []).map((r) => ({
      id: r.id,
      student: names.get(r.user_id) ?? "—",
      lesson: (r.lessons as unknown as { title: string } | null)?.title ?? "",
      course: (r.courses as unknown as { title: string } | null)?.title ?? "",
      status: r.status,
      score: r.score,
      submittedAt: r.submitted_at,
    }));
  });

export const getSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertEditor, namesFor } = await import("./engine.server");
    const { signPath } = await import("./media.server");
    const { data: s } = await supabaseAdmin
      .from("homework_submissions")
      .select("id, user_id, course_id, body, file_paths, status, score, feedback, submitted_at, homework(instructions, max_score), lessons(title)")
      .eq("id", data.id)
      .maybeSingle();
    if (!s) throw new Error("Not found");
    await assertEditor(context.supabase, s.course_id);
    const names = await namesFor([s.user_id]);
    const hw = s.homework as unknown as { instructions: string; max_score: number | null } | null;
    return {
      id: s.id,
      student: names.get(s.user_id) ?? "—",
      lesson: (s.lessons as unknown as { title: string } | null)?.title ?? "",
      instructions: hw?.instructions ?? "",
      maxScore: hw?.max_score ?? null,
      body: s.body,
      status: s.status,
      score: s.score,
      feedback: s.feedback,
      submittedAt: s.submitted_at,
      files: await Promise.all(
        s.file_paths.map(async (p) => ({ name: p.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, ""), url: await signPath(p, 3600) })),
      ),
    };
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "needs_revision" | "reviewed"; feedback: string; score: number | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertEditor, notify } = await import("./engine.server");
    const { data: s } = await supabaseAdmin
      .from("homework_submissions")
      .select("id, user_id, course_id, lesson_id, lessons(title), courses(slug)")
      .eq("id", data.id)
      .maybeSingle();
    if (!s) throw new Error("Not found");
    await assertEditor(context.supabase, s.course_id);
    await supabaseAdmin
      .from("homework_submissions")
      .update({
        status: data.status,
        feedback: data.feedback.slice(0, 10000),
        score: data.score,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id);
    const title = (s.lessons as unknown as { title: string } | null)?.title ?? "";
    const slug = (s.courses as unknown as { slug: string } | null)?.slug ?? "";
    await notify(s.user_id, data.status === "reviewed" ? "homework_reviewed" : "homework_revision", title, `/learn/${slug}`);
    return { ok: true };
  });
