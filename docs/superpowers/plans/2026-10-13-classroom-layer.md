# Classroom Layer Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Build in order; each task ends with tests passing.

**Goal:** A teacher runs a class (a group of students on one course) with a join code. Members get access to the course, can leave, and can be removed. All access decisions stay in SQL.

**Architecture:** Two new tables, `classrooms` and `classroom_memberships`. Classroom rows are read through RLS, but every write goes through `SECURITY DEFINER` functions so join codes and membership changes are server-controlled. `has_course_access` gains a membership clause, so every existing learner policy and signed-media check picks it up without changes. Class members count toward the plan's student limit through a helper shared with `enroll_free_course`.

**Tech Stack:** Postgres migration `0013_classrooms.sql`, in-process Postgres tests (`tests/db/`), TanStack server functions (`src/lib/teach.functions.ts`, `src/lib/learn.functions.ts`), i18n dictionary (`src/i18n/dictionary.ts`).

---

## Decisions (confirmed)

1. **How students join.** Recommended: a join code the teacher shares. The alternative, adding by email, would let anyone probe which emails have accounts. Codes are rotatable.
2. **Rejoining after removal.** Confirmed as recommended: a removed student can rejoin with the current code. The teacher rotates the code to lock someone out. The alternative blocks rejoin until the teacher reinstates them, which needs extra UI.
3. **Archived classes.** Confirmed as recommended: archiving revokes access. The alternative is read-only access.
4. **Scope split.** Homework and live quizzes per classroom are **not** in this plan. Homework is currently one per lesson (`homework.lesson_id` is unique), so per-class assignments need a model change of their own. This plan is membership and access only; per-class homework is Phase 4b.
5. **Members count toward the plan student limit.** Confirmed as recommended: yes. Otherwise a teacher could bypass the limit by putting students into classes. The free (starter) limit is 3 students, set in migration 0017.

---

## File Structure

- Create: `drizzle/migrations/0013_classrooms.sql` (tables, RLS, grants, functions, access change, limit helpers)
- Modify: `drizzle/migrations/meta/_journal.json` (entry idx 13)
- Create: `tests/db/classrooms.test.ts` (schema, membership, and access tests)
- Modify: `src/lib/teach.functions.ts` (create, list, rotate, status, remove members)
- Modify: `src/lib/learn.functions.ts` (join, leave, and include classroom courses in `getMyLearning`)
- Modify: `src/i18n/dictionary.ts` (new strings in kk, ru, en; ru and kk flagged for native review)
- Modify: teacher course page and student courses page (UI, after backend tests pass)

---

### Task 1: Tables, keys, and read-only RLS

**Files:** Create `drizzle/migrations/0013_classrooms.sql`; Create `tests/db/classrooms.test.ts`; Modify `drizzle/migrations/meta/_journal.json`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/db/classrooms.test.ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const OTHER_OWNER = "00000000-0000-0000-0000-00000000000e";
const STUDENT = "00000000-0000-0000-0000-00000000000b";
const OTHER_STUDENT = "00000000-0000-0000-0000-00000000000d";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const OTHER_ORG = "00000000-0000-0000-0000-0000000000f3";
const COURSE = "00000000-0000-0000-0000-0000000000c1";
const OTHER_COURSE = "00000000-0000-0000-0000-0000000000c3";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${OTHER_OWNER}'), ('${STUDENT}'), ('${OTHER_STUDENT}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Org', 'org'),
      ('${OTHER_ORG}', '${OTHER_OWNER}', 'Other', 'other');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'c', 'C', 'subscription', 'published'),
      ('${OTHER_COURSE}', '${OTHER_ORG}', 'd', 'D', 'subscription', 'published');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("classroom keys", () => {
  it("rejects a classroom whose course belongs to another organization", async () => {
    await expect(
      db.exec(`
        insert into public.classrooms (organization_id, course_id, name, join_code)
        values ('${ORG}', '${OTHER_COURSE}', 'x', 'CODE0000001');
      `),
    ).rejects.toThrow(/classrooms_course_organization_fkey/);
  });
});

