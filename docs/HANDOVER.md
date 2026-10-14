# Handover

Snapshot as of **2026-10-14**. `main` = `origin/main` = `d68581d`.

This records what is built, what is verified, and what still needs a human. Update it rather
than starting a new one.

## Where things stand

The classroom layer is feature-complete for the plan's Tier 1 and Tier 2, and five of the six
Tier 3 items. Everything is committed and pushed. The database is migrated through **0029**.

The one thing that has never happened: **nobody has used the app in a browser as a signed-in
user.** Every claim below rests on the test suite, `tsc`, lint and a production build. A single
change — the auth error wording — was confirmed in a real browser, and it was confirmed only
because the sign-in it exercises is blocked, which is how the blocker surfaced.

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

**1. The browser pass — the only real gap, and it is blocked on you.**

`teacher@test.com` and `student@test.com` cannot sign in. They return `email_not_confirmed`,
and `test.com` is not a real inbox, so the link can never be clicked. In the Supabase dashboard
either confirm both users under **Authentication → Users**, or turn off **Confirm email** under
**Authentication → Sign In / Providers** for this dev project.

The harness is ready: `D:\0PROJECTS\bilim\smoke-scratch\journey.mjs` signs in as both accounts,
walks the teacher and student routes, and dumps each page's headings, buttons, links and fields
alongside console errors and screenshots. Run it with `BASE` pointed at a running dev server.

Worth driving once sign-in works: create a class, copy the join link, join as the student,
schedule a session, check in with the QR, set a homework due date, and export the roster.

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
