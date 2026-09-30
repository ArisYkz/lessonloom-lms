# Bilim — Learning Engine (Wave 2)

Turn Bilim from a course library into a teaching platform. The core teaching loop:
teacher explains → student practises and submits → teacher gives feedback → student improves and completes the course.

Production blockers (legal, payments, data residency, email, brand) stay on the roadmap in parallel. They still wait on your decisions and credentials.

## What gets built

Each lesson becomes a container. The teacher switches on only the parts they need:

1. **Content**: video, rich text (headings, lists, code, links) or both together.
2. **Resources**: downloadable files attached to a lesson.
3. **Homework**: instructions, text answer and/or file upload, optional max score, "required" toggle.
   - Statuses: Not started, Submitted, Needs revision, Reviewed.
   - Teacher writes feedback, gives an optional grade, and either returns the work for revision or marks it reviewed.
4. **Quiz**: single-choice questions, each with an explanation and a passing score. Students can retake it and see their score and the correct answers right away.
5. **Discussion**: questions on a lesson, visible to enrolled students and the teacher; replies; the teacher can hide replies. Off by default for each lesson.
6. **Completion rules**: a lesson counts as complete when the student marks it done, has reviewed/submitted required homework and has passed any required quiz. A course is complete at 100%, shown on the dashboard.

For teachers (basic Wave 3 pieces the loop needs):
7. **Homework inbox** across all their courses, with filters for "Needs review" and "Returned".
8. **Per-student progress** in the Students tab: lessons, homework status, quiz scores.
9. **In-app notifications** (bell icon): homework reviewed, new submission, new discussion question. No email until an email domain is connected.

## Not included (per the doc)
Rubrics, gradebooks, question banks, timed/random exams, certificates, live classes, direct messaging, drip content, AI.

## Build order
1. Database: new tables, access rules, storage paths for submissions.
2. Lesson editor: content, resources, homework and quiz sections, discussion toggle.
3. Student player: rich text, resources, homework submission, quiz, discussion, completion rules.
4. Teacher inbox, review screen and student progress.
5. Notifications.
6. Translations (kk/ru/en), then an end-to-end test with real teacher and student accounts, then cleanup.

## Technical details
- New tables: `lesson_resources`, `homework` (1 per lesson), `homework_submissions` (status enum, text, file paths[], score, feedback, reviewed_by/at), `quizzes` (1 per lesson, passing_score, required), `quiz_questions`, `quiz_options` (is_correct is never sent to students before they submit), `quiz_attempts`, `discussion_threads`, `discussion_replies` (hidden flag), `notifications`. Add `lessons.discussion_enabled`. Keep `body` as the rich-text field (sanitised Markdown).
- All reads and writes go through server functions that call `has_course_access`/`can_edit_course`. Quiz grading happens on the server. RLS stays strict: students see only their own submissions and attempts; teachers see rows for courses they can edit.
- Submission files go in the private `course-media` bucket under `{uid}/submissions/...`. Teachers get signed URLs through `media.server.ts`.
- Progress: extend `setLessonComplete` to check homework and quiz requirements. Course % keeps using `lesson_progress`.
- New server modules follow the audience split: learn (student actions), teach (review, inbox), plus a small `notifications.functions.ts`.
- Update project memory: quizzes/homework/discussion move from excluded to in scope.
