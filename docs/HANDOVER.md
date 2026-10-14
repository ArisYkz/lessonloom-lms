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

## Known issues

Recorded so they are not rediscovered. IDs are stable — cite them in commit messages. None of
these are fixed yet unless the entry says so.

**KN-1 — Creating a teacher profile is not atomic. (found by the browser pass, unfixed)**

`createMyOrg` (`src/lib/teach.functions.ts`) inserts the organization with the user's client,
then grants the `teacher` role through the admin client. The second call's result is **never
checked**, and the pair is not in a transaction. When it fails, the organization is already
committed, so the result is an organization with no teacher role.

Consequences: the header never enters teacher mode, so `/teach/classes` is unreachable from the
nav even though the route works; `getMyRoles` reports no teacher; and re-submitting the profile
form collides with the unique slug on the organization that already exists, so the user cannot
simply retry. There is no self-service recovery.

Reproduced locally via the missing service key (see KN-2), but it does **not** depend on that —
any transient failure of that one insert reaches the same state on Lovable. Fix by checking the
grant result and cleaning up or retrying, or by moving both writes into one SQL function.

**KN-2 — Local `.env` has no `SUPABASE_SERVICE_ROLE_KEY`. (environment, unfixed)**

`src/integrations/supabase/client.server.ts` throws without it, and the dev server logs
`[Supabase] Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY`. Every server
function touching the admin client fails locally, which currently blocks: creating a teacher
profile (KN-1), member names in the class panel, and therefore the **roster CSV export button**
(it only renders once members load). Not an app bug — add the key from the Supabase dashboard
(Settings → API) to finish the local pass.

**KN-3 — Whether the session-reminder cron job actually scheduled is unknown. (unverified)**

Migration 0029 swallows a `pg_cron` failure and raises a warning so that check-in still works
without it. If scheduling failed, reminders silently never fire — nothing surfaces the problem
to a user. The `cron` schema is not exposed through the API, so this can only be checked in
**Dashboard → Integrations → Cron** for a job named `session-reminders`.

**KN-4 — The student dashboard card omits the class name. (cosmetic)**

The card shows the course title, teacher and a "Через класс" badge. A student in two classes on
the same course therefore sees two near-identical cards with no way to tell them apart.

**KN-5 — `/classes` (student) is a dead route. (cleanup)**

It redirects to `/dashboard`; the route was stubbed and its nav link removed. Either build it or
delete it. Its string key `nav.classes` was reused for the teacher class list, so check that
before removing strings.

**KN-6 — `vite build` while a dev server runs leaves it broken. (tooling)**

After a build, that dev server answers 500 on **every** route including `/auth`, while a freshly
started server is fine. Looks like a corrupted module graph. Restart rather than debug.

**KN-7 — `types.ts` is hand-maintained and has never had a clean regeneration. (maintenance)**

It needs the Supabase CLI or a service-role key. Entries for migrations 0023–0029 were written by
hand. Lovable's own regeneration was stale (it stopped at 0022 and was a strict subset), so it
cannot be trusted as a source either. Its content currently matches the live schema — verified by
comparing key sets and probing the database.

**KN-8 — 27 files fail `prettier --check`. (cosmetic, pre-existing)**

`README.md`, `roadmap.md`, `tsconfig.json`, `src/styles.css` and several old
`drizzle/migrations/meta/*_snapshot.json` among them. ESLint passes, so CI is green; only the
standalone Prettier check fails.

## Test accounts

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

Ordered. `KN-n` refers to the known issues above.

**1. Add `SUPABASE_SERVICE_ROLE_KEY` to the local `.env` (KN-2), then re-run the pass.** It is the
cheapest unblock: without it the admin client fails, which covers creating a teacher profile, the
member names in the class panel, and the roster CSV export button. Everything else in the teacher
journey is already verified.

Still unexercised in any browser, service key or not: setting a homework due date, the overdue
homework state, scheduling and editing a session through the UI, cancelling and restoring one,
the reminder notifications, and leaving a directly enrolled course.

**2. Fix KN-1 — make creating a teacher profile atomic.** This is the only known issue that can
strand a real user with no way out. Check the role-grant result and unwind or retry, or move both
writes into one SQL function.

**3. Check KN-3 — whether the reminder cron job scheduled.** One look at **Dashboard →
Integrations → Cron**. If it is missing, reminders are silently dead.

**4. Finish browser coverage.** Unexercised in a browser by anything so far: setting a homework
due date, the overdue homework state, scheduling / editing / cancelling / restoring a session
through the UI, the reminder notifications, leaving a directly enrolled course, and the
`/teach/classes` nav link (which needs a real teacher role, i.e. KN-1 or KN-2 resolved first).

**5. Decide how classes are priced.** `classrooms.price_kzt` exists (0023) and is editable, but
nothing reads it: no checkout, and students never see a price. This is the last open Tier 1
item. Payment processing is deliberately deferred.

**6. Remaining Tier 3.** Projector mode for the check-in QR is the last actual feature. Then:
receipts (blocked until payments exist), removing dead exports (`deleteCourse`, `reorder`, and
`joinClassroom`'s unused `alreadyMember`), native ru/kk review of the strings written without it,
and browser end-to-end tests — the ad-hoc scripts in `smoke-scratch` are a starting point but are
not in the repo and not wired to CI.

**7. Cleanups.** KN-5 (dead `/classes` route), KN-4 (class name on the card), KN-7 (hand-written
`types.ts`), KN-8 (Prettier).

## Fixed in this round — do not re-report these

Found and fixed while building the classroom layer; recorded so a future check does not count
them as new findings.

- **Auth errors were shown to learners as the provider's English** ("Email not confirmed",
  "Invalid login credentials") in an otherwise Russian UI. `authErrorKey` now maps the common
  ones and falls back to a generic. Verified in a browser. (`d68581d`)
- **Archive, rotate-code and cancel-session succeeded silently** — they went through a handler
  that only surfaced errors. They now confirm with a named message. (`816ce99`)
- **The cancel dialog claimed "This can't be undone"** long after `restore_class_session` shipped.
  Corrected in all three locales. (`816ce99`)
- **The player always opened lesson 1** instead of resuming. It now opens the first unfinished
  lesson, which fixed every "continue" link at once. (`816ce99`)
- **Raw Postgres text reached toasts** on enrollment and lesson-complete failures. Routed through
  the error mapper. (`816ce99`)
- **Numbers ignored the interface language** — seven sites hardcoded `ru-RU`. (`816ce99`)
- **The student dashboard showed no next session or homework** for class-enrolled courses.
  (`816ce99`)
- **Lovable's commits left `bun run lint` failing** with 29 errors (single quotes, missing
  semicolons), so CI was red on the branch. (`82a8dc7`)
- **Lovable's regenerated `types.ts` was stale** — stopped at migration 0022 and was a strict
  subset of the hand-maintained file. Kept ours after verifying nothing was lost. (`816ce99`)
- **A duplicate `nav.classes` key** was added while building the teacher nav; one already existed.
  Caught by `tsc`, and the existing key was reused instead. (`da9c08b`)
- **A literal BOM character was written into `classroom-panel.tsx`** where a `﻿` escape was
  intended. Caught by the linter; replaced with `String.fromCharCode`. (`da9c08b`)
- **A `prefer-const` report in `previewAuthStorage.ts` is a false positive** — the variable is
  assigned after the listeners that may clear it, and its callback closes over the resolver, so
  the declaration cannot be merged. Suppressed with a reason rather than restructuring preview
  auth. (`82a8dc7`)

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
