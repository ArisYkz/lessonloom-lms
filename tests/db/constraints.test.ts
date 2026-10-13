import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const LEARNER = "00000000-0000-0000-0000-00000000000b";
const GHOST = "00000000-0000-0000-0000-0000000000ff";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const COURSE = "00000000-0000-0000-0000-0000000000c1";
const PUBLISHED = "00000000-0000-0000-0000-0000000000c2";
const SECTION = "00000000-0000-0000-0000-0000000000a1";
const LESSON = "00000000-0000-0000-0000-0000000000a2";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${LEARNER}');
    insert into public.organizations (id, owner_id, name, slug)
      values ('${ORG}', '${OWNER}', 'Org', 'org');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'draft', 'Draft', 'free', 'draft'),
      ('${PUBLISHED}', '${ORG}', 'live', 'Live', 'free', 'published');
    insert into public.sections (id, course_id, title) values ('${SECTION}', '${COURSE}', 'S');
    insert into public.lessons (id, section_id, course_id, title)
      values ('${LESSON}', '${SECTION}', '${COURSE}', 'L');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("value checks", () => {
  it("rejects an unsupported preferred locale", async () => {
    await expect(
      db.exec(`update public.profiles set preferred_locale = 'fr' where id = '${LEARNER}';`),
    ).rejects.toThrow(/profiles_preferred_locale_check/);
  });

  it("accepts a supported preferred locale", async () => {
    await expect(
      db.exec(`update public.profiles set preferred_locale = 'kk' where id = '${LEARNER}';`),
    ).resolves.not.toThrow();
  });

  it("rejects a danmaku color that is not a six-digit hex value", async () => {
    await expect(
      db.exec(`
        insert into public.danmaku (lesson_id, course_id, user_id, time_ms, text, color)
        values ('${LESSON}', '${COURSE}', '${LEARNER}', 0, 'hi', 'red');
      `),
    ).rejects.toThrow(/danmaku_color_check/);
  });

  it("rejects an unknown danmaku mode", async () => {
    await expect(
      db.exec(`
        insert into public.danmaku (lesson_id, course_id, user_id, time_ms, text, mode)
        values ('${LESSON}', '${COURSE}', '${LEARNER}', 0, 'hi', 'spin');
      `),
    ).rejects.toThrow(/danmaku_mode_check/);
  });

  it("accepts a valid danmaku row", async () => {
    await expect(
      db.exec(`
        insert into public.danmaku (lesson_id, course_id, user_id, time_ms, text, color, mode)
        values ('${LESSON}', '${COURSE}', '${LEARNER}', 0, 'hi', '#A1b2C3', 'top');
      `),
    ).resolves.not.toThrow();
  });
});

describe("user references", () => {
  it("rejects a danmaku row from a user that does not exist", async () => {
    await expect(
      db.exec(`
        insert into public.danmaku (lesson_id, course_id, user_id, time_ms, text)
        values ('${LESSON}', '${COURSE}', '${GHOST}', 0, 'ghost');
      `),
    ).rejects.toThrow(/danmaku_user_auth_fkey/);
  });

  it("rejects a discussion thread from a user that does not exist", async () => {
    await expect(
      db.exec(`
        insert into public.discussion_threads (lesson_id, course_id, user_id, body)
        values ('${LESSON}', '${COURSE}', '${GHOST}', 'ghost');
      `),
    ).rejects.toThrow(/discussion_threads_user_auth_fkey/);
  });
});

describe("free enrollment", () => {
  it("enrolls once and reports already_enrolled on repeat", async () => {
    const first = await asUser<{ r: string }>(
      db,
      LEARNER,
      "select public.enroll_free_course($1, $2) as r",
      [PUBLISHED, LEARNER],
    );
    const second = await asUser<{ r: string }>(
      db,
      LEARNER,
      "select public.enroll_free_course($1, $2) as r",
      [PUBLISHED, LEARNER],
    );
    expect(first?.r).toBe("enrolled");
    expect(second?.r).toBe("already_enrolled");
  });

  it("locks the organization row before counting students", async () => {
    const r = await db.query<{ def: string }>(
      "select pg_get_functiondef('public.enroll_free_course(uuid,uuid)'::regprocedure) as def",
    );
    expect(r.rows[0].def).toMatch(/from public\.organizations[\s\S]*for update/i);
  });
});
