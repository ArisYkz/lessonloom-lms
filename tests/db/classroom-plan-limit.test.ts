import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-0000000000a5";
const PRO_OWNER = "00000000-0000-0000-0000-0000000000a6";
const ORG = "00000000-0000-0000-0000-0000000000f5";
const PRO_ORG = "00000000-0000-0000-0000-0000000000f6";
const COURSE = "00000000-0000-0000-0000-0000000000c5";
const PRO_COURSE = "00000000-0000-0000-0000-0000000000c6";

let db: PGlite;

async function createClass(user: string, course: string, name: string): Promise<string> {
  const row = await asUser<{ id: string }>(
    db,
    user,
    "select public.create_classroom($1, $2) as id",
    [course, name],
  );
  return row!.id;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${PRO_OWNER}');
    insert into public.organizations (id, owner_id, name, slug) values
      ('${ORG}', '${OWNER}', 'Starter Org', 'starter-org'),
      ('${PRO_ORG}', '${PRO_OWNER}', 'Pro Org', 'pro-org');
    insert into public.org_subscriptions (organization_id, plan_code) values ('${PRO_ORG}', 'pro');
    insert into public.courses (id, organization_id, slug, title, price_model, status) values
      ('${COURSE}', '${ORG}', 'plan-limit', 'Plan limit', 'subscription', 'published'),
      ('${PRO_COURSE}', '${PRO_ORG}', 'plan-limit-pro', 'Plan limit pro', 'subscription', 'published');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("starter plan active class limit", () => {
  let first: string;

  it("allows the first active class", async () => {
    first = await createClass(OWNER, COURSE, "First");
    expect(first).toBeTruthy();
  });

  it("refuses a second active class", async () => {
    await expect(createClass(OWNER, COURSE, "Second")).rejects.toThrow("PLAN_CLASS_LIMIT");
  });

  it("allows a new class once the first is archived", async () => {
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [first, "archived"]);
    const second = await createClass(OWNER, COURSE, "Second");
    expect(second).toBeTruthy();
  });

  it("refuses reactivating an archived class while another is active", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [first, "active"]),
    ).rejects.toThrow("PLAN_CLASS_LIMIT");
  });

  it("allows archiving while at the limit", async () => {
    const active = await asUser<{ id: string }>(
      db,
      OWNER,
      "select id from public.classrooms where organization_id = $1 and status = 'active'",
      [ORG],
    );
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      active!.id,
      "archived",
    ]);
    const count = await asUser<{ n: number }>(
      db,
      OWNER,
      "select count(*)::int as n from public.classrooms where organization_id = $1 and status = 'active'",
      [ORG],
    );
    expect(count!.n).toBe(0);
  });
});

describe("pro plan has no active class limit", () => {
  it("allows several active classes", async () => {
    await createClass(PRO_OWNER, PRO_COURSE, "One");
    await createClass(PRO_OWNER, PRO_COURSE, "Two");
    const count = await asUser<{ n: number }>(
      db,
      PRO_OWNER,
      "select count(*)::int as n from public.classrooms where organization_id = $1 and status = 'active'",
      [PRO_ORG],
    );
    expect(count!.n).toBe(2);
  });
});
