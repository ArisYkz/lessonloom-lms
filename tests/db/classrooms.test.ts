import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const OTHER_OWNER = "00000000-0000-0000-0000-00000000000e";
const STUDENT = "00000000-0000-0000-0000-00000000000b";
const OTHER_STUDENT = "00000000-0000-0000-0000-00000000000d";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const OTHER_ORG = "00000000-0000-0000-0000-0000000000f3";
const COURSE = "00000000-0000-0000-0000-0000000000c1";
const OTHER_COURSE = "00000000-0000-0000-0000-0000000000c3";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${OTHER_OWNER}'), ('${STUDENT}'), ('${OTHER_STUDENT}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Org', 'org'),
      ('${OTHER_ORG}', '${OTHER_OWNER}', 'Other', 'other');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'c', 'C', 'subscription', 'published'),
      ('${OTHER_COURSE}', '${OTHER_ORG}', 'd', 'D', 'subscription', 'published');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("classroom keys", () => {
  it("rejects a classroom whose course belongs to another organization", async () => {
    await expect(
      db.exec(`
        insert into public.classrooms (organization_id, course_id, name, join_code)
        values ('${ORG}', '${OTHER_COURSE}', 'x', 'CODE0000001');
      `),
    ).rejects.toThrow(/classrooms_course_organization_fkey/);
  });
});

describe("classroom reads", () => {
  it("hides the join code column from table reads", async () => {
    await db.exec(`
      insert into public.classrooms (organization_id, course_id, name, join_code)
      values ('${ORG}', '${COURSE}', 'Morning', 'CODE0000002');
    `);
    await expect(
      asUser(db, OWNER, "select join_code from public.classrooms where name = 'Morning'"),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets the owner read their own classroom", async () => {
    const row = await asUser<{ name: string }>(
      db,
      OWNER,
      "select name from public.classrooms where name = 'Morning'",
    );
    expect(row?.name).toBe("Morning");
  });

  it("does not show a classroom to users outside it", async () => {
    const row = await asUser(
      db,
      OTHER_STUDENT,
      "select id from public.classrooms where name = 'Morning'",
    );
    expect(row).toBeUndefined();
  });

  it("blocks direct inserts into memberships", async () => {
    await expect(
      asUser(
        db,
        STUDENT,
        "insert into public.classroom_memberships (classroom_id, user_id) select id, $1 from public.classrooms limit 1",
        [STUDENT],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
