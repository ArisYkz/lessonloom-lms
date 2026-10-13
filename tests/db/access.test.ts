import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const STUDENT = "00000000-0000-0000-0000-00000000000b";
const STRANGER = "00000000-0000-0000-0000-00000000000c";
const ADMIN = "00000000-0000-0000-0000-00000000000d";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const COURSE = "00000000-0000-0000-0000-0000000000c1";

const ACCESS = "select public.has_course_access($1::uuid, $2::uuid) as v";
const ROLE = "select public.has_role($1::uuid, 'admin'::app_role) as v";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${STUDENT}'), ('${STRANGER}'), ('${ADMIN}');
    insert into public.organizations (id, owner_id, name, slug) values ('${ORG}', '${OWNER}', 'Org', 'org');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'course', 'Course', 'free', 'published');
    insert into public.enrollments (user_id, course_id) values ('${STUDENT}', '${COURSE}');
    insert into public.user_roles (user_id, role) values ('${ADMIN}', 'admin');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("has_course_access", () => {
  it("answers for the caller's own access", async () => {
    expect(await asUser(db, STUDENT, ACCESS, [COURSE, STUDENT])).toEqual({ v: true });
    expect(await asUser(db, OWNER, ACCESS, [COURSE, OWNER])).toEqual({ v: true });
    expect(await asUser(db, STRANGER, ACCESS, [COURSE, STRANGER])).toEqual({ v: false });
  });

  it("does not reveal another user's access", async () => {
    expect(await asUser(db, STRANGER, ACCESS, [COURSE, STUDENT])).toEqual({ v: false });
  });

  it("is not executable by anon", async () => {
    await expect(asAnon(db, ACCESS, [COURSE, STUDENT])).rejects.toThrow(/permission denied/);
  });
});

describe("has_role", () => {
  it("answers for the caller's own roles", async () => {
    expect(await asUser(db, ADMIN, ROLE, [ADMIN])).toEqual({ v: true });
  });

  it("does not reveal another user's roles", async () => {
    expect(await asUser(db, STRANGER, ROLE, [ADMIN])).toEqual({ v: false });
    expect(await asUser(db, STUDENT, ROLE, [ADMIN])).toEqual({ v: false });
  });
});
