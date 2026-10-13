import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000b1";
const STUDENT_A = "00000000-0000-0000-0000-0000000000b2";
const STUDENT_B = "00000000-0000-0000-0000-0000000000b3";
const OUTSIDER = "00000000-0000-0000-0000-0000000000b4";
const ORG = "00000000-0000-0000-0000-0000000000f9";
const COURSE = "00000000-0000-0000-0000-0000000000c9";

let db: PGlite;
let classroom: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${STUDENT_A}'), ('${STUDENT_B}'), ('${OUTSIDER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'People Org', 'people-org');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'people-course', 'People course', 'subscription', 'published');
  `);
  const created = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "People class"],
  );
  classroom = created!.id;
  const code = await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroom],
  );
  await asUser(db, STUDENT_A, "select public.join_classroom($1) as id", [code!.c]);
  await asUser(db, STUDENT_B, "select public.join_classroom($1) as id", [code!.c]);
  await db.exec(`
    update public.profiles set avatar_url = 'avatars/a.png' where id = '${STUDENT_A}';
    update public.profiles set avatar_url = 'avatars/b.png', show_photo_to_classmates = false where id = '${STUDENT_B}';
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("list_my_classes", () => {
  it("returns the class with member photos, hiding photos that are switched off", async () => {
    const row = await asUser<{ classroom_name: string; members: { avatarPath: string | null }[] }>(
      db,
      STUDENT_A,
      "select classroom_name, members from public.list_my_classes()",
    );
    expect(row?.classroom_name).toBe("People class");
    expect(row?.members.map((m) => m.avatarPath)).toEqual(["avatars/a.png", null]);
  });

  it("returns nothing to someone who is not a member", async () => {
    const row = await asUser(db, OUTSIDER, "select classroom_id from public.list_my_classes()");
    expect(row).toBeUndefined();
  });
});

describe("owned_org_learner_count", () => {
  it("counts the active learners for the owner", async () => {
    const row = await asUser<{ n: string }>(
      db,
      OWNER,
      "select public.owned_org_learner_count($1) as n",
      [ORG],
    );
    expect(Number(row!.n)).toBe(2);
  });

  it("hides the count from anyone who does not own the organization", async () => {
    const row = await asUser<{ n: string | null }>(
      db,
      STUDENT_A,
      "select public.owned_org_learner_count($1) as n",
      [ORG],
    );
    expect(row!.n).toBeNull();
  });
});

describe("public classroom listing", () => {
  it("includes the course slug for a listed class", async () => {
    await asUser(db, OWNER, "select public.set_classroom_listed($1, true)", [classroom]);
    const row = await asAnon<{ course_slug: string }>(
      db,
      "select course_slug from public.list_public_classrooms()",
    );
    expect(row?.course_slug).toBe("people-course");
  });
});
