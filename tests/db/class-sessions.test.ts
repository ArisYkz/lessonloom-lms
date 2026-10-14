import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000a5";
const OTHER_OWNER = "00000000-0000-0000-0000-0000000000a6";
const STUDENT = "00000000-0000-0000-0000-0000000000b5";
const ORG = "00000000-0000-0000-0000-0000000000f5";
const OTHER_ORG = "00000000-0000-0000-0000-0000000000f6";
const COURSE = "00000000-0000-0000-0000-0000000000c5";
const STARTS_AT = "2026-11-01T10:00:00+05";

let db: PGlite;
let classroom: string;

async function code(user: string, classroomId: string): Promise<string> {
  const r = await asUser<{ c: string }>(
    db,
    user,
    "select public.get_classroom_join_code($1) as c",
    [classroomId],
  );
  return r!.c;
}

function schedule(
  user: string,
  classroomId: string,
  overrides: {
    title?: string;
    duration?: number;
    timeZone?: string;
    meetingUrl?: string | null;
    format?: "online" | "in_person";
    location?: string | null;
  } = {},
) {
  return asUser<{ id: string }>(
    db,
    user,
    "select public.create_class_session($1, $2, $3, $4, $5, $6, $7, $8) as id",
    [
      classroomId,
      overrides.title ?? "Q&A",
      STARTS_AT,
      overrides.duration ?? 60,
      overrides.timeZone ?? "Asia/Almaty",
      overrides.meetingUrl === undefined ? "https://meet.example.com/abc" : overrides.meetingUrl,
      overrides.format ?? "online",
      overrides.location ?? null,
    ],
  );
}

async function visibleSessions(user: string): Promise<number> {
  const r = await asUser<{ n: number }>(
    db,
    user,
    "select count(*)::int as n from public.class_sessions where classroom_id = $1",
    [classroom],
  );
  return r!.n;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${OTHER_OWNER}'), ('${STUDENT}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Sessions', 'sessions'),
      ('${OTHER_ORG}', '${OTHER_OWNER}', 'Other', 'other');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'c', 'C', 'subscription', 'published');
  `);
  const row = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Morning"],
  );
  classroom = row!.id;
  await asUser(db, STUDENT, "select public.join_classroom($1) as id", [
    await code(OWNER, classroom),
  ]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("owner schedules sessions", () => {
  it("creates a session in an active class the owner runs", async () => {
    const r = await schedule(OWNER, classroom);
    expect(r!.id).toBeDefined();
  });

  it("stores the time zone and meeting link as given", async () => {
    const r = await asUser<{ time_zone: string; meeting_url: string }>(
      db,
      OWNER,
      "select time_zone, meeting_url from public.class_sessions where classroom_id = $1 limit 1",
      [classroom],
    );
    expect(r).toEqual({ time_zone: "Asia/Almaty", meeting_url: "https://meet.example.com/abc" });
  });

  it("accepts an in-person session with a location and no meeting link", async () => {
    const r = await schedule(OWNER, classroom, {
      meetingUrl: "   ",
      format: "in_person",
      location: "Room 204",
    });
    expect(r!.id).toBeDefined();
  });

  it("refuses an online session without a meeting link", async () => {
    await expect(schedule(OWNER, classroom, { meetingUrl: "   " })).rejects.toThrow(
      /Meeting link required/,
    );
  });

  it("refuses a session in a class owned by another teacher", async () => {
    await expect(schedule(OTHER_OWNER, classroom)).rejects.toThrow(/Forbidden/);
  });

  it("refuses an unknown time zone", async () => {
    await expect(schedule(OWNER, classroom, { timeZone: "Mars/Olympus" })).rejects.toThrow(
      /Invalid time zone/,
    );
  });

  it("refuses a meeting link that is not https", async () => {
    await expect(
      schedule(OWNER, classroom, { meetingUrl: "http://meet.example.com/abc" }),
    ).rejects.toThrow(/Meeting link must use https/);
  });

  it("refuses durations outside 5 to 480 minutes", async () => {
    await expect(schedule(OWNER, classroom, { duration: 4 })).rejects.toThrow(/Invalid duration/);
    await expect(schedule(OWNER, classroom, { duration: 481 })).rejects.toThrow(/Invalid duration/);
  });
});

describe("who can read sessions", () => {
  it("lets an active member read the class sessions", async () => {
    expect(await visibleSessions(STUDENT)).toBeGreaterThan(0);
  });

  it("hides the sessions from someone outside the class", async () => {
    expect(await visibleSessions(OTHER_OWNER)).toBe(0);
  });

  it("hides the sessions from a member once the class is archived", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    expect(await visibleSessions(STUDENT)).toBe(0);
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "active",
    ]);
    expect(await visibleSessions(STUDENT)).toBeGreaterThan(0);
  });

  it("refuses new sessions while the class is archived", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    await expect(schedule(OWNER, classroom)).rejects.toThrow(/Class is archived/);
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "active",
    ]);
  });
});

describe("cancelling a session", () => {
  it("keeps the session listed with status cancelled", async () => {
    const created = await schedule(OWNER, classroom, { title: "To cancel" });
    await asUser(db, OWNER, "select public.cancel_class_session($1) as x", [created!.id]);
    const r = await asUser<{ status: string }>(
      db,
      OWNER,
      "select status from public.class_sessions where id = $1",
      [created!.id],
    );
    expect(r!.status).toBe("cancelled");
  });

  it("refuses a cancel from a teacher who does not own the class", async () => {
    const created = await schedule(OWNER, classroom, { title: "Keep" });
    await expect(
      asUser(db, OTHER_OWNER, "select public.cancel_class_session($1) as x", [created!.id]),
    ).rejects.toThrow(/Forbidden/);
  });
});
