import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const ORG_LIMITED = "00000000-0000-0000-0000-0000000000f1";
const ORG_PRO = "00000000-0000-0000-0000-0000000000f2";
const COURSE_A = "00000000-0000-0000-0000-0000000000c1";
const COURSE_B = "00000000-0000-0000-0000-0000000000c2";
const SECTION_A = "00000000-0000-0000-0000-0000000000a1";
const SECTION_B = "00000000-0000-0000-0000-0000000000b1";
const LESSON_A = "00000000-0000-0000-0000-0000000000a2";

let db: PGlite;

async function insertCourse(org: string, slug: string) {
  await db.exec(`
    insert into public.courses (organization_id, slug, title, price_model, status)
    values ('${org}', '${slug}', '${slug}', 'free', 'draft');
  `);
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}');
    insert into public.organizations (id, owner_id, name, slug)
      values ('${ORG_LIMITED}', '${OWNER}', 'Limited', 'limited'),
             ('${ORG_PRO}', '${OWNER}', 'Pro', 'pro');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE_A}', '${ORG_LIMITED}', 'course-a', 'A', 'free', 'draft'),
      ('${COURSE_B}', '${ORG_LIMITED}', 'course-b', 'B', 'free', 'draft');
    insert into public.sections (id, course_id, title) values
      ('${SECTION_A}', '${COURSE_A}', 'A1'),
      ('${SECTION_B}', '${COURSE_B}', 'B1');
    insert into public.lessons (id, section_id, course_id, title) values
      ('${LESSON_A}', '${SECTION_A}', '${COURSE_A}', 'A1.1');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("course plan limit", () => {
  it("allows the starter plan's three courses and blocks the fourth", async () => {
    await insertCourse(ORG_PRO, "pro-1");
    await insertCourse(ORG_PRO, "pro-2");
    await insertCourse(ORG_PRO, "pro-3");
    await expect(insertCourse(ORG_PRO, "pro-4")).rejects.toThrow("PLAN_LIMIT");
  });

  it("lifts the limit when the organization has an active Pro subscription", async () => {
    await db.exec(`
      insert into public.org_subscriptions (organization_id, plan_code, status)
      values ('${ORG_PRO}', 'pro', 'ACTIVE');
    `);
    await insertCourse(ORG_PRO, "pro-4");
    await insertCourse(ORG_PRO, "pro-5");
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from public.courses where organization_id = '${ORG_PRO}'`,
    );
    expect(r.rows[0].n).toBe(5);
  });
});

describe("same-course child rows", () => {
  it("accepts a lesson in the section's own course", async () => {
    await expect(
      db.exec(`
        insert into public.lessons (section_id, course_id, title)
        values ('${SECTION_A}', '${COURSE_A}', 'A1.2');
      `),
    ).resolves.not.toThrow();
  });

  it("rejects a lesson whose section belongs to another course", async () => {
    await expect(
      db.exec(`
        insert into public.lessons (section_id, course_id, title)
        values ('${SECTION_B}', '${COURSE_A}', 'cross');
      `),
    ).rejects.toThrow(/lessons_section_same_course_fkey/);
  });

  it("rejects a lesson resource attached to another course's lesson", async () => {
    await expect(
      db.exec(`
        insert into public.lesson_resources (lesson_id, course_id, title, media_path)
        values ('${LESSON_A}', '${COURSE_B}', 'r', 'p');
      `),
    ).rejects.toThrow(/lesson_resources_lesson_same_course_fkey/);
  });
});