describe("classroom reads", () => {
  it("lets the owner read classrooms but not the join code column", async () => {
    await db.exec(`
      insert into public.classrooms (organization_id, course_id, name, join_code)
      values ('${ORG}', '${COURSE}', 'Morning', 'CODE0000002');
    `);
    await expect(
      asUser(db, OWNER, "select join_code from public.classrooms where name = 'Morning'"),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let other users see a classroom", async () => {
    const row = await asUser(
      db,
      OTHER_STUDENT,
      "select id from public.classrooms where name = 'Morning'",
    );
    expect(row).toBeUndefined();
  });

  it("blocks direct inserts into memberships", async () => {
    await expect(
      asUser(
        db,
        STUDENT,
        "insert into public.classroom_memberships (classroom_id, user_id) select id, $1 from public.classrooms limit 1",
        [STUDENT],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run tests/db/classrooms.test.ts`
Expected: FAIL (tables do not exist yet).

- [ ] **Step 3: Write the migration (tables, keys, RLS, grants)**

```sql
-- drizzle/migrations/0013_classrooms.sql
alter table public.courses add constraint courses_id_organization_key unique (id, organization_id);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  join_code text not null unique,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint classrooms_course_organization_fkey
    foreign key (course_id, organization_id)
    references public.courses (id, organization_id) on delete cascade
);
create index on public.classrooms (course_id);

create table public.classroom_memberships (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (classroom_id, user_id)
);
create index on public.classroom_memberships (user_id);

alter table public.classrooms enable row level security;
alter table public.classroom_memberships enable row level security;

-- Join codes are never readable through the table; owners fetch them via a function.
revoke all on public.classrooms from anon, authenticated;
grant select (id, organization_id, course_id, name, status, created_at) on public.classrooms to authenticated;
revoke all on public.classroom_memberships from anon, authenticated;
grant select on public.classroom_memberships to authenticated;

create policy "owners read classrooms" on public.classrooms for select to authenticated
  using (public.owns_org(organization_id) or public.has_role(auth.uid(), 'admin'));
create policy "members read their classroom" on public.classrooms for select to authenticated
  using (exists (
    select 1 from public.classroom_memberships m
    where m.classroom_id = classrooms.id and m.user_id = auth.uid() and m.status = 'active'
  ));

create policy "read own membership" on public.classroom_memberships for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.classrooms c
    where c.id = classroom_memberships.classroom_id and public.owns_org(c.organization_id)
  ));
```

Note: the `classrooms` SELECT grant omits `join_code`, so `select join_code` fails with `permission denied` for every role except through a function. The `classrooms` table keeps `revoke all` for writes, so all writes go through functions in Task 2.

- [ ] **Step 4: Add the journal entry**

Add to `drizzle/migrations/meta/_journal.json` after idx 12:
```json
{ "idx": 13, "version": "7", "when": 1791984000000, "tag": "0013_classrooms", "breakpoints": true }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run tests/db/classrooms.test.ts`
Expected: PASS (4 tests). Then `bun run test` for the full suite.

- [ ] **Step 6: Commit** (only after approval)

---

### Task 2: Membership functions

**Files:** Modify `drizzle/migrations/0013_classrooms.sql`; Modify `tests/db/classrooms.test.ts`.

Functions (all `SECURITY DEFINER`, `SET search_path = public`, check `auth.uid()`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`):

- `create_classroom(_course uuid, _name text) returns uuid`: caller must own the course's organization; inserts with a new join code.
- `get_classroom_join_code(_classroom uuid) returns text`: owner only.
- `rotate_classroom_join_code(_classroom uuid) returns text`: owner only.
- `set_classroom_status(_classroom uuid, _status text) returns void`: owner only; values `active` or `archived`.
- `join_classroom(_code text) returns uuid`: normalizes the code (`upper(btrim(_code))`); rejects unknown or archived classes with `Invalid join code`; returns the existing class id if already active; locks the organization row and enforces the student limit with `PLAN_STUDENT_LIMIT`; reactivates a `left` or `removed` membership (sets `joined_at = now()`, clears `ended_at`).
- `leave_classroom(_classroom uuid) returns void`: sets the caller's active membership to `left`, sets `ended_at`.
- `remove_classroom_member(_classroom uuid, _user uuid) returns void`: owner only; sets `removed`.

Join code generation (used by `create_classroom` and `rotate_classroom_join_code`):

```sql
create or replace function public.new_classroom_join_code()
returns text language sql volatile set search_path = public as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;
```

- [ ] **Step 1: Write failing tests** for: owner creates a class and gets a 12-character code; non-owner `create_classroom` raises; `join_classroom` with the code makes a membership active and returns the class id; an invalid code raises `Invalid join code`; joining twice is idempotent; `leave_classroom` sets `left` and keeps the row; rejoin reactivates; `remove_classroom_member` by a non-owner raises; `rotate_classroom_join_code` makes the old code invalid; archiving with `set_classroom_status` makes the code invalid.

Test helper pattern (used in each case):
```ts
const code = await asUser<{ c: string }>(db, OWNER, "select public.get_classroom_join_code($1) as c", [classroomId]);
```

- [ ] **Step 2: Run to verify failure**, then implement the functions above in `0013_classrooms.sql`, then rerun to pass.

- [ ] **Step 3: Commit** (only after approval)

---

### Task 3: Access and plan limit

**Files:** Modify `drizzle/migrations/0013_classrooms.sql`; Modify `tests/db/classrooms.test.ts`.

- [ ] **Step 1: Write failing tests**
  - A member of an active class can read a `subscription` course's access: `select public.has_course_access($1, $2)` is true for the student.
  - After `leave_classroom`, access is false.
  - After `remove_classroom_member`, access is false.
  - After archiving, access is false for remaining members.
  - A student in a class sees homework through the existing `homework for learners` policy (verifies the access change reaches RLS).
  - Plan limit: with `starter` (max 100 students), this check needs a limit of 2 to be practical. Insert `teacher_plans` row `tiny` (max_students 2) and an `org_subscriptions` ACTIVE row for a test org. Fill two members, then the third `join_classroom` raises `PLAN_STUDENT_LIMIT`. Also `enroll_free_course` returns `plan_student_limit` for a free course in the same org.

- [ ] **Step 2: Implement**

Helper functions (extracted from the current `enroll_free_course` logic):

```sql
create or replace function public.org_max_students(_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select tp.max_students from public.teacher_plans tp
  where tp.code = coalesce(
    (select os.plan_code from public.org_subscriptions os
     where os.organization_id = _org and os.status = 'ACTIVE' limit 1),
    'starter')
$$;

create or replace function public.org_learner_count(_org uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(distinct learner_id) from (
    select e.user_id as learner_id from public.enrollments e
      join public.courses c on c.id = e.course_id where c.organization_id = _org
    union
    select s.user_id from public.subscriptions s
      join public.courses c on c.id = s.course_id
      where c.organization_id = _org and s.status in ('ACTIVE','PAST_DUE','CANCELLED')
        and (s.current_period_end is null or s.current_period_end > now())
    union
    select m.user_id from public.classroom_memberships m
      join public.classrooms cl on cl.id = m.classroom_id
      where cl.organization_id = _org and m.status = 'active'
  ) learners
$$;
```

Revoke these from `PUBLIC, anon, authenticated` (they are called from other definer functions only).

Then `create or replace` `enroll_free_course` so the count comes from `org_learner_count` (behavior unchanged apart from classroom members now counting), and `has_course_access` adds:

```sql
or exists (
  select 1 from public.classroom_memberships m
  join public.classrooms cl on cl.id = m.classroom_id
  where cl.course_id = _course and m.user_id = _user
    and m.status = 'active' and cl.status = 'active'
)
```

`join_classroom` checks: `perform 1 from public.organizations where id = _org for update;`, then if `org_learner_count(_org)` (excluding the caller, who is not yet a member) is at least `org_max_students(_org)`, raise `PLAN_STUDENT_LIMIT`. Null max means unlimited.

- [ ] **Step 3: Run tests, then the full suite** (`bun run test`) to confirm the earlier access and enrollment tests still pass.

- [ ] **Step 4: Commit** (only after approval)

---

### Task 4: Server functions

**Files:** Modify `src/lib/teach.functions.ts`, `src/lib/learn.functions.ts`.

- [ ] **Step 1: Teacher functions in `teach.functions.ts`** (POST, `requireSupabaseAuth`): `listClassrooms({courseId})`, `createClassroom({courseId, name})`, `getJoinCode({classroomId})`, `rotateJoinCode({classroomId})`, `setClassroomStatus({classroomId, status})`, `listMembers({classroomId})`, `removeMember({classroomId, userId})`. Each calls the matching SQL function through `context.supabase.rpc(...)`. Errors pass through `throw new Error(error.message)`.

- [ ] **Step 2: Student functions in `learn.functions.ts`**: `joinClassroom({code})` (validates a non-empty code, returns the class id, maps `PLAN_STUDENT_LIMIT` and `Invalid join code` to readable messages through i18n keys), `leaveClassroom({classroomId})`. `getMyLearning` also returns courses reached through active memberships, deduplicated against enrollments.

- [ ] **Step 3: Verify** typecheck (`./node_modules/.bin/tsc --noEmit -p tsconfig.json`) and lint (`bun run lint`).

- [ ] **Step 4: Commit** (only after approval)

---

### Task 5: UI and strings

**Files:** teacher course page (classes section: create, list, copy join code, rotate, archive, member list with remove); student courses page (join field); `src/i18n/dictionary.ts`.

- [ ] **Step 1:** Add every new string to kk, ru, and en in `src/i18n/dictionary.ts`. No hardcoded text in components. Flag ru and kk strings for native review.
- [ ] **Step 2:** Build the teacher section and the student join field. Test the golden path in a browser: create class, copy code, join as a second account, see the course, leave, and confirm access is gone.
- [ ] **Step 3: Commit** (only after approval)

---

### Task 6: Verification

- [ ] `bun run test` (all DB tests pass)
- [ ] `./node_modules/.bin/tsc --noEmit -p tsconfig.json` (exit 0)
- [ ] `bun run lint` (0 errors)
- [ ] Review the diff against this plan, then report what changed and what is left (Phase 4b: per-class homework and live quizzes).
