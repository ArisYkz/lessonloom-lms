# Bilim — Production Hardening and Full Workflow Test

Goal: take Bilim from "works in preview" to "safe to open to real users" (free soft launch), with a clear, gated path to paid production.

## Phase 1 — Security fixes (start immediately)
1. Stop public reading of all user profiles: only name + photo of teachers and people visible inside your courses; suspended flag and bio private.
2. Organizations: public sees only safe storefront fields; owner id not exposed.
3. Lock down 8 internal database checks so signed-out visitors can't call them (keep only the ones public pages need, e.g. course stats).
4. Rate limits on reports, homework, discussion, enrollment (flying comments already limited).
5. Password reset flow (page + email link) and check it works.
6. Re-run security scan and database linter until clean.

## Phase 2 — Full workflow test (real accounts, in the browser)
Run each journey end to end, screenshot each step, fix every bug found:
- Teacher: sign up → create school → upload logo/cover → create course → sections/lessons (video, text, file) → homework, quiz, resources, discussion → preview minutes → submit for review.
- Admin: review queue → reject with reason (teacher sees it) → approve → change teacher plan → handle a report.
- Student (free course): browse home/catalog → course page → enroll → watch → flying comments → quiz → submit homework → teacher returns/reviews → complete course (100% banner).
- Student (paid course): free preview locks at the limit, subscribe prompt shown, no access to other lessons.
- Permission attacks: teacher A tries to edit teacher B's course; student opens a paid lesson directly; signed-out user opens private file links; blocked student tries to post comments.
- Plan limits: Start plan blocks the 4th course and the 101st student.
- Languages: every screen in kk/ru/en; no English leftovers (error/404 pages translated).
- Fix known bug: blank teacher studio for ~7s after sign-in.

## Phase 3 — Quality baseline
- Phone and tablet check of every page; fix layout issues.
- Loading, empty and error states on every screen.
- Automated tests for the core rules (course access, completion rules, plan limits, quiz grading) so they can't silently break.
- SEO basics: sitemap, robots, per-page titles/descriptions, social image.

## Phase 4 — Operations
- Error monitoring and alerts.
- Separate test and live environments.
- Backup plus a real restore test (target: lose at most 24h, back within 4h).
- Basic analytics funnel: viewed course → signed up → enrolled → completed.
- Audit log for admin actions, plan changes, moderation.

## Phase 5 — Needs your decisions (blocked)
- Email domain → welcome, approval, homework-reviewed, receipt emails.
- Legal pages: Terms, Privacy, Public Offer, Refund, Teacher Agreement (kk/ru/en) — real text from a lawyer; I can add placeholder pages.
- Kazakhstan data residency (launch blocker for public production).
- Final brand name, domain, logo.
- Video service (Cloudflare Stream) → 480/720/1080 and preview that can't be downloaded.
- Freedom Pay merchant account → payments, teacher earnings, payouts, refunds (full payment test matrix before any paid launch).

## Launch gates
- Free soft launch: Phases 1–4 done, legal placeholders reviewed.
- Paid launch: Phase 5 payments + data residency + legal review complete.

## Technical details
- Profiles/organizations: replace `true` SELECT policies with scoped ones; expose public teacher data via a narrow view or SECURITY DEFINER function returning safe columns.
- REVOKE EXECUTE from anon (and authenticated where unneeded) on SECURITY DEFINER helpers; keep course_stats public.
- Rate limiting via per-user timestamp checks in server functions.
- Playwright scripts per journey with minted sessions for teacher/student/admin; results logged in roadmap.md.
- Unit tests with vitest for engine.server.ts rules and SQL functions via test queries.
