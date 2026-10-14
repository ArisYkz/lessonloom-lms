# Handover

Snapshot as of **2026-10-14** (updated after the first browser pass). `main` = `origin/main` = `d68581d`
plus the recording commit that follows it.

This records what is built, what is verified, and what still needs a human. Update it rather
than starting a new one.

## Where things stand

The classroom layer is feature-complete for the plan's Tier 1 and Tier 2, and five of the six
Tier 3 items. Everything is committed and pushed. The database is migrated through **0029**.

A first browser pass has now run (2026-10-14) — see below for what it covered and what it could
not, because a **local environment gap blocks the rest**.

## Browser pass — first run, 2026-10-14

Run with `smoke-scratch/journey.mjs`, `flow.mjs`, `flow-student.mjs`, `flow-teacher.mjs`
(outside the repo) against a local dev server. Verified working, in a real browser:

- Sign-in for both roles.
- **Student**: joining a class with a code, the dashboard class card showing the course, teacher
  and "Ближайшее занятие" with the time and location, the session on the calendar, the date-range
  filter, and check-in confirming "Вы отмечены."
- **Teacher**: the class page with join code, **copy link putting
  `http://<host>/join/<CODE>` on the clipboard**, copying the code, the QR dialog, renaming a
  class with its toast, and `/teach/classes` listing the class with its status and course.

**Blocked locally by a missing environment variable.** `src/integrations/supabase/client.server.ts`
throws unless `SUPABASE_SERVICE_ROLE_KEY` is set, and the local `.env` has only the publishable
key. The dev server logs `[Supabase] Missing Supabase environment variable(s):
SUPABASE_SERVICE_ROLE_KEY`. Anything that uses the admin client therefore fails locally:

