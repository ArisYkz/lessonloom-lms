import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./pglite";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const STUDENT = "00000000-0000-0000-0000-00000000000b";
const ORG = "00000000-0000-0000-0000-0000000000f1";
const COURSE = "00000000-0000-0000-0000-0000000000c1";

let db: PGlite;
let classroomId: string;

async function joinCode(): Promise<string> {
  const r = await asUser<{ c: string }>(
    db,
    OWNER,
    "select public.get_classroom_join_code($1) as c",
    [classroomId],
  );
  return r!.c;
}

async function membership(user: string) {
  const r = await db.query<{ status: string; ended_at: string | null }>(
    "select status, ended_at::text from public.classroom_memberships where classroom_id = $1 and user_id = $2",
    [classroomId, user],
  );
  return r.rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${STUDENT}');
    insert into public.organizations (id, owner_id, name, slug) values ('${ORG}', '${OWNER}', 'Org', 'org');
    insert into public.courses (id, organization_id, slug, title, price_model, status)
      values ('${COURSE}', '${ORG}', 'c', 'C', 'subscription', 'published');
  `);
  const row = await asUser<{ id: string }>(
    db,
    OWNER,
    "select public.create_classroom($1, $2) as id",
    [COURSE, "Morning"],
  );
  classroomId = row!.id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("create_classroom", () => {
  it("issues a twelve-character join code to the owner", async () => {
    expect((await joinCode()).length).toBe(12);
  });

  it("refuses to create a classroom for a course the caller does not own", async () => {
    await expect(
      asUser(db, STUDENT, "select public.create_classroom($1, $2) as id", [COURSE, "Mine"]),
    ).rejects.toThrow(/Forbidden/);
  });

  it("refuses to create a classroom for a draft course", async () => {
    await db.exec(`update public.courses set status = 'draft' where id = '${COURSE}'`);
    await expect(
      asUser(db, OWNER, "select public.create_classroom($1, $2) as id", [COURSE, "Draft"]),
    ).rejects.toThrow(/must be published/);
    await db.exec(`update public.courses set status = 'published' where id = '${COURSE}'`);
  });
});

describe("join_classroom", () => {
  it("joins with the code regardless of case and surrounding spaces", async () => {
    const code = await joinCode();
    const row = await asUser<{ id: string }>(
      db,
      STUDENT,
      "select public.join_classroom($1) as id",
      [`  ${code.toLowerCase()} `],
    );
    expect(row?.id).toBe(classroomId);
    expect((await membership(STUDENT))?.status).toBe("active");
  });

  it("rejects an unknown code", async () => {
    await expect(
      asUser(db, STUDENT, "select public.join_classroom($1) as id", ["NOSUCHCODE000"]),
    ).rejects.toThrow(/Invalid join code/);
  });

  it("is idempotent for a student who is already a member", async () => {
    const code = await joinCode();
    await asUser(db, STUDENT, "select public.join_classroom($1) as id", [code]);
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from public.classroom_memberships where classroom_id = $1 and user_id = $2",
      [classroomId, STUDENT],
    );
    expect(r.rows[0].n).toBe(1);
  });
});

describe("leave_classroom", () => {
  it("marks the membership left and keeps the row", async () => {
    await asUser(db, STUDENT, "select public.leave_classroom($1) as x", [classroomId]);
    const m = await membership(STUDENT);
    expect(m?.status).toBe("left");
    expect(m?.ended_at).not.toBeNull();
  });

  it("rejects leaving when the student is not an active member", async () => {
    await expect(
      asUser(db, STUDENT, "select public.leave_classroom($1) as x", [classroomId]),
    ).rejects.toThrow(/Not a member/);
  });

  it("reactivates the same membership when the student rejoins", async () => {
    await asUser(db, STUDENT, "select public.join_classroom($1) as id", [await joinCode()]);
    const m = await membership(STUDENT);
    expect(m?.status).toBe("active");
    expect(m?.ended_at).toBeNull();
  });
});

describe("remove_classroom_member", () => {
  it("refuses removal by anyone but the owner", async () => {
    await expect(
      asUser(db, STUDENT, "select public.remove_classroom_member($1, $2) as x", [
        classroomId,
        STUDENT,
      ]),
    ).rejects.toThrow(/Forbidden/);
  });

  it("lets the owner remove a student", async () => {
    await asUser(db, OWNER, "select public.remove_classroom_member($1, $2) as x", [
      classroomId,
      STUDENT,
    ]);
    expect((await membership(STUDENT))?.status).toBe("removed");
  });
});

describe("rotate_classroom_join_code", () => {
  it("makes the old code invalid and the new code work", async () => {
    const oldCode = await joinCode();
    const r = await asUser<{ c: string }>(
      db,
      OWNER,
      "select public.rotate_classroom_join_code($1) as c",
      [classroomId],
    );
    const newCode = r!.c;
    expect(newCode).not.toBe(oldCode);
    await expect(
      asUser(db, STUDENT, "select public.join_classroom($1) as id", [oldCode]),
    ).rejects.toThrow(/Invalid join code/);
    await expect(
      asUser(db, STUDENT, "select public.join_classroom($1) as id", [newCode]),
    ).resolves.toBeDefined();
  });
});

describe("set_classroom_status", () => {
  it("rejects an unknown status", async () => {
    await expect(
      asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
        classroomId,
        "deleted",
      ]),
    ).rejects.toThrow(/Invalid status/);
  });

  it("refuses archiving by anyone but the owner", async () => {
    await expect(
      asUser(db, STUDENT, "select public.set_classroom_status($1, $2) as x", [
        classroomId,
        "archived",
      ]),
    ).rejects.toThrow(/Forbidden/);
  });

  it("blocks joining once the classroom is archived", async () => {
    const code = await joinCode();
    await asUser(db, OWNER, "select public.set_classroom_status($1, $2) as x", [
      classroomId,
      "archived",
    ]);
    await expect(
      asUser(db, STUDENT, "select public.join_classroom($1) as id", [code]),
    ).rejects.toThrow(/Invalid join code/);
  });
});

describe("plan student limit", () => {
  const LIMIT_OWNER = "00000000-0000-0000-0000-0000000000a2";
  const LIMIT_ORG = "00000000-0000-0000-0000-0000000000f2";
  const LIMIT_COURSE = "00000000-0000-0000-0000-0000000000c2";
  const LEARNER_ONE = "00000000-0000-0000-0000-0000000000b1";
  const LEARNER_TWO = "00000000-0000-0000-0000-0000000000b2";
  const LEARNER_THREE = "00000000-0000-0000-0000-0000000000b3";
  let limitClassroom: string;

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id) values ('${LIMIT_OWNER}'), ('${LEARNER_ONE}'), ('${LEARNER_TWO}'), ('${LEARNER_THREE}');
      insert into public.organizations (id, owner_id, name, slug) values ('${LIMIT_ORG}', '${LIMIT_OWNER}', 'Limit', 'limit');
      insert into public.teacher_plans (code, name, price_kzt, max_courses, position, max_students)
        values ('tiny', 'Tiny', 0, null, 9, 2);
      insert into public.org_subscriptions (organization_id, plan_code) values ('${LIMIT_ORG}', 'tiny');
      insert into public.courses (id, organization_id, slug, title, price_model, status)
        values ('${LIMIT_COURSE}', '${LIMIT_ORG}', 'limit-course', 'Limit', 'subscription', 'published');
    `);
    const row = await asUser<{ id: string }>(
      db,
      LIMIT_OWNER,
      "select public.create_classroom($1, $2) as id",
      [LIMIT_COURSE, "Limit"],
    );
    limitClassroom = row!.id;
  }, 60_000);

  it("refuses the learner who would exceed the plan's student limit", async () => {
    const code = await asUser<{ c: string }>(
      db,
      LIMIT_OWNER,
      "select public.get_classroom_join_code($1) as c",
      [limitClassroom],
    );
    await asUser(db, LEARNER_ONE, "select public.join_classroom($1) as id", [code!.c]);
    await asUser(db, LEARNER_TWO, "select public.join_classroom($1) as id", [code!.c]);
    await expect(
      asUser(db, LEARNER_THREE, "select public.join_classroom($1) as id", [code!.c]),
    ).rejects.toThrow(/PLAN_STUDENT_LIMIT/);
  });
});
