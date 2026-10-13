import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000a7";
const OTHER_OWNER = "00000000-0000-0000-0000-0000000000a8";
const ORG = "00000000-0000-0000-0000-0000000000f7";
const COURSE = "00000000-0000-0000-0000-0000000000c7";

let db: PGlite;
let classroom: string;

function setListed(user: string, classroomId: string, listed: boolean) {
  return asUser(db, user, "select public.set_classroom_listed($1, $2) as x", [classroomId, listed]);
}

async function listedCount(): Promise<number> {
  const r = await asAnon<{ n: number }>(
    db,
    "select count(*)::int as n from public.list_public_classrooms()",
  );
  return r!.n;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${OTHER_OWNER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Listing', 'listing');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'listed-course', 'Listed course', 'subscription', 'published');
  `);
  const row = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Evening"],
  );
  classroom = row!.id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("class listing is opt-in", () => {
  it("keeps a new class out of the public listing", async () => {
    expect(await listedCount()).toBe(0);
  });

  it("lets the owner list the class", async () => {
    await setListed(OWNER, classroom, true);
    expect(await listedCount()).toBe(1);
  });

  it("returns only the safe columns, never the join code", async () => {
    const row = await asAnon<Record<string, unknown>>(
      db,
      "select * from public.list_public_classrooms() limit 1",
    );
    expect(Object.keys(row!).sort()).toEqual(
      ["classroom_id", "classroom_name", "course_id", "course_slug", "course_title"].sort(),
    );
    expect(row!.course_title).toBe("Listed course");
    expect(row!.classroom_name).toBe("Evening");
  });

  it("lets a signed-in user see the same listing", async () => {
    const r = await asUser<{ n: number }>(
      db,
      OTHER_OWNER,
      "select count(*)::int as n from public.list_public_classrooms()",
    );
    expect(r!.n).toBe(1);
  });

  it("refuses to list a class owned by another teacher", async () => {
    await expect(setListed(OTHER_OWNER, classroom, false)).rejects.toThrow(/Forbidden/);
  });

  it("lets the owner unlist the class again", async () => {
    await setListed(OWNER, classroom, false);
    expect(await listedCount()).toBe(0);
    await setListed(OWNER, classroom, true);
  });
});

describe("listing respects class and course state", () => {
  it("hides a listed class once it is archived", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "archived",
    ]);
    expect(await listedCount()).toBe(0);
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroom,
      "active",
    ]);
    expect(await listedCount()).toBe(1);
  });

  it("hides a listed class while its course is a draft", async () => {
    await db.exec(`update public.courses set status = 'draft' where id = '${COURSE}'`);
    expect(await listedCount()).toBe(0);
    await db.exec(`update public.courses set status = 'published' where id = '${COURSE}'`);
    expect(await listedCount()).toBe(1);
  });
});