- **Creating a teacher profile** (`createMyOrg`) — see the finding below.
- **The roster CSV export button** — it renders only when members load, and member names come
  from the admin client, so the button never appears locally.

Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` (Supabase dashboard → Settings → API) to finish the
pass locally, or run it against Lovable, where the variable exists.

### Finding: creating a teacher profile is not atomic

`createMyOrg` inserts the organization with the user's client, then grants the `teacher` role
through the admin client. The second result is **not checked**, and there is no transaction. If
that grant fails for any reason, the organization is left behind with no teacher role: the
header never enters teacher mode, so `/teach/classes` is unreachable from the nav, and
re-submitting the form hits the unique slug on the existing organization. Reproduced locally
through the missing key, but reachable on Lovable on any transient failure of that one insert.

### Smaller observations

- The student dashboard card shows the course title, teacher and a "Через класс" badge, but not
  the class name; a student in two classes on one course sees two near-identical cards.
- `/classes` (student) redirects to `/dashboard` — the route was stubbed and its nav link
  removed, which matches an earlier audit.

### Test accounts

`teacher2@test.com` and `student2@test.com`, password `LessonLoom-Test-2026!`. "Confirm email" is
now **off** on the project, so new signups work immediately. The older `teacher@test.com` and
`student@test.com` were never confirmed and still cannot sign in — confirming them in the
dashboard is the only fix, and progress does not depend on it. Two junk accounts,
`probe-check@test.com` and `probe2-check@test.com`, were created while diagnosing this and can be
deleted.

## Verifying the current state

```sh
bun install
bun run test      # 173 tests, 22 files
npx tsc --noEmit  # exit 0
bun run lint      # 0 errors (11 pre-existing react-refresh warnings)
npx vite build    # succeeds
```

`tsc` is not in CI (`.github/workflows/ci.yml` runs lint and test only), so run it by hand.

## What is done

**Classroom layer** (`816ce99`)

- Classes carry offering dates, seat capacity, an optional price, and an enrollment switch;
  a session is online with a meeting link or in person with a location (0023).
- In-person check-in: the teacher shows a QR whose token rotates, the learner scans it during
  the class window, and a cancelled session or archived class refuses it (0024, 0027).
- Per-class homework due dates, with past due dates rejected (0025, 0028).
- Starter teachers get one active class (0026).
- Teachers can rename a class, edit a scheduled session, and restore a cancelled one (0028).
- Cancelling, updating or restoring a session notifies enrolled students.

**Student and teacher screens** (`816ce99`)

- Dashboard shows the next session, its join link, and homework — badged overdue when past due.
- Join links can be copied; joining a class you are already in says so.
- Archiving, rotating a code, cancelling and restoring confirm with a named message.
- Both calendars filter by date range.
- The player resumes at the first unfinished lesson.
- Numbers follow the interface language; raw database errors no longer reach the user.

**Tier 3** (`da9c08b`, `6e3d777`)

- `/teach/classes` lists every class across courses.
- A class roster exports as CSV (names and join dates only — member emails are not readable by
  teachers).
- A directly enrolled course can be left from the dashboard.
- Online sessions can take check-in, not just in-person ones (0029).
- `send_session_reminders()` notifies members of sessions starting within the hour, run every
  five minutes by pg_cron (0029).

**Also** (`82a8dc7`, `d68581d`)

- Fixed the 29 lint errors Lovable's commits left behind, and translated auth errors, which
  were being shown to learners as the provider's English.

## What is next

**1. Finish the browser pass — blocked on `SUPABASE_SERVICE_ROLE_KEY` in the local `.env`.**

The student journey and most of the teacher journey are now verified in a browser (see above).
What is left needs the admin client, so add the service-role key (Supabase dashboard → Settings →
API) to `.env` and re-run, or run the pass against Lovable:

- Creating a teacher profile end to end, and therefore the teacher nav including `/teach/classes`.
- The roster CSV export — its button only appears once members load.
- Member names in the class panel.

Still unexercised in any browser, service key or not: setting a homework due date, the overdue
homework state, scheduling and editing a session through the UI, cancelling and restoring one,
the reminder notifications, and leaving a directly enrolled course.

**2. Confirm the pg_cron job actually scheduled.** Migration 0029 prints either
`Session reminders scheduled every 5 minutes.` or a warning saying it was not — the code
swallows the failure so that check-in still works if pg_cron is unavailable. The `cron` schema
is not exposed through the API, so this can only be checked in **Dashboard → Integrations →
Cron** for a `session-reminders` job.

**3. Decide how classes are priced.** `classrooms.price_kzt` exists (0023) and is editable, but
nothing reads it: no checkout, and students never see a price. This is the last open Tier 1
item. Payment processing is deliberately deferred.

**4. Remaining Tier 3.** Projector mode for the check-in QR is the last actual feature.
Then: receipts (blocked until payments exist), removing dead exports (`deleteCourse`,
`reorder`, and the now-unused `unenrollCourse` is wired up but `joinClassroom`'s
`alreadyMember` handling deserves a second look), native ru/kk review of the strings written
without it, and browser end-to-end tests.

**5. Smaller loose ends.** `drizzle/migrations/meta/_journal.json` was brought up to 0029, but
`types.ts` has never had a clean regeneration — it needs the Supabase CLI or a service-role
key, and neither is available locally. 27 files fail `prettier --check` for reasons predating
this work.

## Things that cost time — read before the next session

- **Lovable pushes to this same branch.** Between two checks in one session it advanced seven
  commits and a push was rejected. Always `git fetch` immediately before pushing, and never
  force-push.
- **Lovable's generated `types.ts` can be stale and look authoritative.** Its last regen
  stopped at migration 0022 and was a strict subset of ours. Compare key sets before assuming
  a regeneration knows more than the hand-maintained file.
- **Probing Supabase over PostgREST:** `POST /rest/v1/rpc/<fn>` returns PGRST202 for a function
  that does not exist, but _also_ when the argument set does not match — pass the real argument
  names or you will conclude a function is missing when it is not. This produced one wrong
  answer already. Missing table → 404 PGRST205. Missing column → 42703. Existing but
  anon-forbidden → 401 42501.
- **`vite build` while a dev server is running leaves it serving 500 for every route,** `/auth`
  included. Start a fresh server on another port rather than debugging the code.
- **Sonner toasts dismiss after about four seconds.** Sampling once, late, looks exactly like
  "no error was shown" — that produced a false bug report. Poll for them.
- **A `\u` escape written through the Edit tool can land as the literal character** (a real BOM
  ended up in `classroom-panel.tsx`). `String.fromCharCode(...)` avoids it; the linter catches it.
- **The test accounts** (once confirmed) use password `LessonLoom-Test-2026!`. The original
  `123456` was rejected as a pwned password, which is why an earlier smoke run silently never
  created them and every screenshot was the login page.

## Project rules

- Commit only when explicitly asked; push only when asked; **never force-push** (Lovable syncs
  from the branch and published history must not be rewritten).
- All access decisions stay in SQL; the frontend never decides access.
- UI strings live in `src/i18n/dictionary.ts` (kk/ru/en) — no hardcoded user-facing text.
- Signed-in data fetches use POST server functions; GET responses were served stale after edits.
