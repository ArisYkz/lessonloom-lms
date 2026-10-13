import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./pglite";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

describe("teacher plan student limit", () => {
  it("starter (free) plan allows 3 students", async () => {
    const r = await db.query<{ max_students: number | null }>(
      "select max_students from public.teacher_plans where code = 'starter'",
    );
    expect(r.rows[0].max_students).toBe(3);
  });
});
