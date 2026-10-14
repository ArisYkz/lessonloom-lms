import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000d1";
const MEMBER = "00000000-0000-0000-0000-0000000000d2";
const OUTSIDER = "00000000-0000-0000-0000-0000000000d3";
const ORG = "00000000-0000-0000-0000-0000000000d9";
const COURSE = "00000000-0000-0000-0000-0000000000cd";
const SECTION = "00000000-0000-0000-0000-0000000000ad";
const LESSON = "00000000-0000-0000-0000-0000000000bd";
const HOMEWORK = "00000000-0000-0000-0000-0000000000dd";

const HOUR = 60 * 60_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

let db: PGlite;
let classroom: string;

async function createSession(startsAt: string, title = "Lesson") {
  const row = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_class_session($1, $2, $3, 60, 'UTC', $4, 'online', null) as id",
    [classroom, title, startsAt, "https://meet.example/room"],
  );
  return row!.id;
}

async function notices(uid: string) {
  const r = await asUser<{ n: number }>(
    db,
    uid,
    "select count(*)::int as n from public.notifications where kind = 'class_session_updated'",
  );
  return r!.n;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${MEMBER}'), ('${OUTSIDER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Edits Org', 'edits-org');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'edits-course', 'Edits course', 'subscription', 'published');
    insert into public.sections (id, course_id, title) values ('${SECTION}', '${COURSE}', 'S1');
    insert into public.lessons (id, section_id, course_id, title) values
      ('${LESSON}', '${SECTION}', '${COURSE}', 'Lesson 1');
    insert into public.homework (id, lesson_id, course_id, instructions) values
      ('${HOMEWORK}', '${LESSON}', '${COURSE}', 'Write a summary');
  `);

  classroom = (await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Original name"],
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

describe("rename_classroom", () => {
  it("lets the owner rename the class", async () => {
    await asUser(db, OWNER, "select public.rename_classroom($1, $2) as x", [
      classroom,
      "  Renamed class  ",
    ]);
    const r = await asUser<{ name: string }>(
      db,
      OWNER,
      "select name from public.classrooms where id = $1",
      [classroom],
    );
    expect(r!.name).toBe("Renamed class");
  });

  it("refuses a rename from a member", async () => {
    await expect(
      asUser(db, MEMBER, "select public.rename_classroom($1, $2) as x", [classroom, "Nope"]),
    ).rejects.toThrow("Forbidden");
  });

  it("refuses an empty name", async () => {
    await expect(
      asUser(db, OWNER, "select public.rename_classroom($1, $2) as x", [classroom, "   "]),
    ).rejects.toThrow("Invalid name");
  });
});

describe("update_class_session", () => {
  it("saves an edit and tells active members, but not outsiders", async () => {
    const session = await createSession(inHours(48), "Before");
    const memberBefore = await notices(MEMBER);
    const outsiderBefore = await notices(OUTSIDER);

    await asUser(
      db,
      OWNER,
      "select public.update_class_session($1, $2, $3, 90, 'UTC', $4, 'online', null)",
      [session, "After", inHours(72), "https://meet.example/moved"],
    );

    const r = await asUser<{ title: string; duration_minutes: number }>(
      db,
      OWNER,
      "select title, duration_minutes from public.class_sessions where id = $1",
      [session],
    );
    expect(r).toMatchObject({ title: "After", duration_minutes: 90 });
    expect((await notices(MEMBER)) - memberBefore).toBe(1);
    expect((await notices(OUTSIDER)) - outsiderBefore).toBe(0);
  });

  it("does not notify when nothing changed", async () => {
    const startsAt = inHours(50);
    const session = await createSession(startsAt, "Same");
    const before = await notices(MEMBER);
    await asUser(
      db,
      OWNER,
      "select public.update_class_session($1, $2, $3, 60, 'UTC', $4, 'online', null)",
      [session, "Same", startsAt, "https://meet.example/room"],
    );
    expect((await notices(MEMBER)) - before).toBe(0);
  });

  it("refuses moving a session into the past", async () => {
    const session = await createSession(inHours(52), "Future");
    await expect(
      asUser(
        db,
        OWNER,
        "select public.update_class_session($1, $2, $3, 60, 'UTC', $4, 'online', null)",
        [session, "Future", inHours(-1), "https://meet.example/room"],
      ),
    ).rejects.toThrow("Session must start in the future");
  });

  it("refuses to edit a cancelled session", async () => {
    const session = await createSession(inHours(54), "Gone");
    await asUser(db, OWNER, "select public.cancel_class_session($1)", [session]);
    await expect(
      asUser(
        db,
        OWNER,
        "select public.update_class_session($1, $2, $3, 60, 'UTC', $4, 'online', null)",
        [session, "Gone edited", inHours(54), "https://meet.example/room"],
      ),
    ).rejects.toThrow("Session is cancelled");
  });

  it("refuses an edit from a member", async () => {
    const session = await createSession(inHours(56), "Mine");
    await expect(
      asUser(
        db,
        MEMBER,
        "select public.update_class_session($1, $2, $3, 60, 'UTC', $4, 'online', null)",
        [session, "Hijacked", inHours(56), "https://meet.example/room"],
      ),
    ).rejects.toThrow("Forbidden");
  });
});

describe("restore_class_session", () => {
  it("restores a cancelled future session and tells members", async () => {
    const session = await createSession(inHours(60), "Back");
    await asUser(db, OWNER, "select public.cancel_class_session($1)", [session]);
    const before = await notices(MEMBER);

    await asUser(db, OWNER, "select public.restore_class_session($1)", [session]);

    const r = await asUser<{ status: string }>(
      db,
      OWNER,
      "select status from public.class_sessions where id = $1",
      [session],
    );
    expect(r!.status).toBe("scheduled");
    expect((await notices(MEMBER)) - before).toBe(1);
  });

  it("refuses to restore a session that is not cancelled", async () => {
    const session = await createSession(inHours(62), "Still on");
    await expect(
      asUser(db, OWNER, "select public.restore_class_session($1)", [session]),
    ).rejects.toThrow("Session is not cancelled");
  });

  it("refuses to restore a session whose start has passed", async () => {
    const session = await createSession(inHours(64), "Past");
    await asUser(db, OWNER, "select public.cancel_class_session($1)", [session]);
    await db.query(
      "update public.class_sessions set starts_at = now() - interval '1 hour' where id = $1",
      [session],
    );
    await expect(
      asUser(db, OWNER, "select public.restore_class_session($1)", [session]),
    ).rejects.toThrow("Session must start in the future");
  });
});

describe("homework due dates", () => {
  it("refuses a due date in the past", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
        classroom,
        HOMEWORK,
        inHours(-2),
      ]),
    ).rejects.toThrow("Due date must be in the future");
  });

  it("accepts a future due date and clearing it", async () => {
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
      classroom,
      HOMEWORK,
      inHours(100),
    ]);
    await asUser(db, OWNER, "select public.set_classroom_homework_due($1, $2, $3)", [
      classroom,
      HOMEWORK,
      null,
    ]);
    const r = await asUser<{ n: number }>(
      db,
      OWNER,
      "select count(*)::int as n from public.classroom_homework_due where classroom_id = $1",
      [classroom],
    );
    expect(r!.n).toBe(0);
  });
});
