import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000e1";
const MEMBER = "00000000-0000-0000-0000-0000000000e2";
const OUTSIDER = "00000000-0000-0000-0000-0000000000e3";
const ORG = "00000000-0000-0000-0000-0000000000e9";
const COURSE = "00000000-0000-0000-0000-0000000000ce";

const MINUTE = 60_000;
const soon = () => new Date(Date.now() + 10 * MINUTE).toISOString();
const later = () => new Date(Date.now() + 3 * 60 * MINUTE).toISOString();

let db: PGlite;
let classroom: string;
let inWindow: string;
let laterSession: string;
let online: string;
let cancelled: string;

function createSession(
  startsAt: string,
  format: string,
  meeting: string | null,
  location: string | null,
) {
  return asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_class_session($1, 'Lesson', $2, 60, 'UTC', $3, $4, $5) as id",
    [classroom, startsAt, meeting, format, location],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${MEMBER}'), ('${OUTSIDER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Check-in Org', 'checkin-org');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'checkin-course', 'Check-in course', 'subscription', 'published');
  `);

  classroom = (await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Check-in class"],
  ))!.id;
  const code = (await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroom],
  ))!.c;
  await asUser(db, MEMBER, "select public.join_classroom($1) as id", [code]);

  inWindow = (await createSession(soon(), "in_person", null, "Room 1"))!.id;
  laterSession = (await createSession(later(), "in_person", null, "Room 1"))!.id;
  online = (await createSession(soon(), "online", "https://meet.example/room", null))!.id;
  cancelled = (await createSession(soon(), "in_person", null, "Room 2"))!.id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("rotate_session_checkin", () => {
  it("returns a 64-character token and changes it on each rotation", async () => {
    const first = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    const second = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("refuses anyone who does not own the class", async () => {
    await expect(
      asUser(db, MEMBER, "select public.rotate_session_checkin($1) as t", [inWindow]),
    ).rejects.toThrow("Forbidden");
  });

  it("refuses online sessions", async () => {
    await expect(
      asUser(db, OWNER, "select public.rotate_session_checkin($1) as t", [online]),
    ).rejects.toThrow("Check-in is only for scheduled in-person sessions");
  });
});

describe("check_in_to_session", () => {
  it("records a member who scans the current code during the window", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    const first = await asUser<{ id: string }>(
      db,
      MEMBER,
      "select public.check_in_to_session($1) as id",
      [token],
    );
    const again = await asUser<{ id: string }>(
      db,
      MEMBER,
      "select public.check_in_to_session($1) as id",
      [token],
    );
    expect(first?.id).toBe(inWindow);
    expect(again?.id).toBe(inWindow);

    const rows = await db.query<{ n: number }>(
      "select count(*)::int as n from public.session_checkins where session_id = $1",
      [inWindow],
    );
    expect(rows.rows[0]!.n).toBe(1);
  });

  it("refuses a check-in before the window opens", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [laterSession],
    ))!.t;
    await expect(
      asUser(db, MEMBER, "select public.check_in_to_session($1) as id", [token]),
    ).rejects.toThrow("Check-in is not open");
  });

  it("refuses someone who is not in the class", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    await expect(
      asUser(db, OUTSIDER, "select public.check_in_to_session($1) as id", [token]),
    ).rejects.toThrow("Not a class member");
  });

  it("refuses an unknown code", async () => {
    await expect(
      asUser(db, MEMBER, "select public.check_in_to_session($1) as id", ["not-a-real-code"]),
    ).rejects.toThrow("Invalid check-in code");
  });

  it("refuses an expired code", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    await db.query(
      "update public.class_sessions set checkin_expires_at = now() - interval '1 second' where id = $1",
      [inWindow],
    );
    await expect(
      asUser(db, MEMBER, "select public.check_in_to_session($1) as id", [token]),
    ).rejects.toThrow("Invalid check-in code");
  });

  it("refuses a cancelled session even with a live code", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [cancelled],
    ))!.t;
    await asUser(db, OWNER, "select public.cancel_class_session($1)", [cancelled]);
    await expect(
      asUser(db, MEMBER, "select public.check_in_to_session($1) as id", [token]),
    ).rejects.toThrow("Session is cancelled");
  });

  it("refuses check-in once the class is archived", async () => {
    const token = (await asUser<{ t: string }>(
      db,
      OWNER,
      "select public.rotate_session_checkin($1) as t",
      [inWindow],
    ))!.t;
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    try {
      await expect(
        asUser(db, MEMBER, "select public.check_in_to_session($1) as id", [token]),
      ).rejects.toThrow("Class is archived");
    } finally {
      await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
        classroom,
        "active",
      ]);
    }
  });
});

describe("cancelling notifies enrolled students", () => {
  const countNotices = (uid: string) =>
    asUser<{ n: number }>(
      db,
      uid,
      "select count(*)::int as n from public.notifications where kind = 'class_session_cancelled'",
    ).then((r) => r!.n);

  it("tells active members once, and no one outside the class", async () => {
    const session = (await createSession(soon(), "in_person", null, "Room 3"))!.id;
    const memberBefore = await countNotices(MEMBER);
    const outsiderBefore = await countNotices(OUTSIDER);

    await asUser(db, OWNER, "select public.cancel_class_session($1)", [session]);
    await asUser(db, OWNER, "select public.cancel_class_session($1)", [session]);

    expect((await countNotices(MEMBER)) - memberBefore).toBe(1);
    expect((await countNotices(OUTSIDER)) - outsiderBefore).toBe(0);
  });
});

describe("check-in privacy", () => {
  it("does not let members read the live code from the session row", async () => {
    await expect(
      asUser(db, MEMBER, "select checkin_token from public.class_sessions limit 1"),
    ).rejects.toThrow(/permission denied/);
  });

  it("shows a learner only their own check-in", async () => {
    const seen = await asUser<{ n: number }>(
      db,
      MEMBER,
      "select count(*)::int as n from public.session_checkins",
    );
    const outsider = await asUser<{ n: number }>(
      db,
      OUTSIDER,
      "select count(*)::int as n from public.session_checkins",
    );
    expect(seen?.n).toBe(1);
    expect(outsider?.n).toBe(0);
  });
});
