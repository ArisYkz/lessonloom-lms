import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000f1";
const MEMBER = "00000000-0000-0000-0000-0000000000f2";
const OUTSIDER = "00000000-0000-0000-0000-0000000000f3";
const ORG = "00000000-0000-0000-0000-0000000000f9";
const COURSE = "00000000-0000-0000-0000-0000000000cf";
const OTHER_COURSE = "00000000-0000-0000-0000-0000000000c0";
const SECTION = "00000000-0000-0000-0000-0000000000a1";
const OTHER_SECTION = "00000000-0000-0000-0000-0000000000a2";
const LESSON = "00000000-0000-0000-0000-0000000000b1";
const OTHER_LESSON = "00000000-0000-0000-0000-0000000000b2";
const HOMEWORK = "00000000-0000-0000-0000-0000000000d1";
const OTHER_HOMEWORK = "00000000-0000-0000-0000-0000000000d2";

const DUE = "2030-01-15T12:00:00Z";
const LATER = "2030-02-01T09:00:00Z";

let db: PGlite;
let classroom: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${MEMBER}'), ('${OUTSIDER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Homework Org', 'homework-org');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'homework-course', 'Homework course', 'subscription', 'published'),
      ('${OTHER_COURSE}', '${ORG}', 'other-homework-course', 'Other course', 'subscription', 'published');
    insert into public.sections (id, course_id, title) values
      ('${SECTION}', '${COURSE}', 'S1'),
      ('${OTHER_SECTION}', '${OTHER_COURSE}', 'S2');
    insert into public.lessons (id, section_id, course_id, title) values
      ('${LESSON}', '${SECTION}', '${COURSE}', 'Lesson 1'),
      ('${OTHER_LESSON}', '${OTHER_SECTION}', '${OTHER_COURSE}', 'Other lesson');
    insert into public.homework (id, lesson_id, course_id, instructions) values
      ('${HOMEWORK}', '${LESSON}', '${COURSE}', 'Write a summary'),
      ('${OTHER_HOMEWORK}', '${OTHER_LESSON}', '${OTHER_COURSE}', 'Other task');
  `);

  classroom = (await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Homework class"],
  ))!.id;
  const code = (await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroom],
  ))!.c;
  await asUser(db, MEMBER, "select public.join_classroom($1) as id", [code]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("set_classroom_homework_due", () => {
  it("lets the class owner set a due date for course homework", async () => {
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
      classroom,
      HOMEWORK,
      DUE,
    ]);
    const row = await asUser<{ due_at: Date }>(
      db,
      OWNER,
      "select due_at from public.classroom_homework_due where classroom_id = $1 and homework_id = $2",
      [classroom, HOMEWORK],
    );
    expect(new Date(row!.due_at).toISOString()).toBe(new Date(DUE).toISOString());
  });

  it("replaces an existing due date instead of adding a second row", async () => {
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
      classroom,
      HOMEWORK,
      LATER,
    ]);
    const rows = await db.query<{ n: number }>(
      "select count(*)::int as n from public.classroom_homework_due where classroom_id = $1 and homework_id = $2",
      [classroom, HOMEWORK],
    );
    expect(rows.rows[0]!.n).toBe(1);
  });

  it("refuses homework that belongs to another course", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
        classroom,
        OTHER_HOMEWORK,
        DUE,
      ]),
    ).rejects.toThrow("Homework is not in this course");
  });

  it("refuses a learner who is not the class owner", async () => {
    await expect(
      asUser(db, MEMBER, "select public.set_classroom_homework_due($1, $2, $3)", [
        classroom,
        HOMEWORK,
        DUE,
      ]),
    ).rejects.toThrow("Forbidden");
  });

  it("clears the due date when given null", async () => {
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, null)", [
      classroom,
      HOMEWORK,
    ]);
    const rows = await db.query<{ n: number }>(
      "select count(*)::int as n from public.classroom_homework_due where classroom_id = $1 and homework_id = $2",
      [classroom, HOMEWORK],
    );
    expect(rows.rows[0]!.n).toBe(0);
  });

  it("refuses changes to an archived class", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    await expect(
      asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
        classroom,
        HOMEWORK,
        DUE,
      ]),
    ).rejects.toThrow("Class is archived");
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "active",
    ]);
  });
});

describe("classroom_homework_due visibility", () => {
  beforeAll(async () => {
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
      classroom,
      HOMEWORK,
      DUE,
    ]);
  });

  it("shows the due date to active class members", async () => {
    const row = await asUser<{ n: number }>(
      db,
      MEMBER,
      "select count(*)::int as n from public.classroom_homework_due",
    );
    expect(row!.n).toBe(1);
  });

  it("hides the due date from people outside the class", async () => {
    const row = await asUser<{ n: number }>(
      db,
      OUTSIDER,
      "select count(*)::int as n from public.classroom_homework_due",
    );
    expect(row!.n).toBe(0);
  });

  it("blocks direct writes from the client", async () => {
    await expect(
      asUser(
        db,
        OWNER,
        "insert into public.classroom_homework_due (classroom_id, homework_id, due_at) values ($1, $2, $3)",
        [classroom, OTHER_HOMEWORK, DUE],
      ),
    ).rejects.toThrow("permission denied");
  });
});
