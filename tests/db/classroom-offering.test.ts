import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000d1";
const STUDENT_A = "00000000-0000-0000-0000-0000000000d2";
const STUDENT_B = "00000000-0000-0000-0000-0000000000d3";
const STUDENT_C = "00000000-0000-0000-0000-0000000000d4";
const STUDENT_D = "00000000-0000-0000-0000-0000000000d5";
const ORG = "00000000-0000-0000-0000-0000000000fa";
const COURSE = "00000000-0000-0000-0000-0000000000ca";

let db: PGlite;
let open: string;
let full: string;
let openCode: string;
let fullCode: string;

async function joinCode(classroom: string): Promise<string> {
  const row = await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroom],
  );
  return row!.c;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values
      ('${OWNER}'), ('${STUDENT_A}'), ('${STUDENT_B}'), ('${STUDENT_C}'), ('${STUDENT_D}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Offering Org', 'offering-org');
    insert into public.org_subscriptions (organization_id, plan_code) values ('${ORG}', 'pro');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'offering-course', 'Offering course', 'subscription', 'published');
  `);

  open = (await asUser<{ id: string }>(db, OWNER, "select public.create_classroom($1, $2) as id", [
    COURSE,
    "Open class",
  ]))!.id;
  full = (await asUser<{ id: string }>(db, OWNER, "select public.create_classroom($1, $2) as id", [
    COURSE,
    "Full class",
  ]))!.id;
  openCode = await joinCode(open);
  fullCode = await joinCode(full);

  await asUser(db, OWNER, "select public.set_classroom_offering($1, null, null, 1, null, true)", [
    full,
  ]);
  await asUser(db, STUDENT_C, "select public.join_classroom($1) as id", [fullCode]);
  await asUser(db, STUDENT_A, "select public.join_classroom($1) as id", [openCode]);
  await asUser(db, STUDENT_B, "select public.join_classroom($1) as id", [openCode]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("set_classroom_offering", () => {
  it("stores the offering for the owner", async () => {
    await asUser(
      db,
      OWNER,
      "select public.set_classroom_offering($1, $2::date, $3::date, 10, 5000, true)",
      [open, "2026-11-01", "2026-12-31"],
    );
    const row = await asUser<{ capacity: number; price_kzt: number; start_date: string }>(
      db,
      OWNER,
      "select capacity, price_kzt, start_date::text as start_date from public.classrooms where id = $1",
      [open],
    );
    expect(row).toMatchObject({ capacity: 10, price_kzt: 5000, start_date: "2026-11-01" });
  });

  it("refuses anyone who does not own the class", async () => {
    await expect(
      asUser(
        db,
        STUDENT_A,
        "select public.set_classroom_offering($1, null, null, null, null, true)",
        [open],
      ),
    ).rejects.toThrow("Forbidden");
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      asUser(
        db,
        OWNER,
        "select public.set_classroom_offering($1, $2::date, $3::date, null, null, true)",
        [open, "2026-12-31", "2026-11-01"],
      ),
    ).rejects.toThrow("Invalid dates");
  });

  it("rejects a capacity outside 1 to 500", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_offering($1, null, null, 0, null, true)", [
        open,
      ]),
    ).rejects.toThrow("Invalid capacity");
  });

  it("rejects a negative price", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_offering($1, null, null, null, -1, true)", [
        open,
      ]),
    ).rejects.toThrow("Invalid price");
  });

  it("refuses a capacity below the current number of members", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_offering($1, null, null, 1, null, true)", [
        open,
      ]),
    ).rejects.toThrow("Capacity below current members");
  });
});

describe("join_classroom with capacity and enrollment", () => {
  it("refuses a learner once the class is full", async () => {
    await expect(
      asUser(db, STUDENT_D, "select public.join_classroom($1) as id", [fullCode]),
    ).rejects.toThrow("Class is full");
  });

  it("stops new learners while enrollment is closed, but keeps existing members in", async () => {
    await asUser(
      db,
      OWNER,
      "select public.set_classroom_offering($1, null, null, 10, 5000, false)",
      [open],
    );
    await expect(
      asUser(db, STUDENT_D, "select public.join_classroom($1) as id", [openCode]),
    ).rejects.toThrow("Enrollment is closed");

    const again = await asUser<{ id: string }>(
      db,
      STUDENT_A,
      "select public.join_classroom($1) as id",
      [openCode],
    );
    expect(again?.id).toBe(open);
  });
});

describe("create_class_session format", () => {
  const create = (params: unknown[]) =>
    asUser<{ id: string }>(
      db,
      OWNER,
      "select public.create_class_session($1, $2, $3, $4, $5, $6, $7, $8) as id",
      params,
    );

  const starts = "2026-11-05T10:00:00Z";

  it("requires a meeting link for online sessions", async () => {
    await expect(create([open, "Online", starts, 60, "UTC", "", "online", null])).rejects.toThrow(
      "Meeting link required",
    );
  });

  it("requires https for online meeting links", async () => {
    await expect(
      create([open, "Online", starts, 60, "UTC", "http://meet.example/x", "online", null]),
    ).rejects.toThrow("Meeting link must use https");
  });

  it("requires a location for in-person sessions", async () => {
    await expect(
      create([open, "Room", starts, 60, "UTC", null, "in_person", "  "]),
    ).rejects.toThrow("Location required");
  });

  it("rejects an unknown format", async () => {
    await expect(create([open, "Hybrid", starts, 60, "UTC", null, "hybrid", null])).rejects.toThrow(
      "Invalid format",
    );
  });

  it("stores an in-person session with a location and no meeting link", async () => {
    const created = await create([
      open,
      "Room",
      starts,
      60,
      "UTC",
      "https://meet.example/ignored",
      "in_person",
      " Room 204 ",
    ]);
    const row = await asUser<{ format: string; location: string; meeting_url: string | null }>(
      db,
      OWNER,
      "select format, location, meeting_url from public.class_sessions where id = $1",
      [created!.id],
    );
    expect(row).toEqual({ format: "in_person", location: "Room 204", meeting_url: null });
  });

  it("stores an online session with a link and no location", async () => {
    const created = await create([
      open,
      "Online",
      starts,
      60,
      "UTC",
      "https://meet.example/room",
      "online",
      "Ignored room",
    ]);
    const row = await asUser<{ format: string; location: string | null; meeting_url: string }>(
      db,
      OWNER,
      "select format, location, meeting_url from public.class_sessions where id = $1",
      [created!.id],
    );
    expect(row).toEqual({
      format: "online",
      location: null,
      meeting_url: "https://meet.example/room",
    });
  });
});
