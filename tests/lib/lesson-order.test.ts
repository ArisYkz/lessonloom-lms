import { describe, expect, it } from "vitest";
import { firstLessonToOpen } from "@/lib/lesson-order";

const lessons = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("firstLessonToOpen", () => {
  it("opens the first lesson when nothing is finished", () => {
    expect(firstLessonToOpen(lessons, new Set())?.id).toBe("a");
  });

  it("resumes at the first unfinished lesson", () => {
    expect(firstLessonToOpen(lessons, new Set(["a"]))?.id).toBe("b");
    expect(firstLessonToOpen(lessons, new Set(["a", "b"]))?.id).toBe("c");
  });

  it("ignores finished lessons the learner can no longer see", () => {
    // "z" was completed but is not in this course's visible list.
    expect(firstLessonToOpen(lessons, new Set(["z"]))?.id).toBe("a");
  });

  it("falls back to the first lesson when every lesson is finished", () => {
    expect(firstLessonToOpen(lessons, new Set(["a", "b", "c"]))?.id).toBe("a");
  });

  it("returns null for a course with no lessons", () => {
    expect(firstLessonToOpen([], new Set())).toBeNull();
  });
});
