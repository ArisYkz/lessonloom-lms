import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const STUDENT = "00000000-0000-0000-0000-00000000000b";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const COURSE = "00000000-0000-0000-0000-0000000000c1";
const SECTION = "00000000-0000-0000-0000-0000000000e1";
const LESSON = "00000000-0000-0000-0000-0000000000e2";

const LIMIT_OWNER = "00000000-0000-0000-0000-0000000000a2";
const LIMIT_ORG = "00000000-0000-0000-0000-0000000000f2";
const LIMIT_PAID = "00000000-0000-0000-0000-0000000000c2";
const LIMIT_FREE = "00000000-0000-0000-0000-0000000000c3";
const LEARNER_ONE = "00000000-0000-0000-0000-0000000000b1";
const LEARNER_TWO = "00000000-0000-0000-0000-0000000000b2";
const LEARNER_THREE = "00000000-0000-0000-0000-0000000000b3";

let db: PGlite;
let classroom: string;
let limitClassroom: string;

async function code(user: string, classroomId: string): Promise<string> {
  const r = await asUser<{ c: string }>(
    db,
    user,
    "select public.get_classroom_join_code($1) as c",
    [classroomId],
  );
  return r!.c;
}

async function hasAccess(user: string): Promise<boolean> {
  const r = await asUser<{ ok: boolean }>(
    db,
    user,
    "select public.has_course_access($1, $2) as ok",
    [COURSE, user],
  );
  return r!.ok;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values
      ('${OWNER}'), ('${STUDENT}'), ('${LIMIT_OWNER}'), ('${LEARNER_ONE}'), ('${LEARNER_TWO}'), ('${LEARNER_THREE}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Org', 'org'),
      ('${LIMIT_ORG}', '${LIMIT_OWNER}', 'Limit', 'limit');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'c', 'C', 'subscription', 'published'),
      ('${LIMIT_PAID}', '${LIMIT_ORG}', 'paid', 'Paid', 'subscription', 'published'),
      ('${LIMIT_FREE}', '${LIMIT_ORG}', 'free', 'Free', 'free', 'published');
    insert into public.sections (id, course_id, title) values ('${SECTION}', '${COURSE}', 'S');
    insert into public.lessons (id, section_id, course_id, title) values ('${LESSON}', '${SECTION}', '${COURSE}', 'L');
    insert into public.homework (lesson_id, course_id) values ('${LESSON}', '${COURSE}');
    insert into public.teacher_plans (code, name, price_kzt, max_courses, position, max_students)
      values ('tiny', 'Tiny', 0, null, 9, 2);
    insert into public.org_subscriptions (organization_id, plan_code) values ('${LIMIT_ORG}', 'tiny');
  `);
  const row = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Morning"],
  );
  classroom = row!.id;
  const limitRow = await asUser<{ id: string }>(
    db,
    LIMIT_OWNER,
    "select public.create_classroom($1, $2) as id",
    [LIMIT_PAID, "Limit"],
  );
  limitClassroom = limitRow!.id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("class membership grants course access", () => {
  it("denies a student who is not in a class", async () => {
    expect(await hasAccess(STUDENT)).toBe(false);
  });

  it("grants access to an active member", async () => {
    await asUser(db, STUDENT, "select public.join_classroom($1) as id", [
      await code(OWNER, classroom),
    ]);
    expect(await hasAccess(STUDENT)).toBe(true);
  });

  it("lets the member read homework through the learner policy", async () => {
    const row = await asUser(db, STUDENT, "select id from public.homework where course_id = $1", [
      COURSE,
    ]);
    expect(row).toBeDefined();
  });

  it("revokes access and homework when the member leaves", async () => {
    await asUser(db, STUDENT, "select public.leave_classroom($1) as x", [classroom]);
    expect(await hasAccess(STUDENT)).toBe(false);
    const row = await asUser(db, STUDENT, "select id from public.homework where course_id = $1", [
      COURSE,
    ]);
    expect(row).toBeUndefined();
  });

  it("revokes access when the owner removes the member", async () => {
    await asUser(db, STUDENT, "select public.join_classroom($1) as id", [
      await code(OWNER, classroom),
    ]);
    expect(await hasAccess(STUDENT)).toBe(true);
    await asUser(db, OWNER, "select public.remove_classroom_member($1, $2) as x", [
      classroom,
      STUDENT,
    ]);
    expect(await hasAccess(STUDENT)).toBe(false);
  });

  it("revokes access for members while the class is archived", async () => {
    await asUser(db, STUDENT, "select public.join_classroom($1) as id", [
      await code(OWNER, classroom),
    ]);
    expect(await hasAccess(STUDENT)).toBe(true);
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    expect(await hasAccess(STUDENT)).toBe(false);
  });

  it("restores access when the class is unarchived", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "active",
    ]);
    expect(await hasAccess(STUDENT)).toBe(true);
  });
});

describe("class members count toward the plan student limit", () => {
  beforeAll(async () => {
    await asUser(db, LEARNER_ONE, "select public.join_classroom($1) as id", [
      await code(LIMIT_OWNER, limitClassroom),
    ]);
    await asUser(db, LEARNER_TWO, "select public.join_classroom($1) as id", [
      await code(LIMIT_OWNER, limitClassroom),
    ]);
  });

  it("lets a member enroll in a free course without taking a new seat", async () => {
    const r = await asUser<{ r: string }>(
      db,
      LEARNER_ONE,
      "select public.enroll_free_course($1, $2) as r",
      [LIMIT_FREE, LEARNER_ONE],
    );
    expect(r!.r).toBe("enrolled");
  });

  it("refuses a new learner once the limit is reached", async () => {
    const r = await asUser<{ r: string }>(
      db,
      LEARNER_THREE,
      "select public.enroll_free_course($1, $2) as r",
      [LIMIT_FREE, LEARNER_THREE],
    );
    expect(r!.r).toBe("plan_student_limit");
  });
});

describe("class access requires a published course", () => {
  const DRAFT_COURSE = "00000000-0000-0000-0000-0000000000c4";
  const DRAFT_STUDENT = "00000000-0000-0000-0000-0000000000b4";
  let draftClassroom: string;

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id) values ('${DRAFT_STUDENT}');
      insert into public.courses (id, organization_id, slug, title, price_model, status)
        values ('${DRAFT_COURSE}', '${ORG}', 'draft', 'Draft', 'subscription', 'draft');
    `);
    const row = await asUser<{ id: string }>(
      db,
      OWNER,
      "select public.create_classroom($1, $2) as id",
      [DRAFT_COURSE, "Draft class"],
    );
    draftClassroom = row!.id;
  });

  it("denies members of a class whose course is still a draft", async () => {
    await asUser(db, DRAFT_STUDENT, "select public.join_classroom($1) as id", [
      await code(OWNER, draftClassroom),
    ]);
    const r = await asUser<{ ok: boolean }>(
      db,
      DRAFT_STUDENT,
      "select public.has_course_access($1, $2) as ok",
      [DRAFT_COURSE, DRAFT_STUDENT],
    );
    expect(r!.ok).toBe(false);
  });

  it("grants access once the course is published", async () => {
    await db.exec(`update public.courses set status = 'published' where id = '${DRAFT_COURSE}'`);
    const r = await asUser<{ ok: boolean }>(
      db,
      DRAFT_STUDENT,
      "select public.has_course_access($1, $2) as ok",
      [DRAFT_COURSE, DRAFT_STUDENT],
    );
    expect(r!.ok).toBe(true);
  });
});
