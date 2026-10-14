import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000f1";
const MEMBER = "00000000-0000-0000-0000-0000000000f2";
const SECOND = "00000000-0000-0000-0000-0000000000f3";
const ORG = "00000000-0000-0000-0000-0000000000f4";
const COURSE = "00000000-0000-0000-0000-0000000000f5";

const MINUTE = 60_000;
const soon = () => new Date(Date.now() + 20 * MINUTE).toISOString();
const later = () => new Date(Date.now() + 5 * 60 * MINUTE).toISOString();

let db: PGlite;
let classroom: string;
let upcoming: string;

// Notifications carry no session id, only the title, so each session gets a distinct title
// and the count can be attributed to it.
function createSession(classroomId: string, title: string, startsAt: string) {
  return asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_class_session($1, $2, $3, 60, 'UTC', 'https://meet.example/room', 'online', null) as id",
    [classroomId, title, startsAt],
  );
}

async function sent(title: string) {
  const rows = await db.query<{ n: number }>(
    "select count(*)::int as n from public.notifications where kind = 'class_session_reminder' and title = $1",
    [title],
  );
  return rows.rows[0]!.n;
}

async function runReminders() {
  const rows = await db.query<{ n: number }>("select public.send_session_reminders() as n");
  return rows.rows[0]!.n;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${MEMBER}'), ('${SECOND}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Reminder Org', 'reminder-org');
    -- Pro lifts the one-active-class limit on Starter, so the archived-class case can exist
    -- alongside the active one.
    insert into public.org_subscriptions (organization_id, plan_code, status)
      values ('${ORG}', 'pro', 'ACTIVE');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'reminder-course', 'Reminder course', 'subscription', 'published');
  `);

  classroom = (await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Reminder class"],
  ))!.id;
  const code = (await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroom],
  ))!.c;
  await asUser(db, MEMBER, "select public.join_classroom($1) as id", [code]);
  await asUser(db, SECOND, "select public.join_classroom($1) as id", [code]);

  upcoming = (await createSession(classroom, "Upcoming lesson", soon()))!.id;
  await createSession(classroom, "Far off lesson", later());

  // A class that is archived still has members, but must not be reminded.
  const archivedClass = (await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Archived class"],
  ))!.id;
  const archivedCode = (await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [archivedClass],
  ))!.c;
  await asUser(db, MEMBER, "select public.join_classroom($1) as id", [archivedCode]);
  await createSession(archivedClass, "Archived lesson", soon());
  await asUser(db, OWNER, "select public.set_classroom_status($1, $2)", [
    archivedClass,
    "archived",
  ]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("send_session_reminders", () => {
  it("cannot be run by a signed-in member", async () => {
    await expect(asUser(db, MEMBER, "select public.send_session_reminders()")).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("reminds each active member of a session starting within the hour, and nothing else", async () => {
    expect(await runReminders()).toBe(1);

    expect(await sent("Upcoming lesson")).toBe(2);
    expect(await sent("Far off lesson")).toBe(0);
    expect(await sent("Archived lesson")).toBe(0);
  });

  it("sends nothing on a second run", async () => {
    expect(await runReminders()).toBe(0);
    expect(await sent("Upcoming lesson")).toBe(2);
  });

  it("reminds again once the session is moved, because the first reminder no longer matches", async () => {
    await asUser(
      db,
      OWNER,
      `select public.update_class_session($1, 'Upcoming lesson', $2, 60, 'UTC', 'https://meet.example/room', 'online', null)`,
      [upcoming, new Date(Date.now() + 40 * MINUTE).toISOString()],
    );
    expect(await runReminders()).toBe(1);
    expect(await sent("Upcoming lesson")).toBe(4);
  });
});
