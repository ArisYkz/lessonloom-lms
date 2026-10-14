import { describe, expect, it } from "vitest";
import { pickHomeworkToShow, type HomeworkDueEntry } from "@/lib/homework-due";

const now = new Date("2026-10-14T12:00:00Z");

function entry(homeworkId: string, dueAt: string, title = homeworkId): HomeworkDueEntry {
  return { homeworkId, title, dueAt };
}

describe("pickHomeworkToShow", () => {
  it("shows the next upcoming homework when nothing is overdue", () => {
    const result = pickHomeworkToShow(
      [entry("a", "2026-10-20T12:00:00Z"), entry("b", "2026-10-16T12:00:00Z")],
      new Set(),
      now,
    );
    expect(result).toMatchObject({ homeworkId: "b", overdue: false });
  });

  it("prefers overdue work over upcoming work", () => {
    const result = pickHomeworkToShow(
      [entry("a", "2026-10-20T12:00:00Z"), entry("b", "2026-10-10T12:00:00Z")],
      new Set(),
      now,
    );
    expect(result).toMatchObject({ homeworkId: "b", overdue: true });
  });

  it("shows the most recently missed homework when several are overdue", () => {
    const result = pickHomeworkToShow(
      [entry("old", "2026-09-01T12:00:00Z"), entry("recent", "2026-10-13T12:00:00Z")],
      new Set(),
      now,
    );
    expect(result).toMatchObject({ homeworkId: "recent", overdue: true });
  });

  it("counts a submitted homework as done, so it stops being overdue", () => {
    const result = pickHomeworkToShow(
      [entry("a", "2026-10-10T12:00:00Z"), entry("b", "2026-10-20T12:00:00Z")],
      new Set(["a"]),
      now,
    );
    expect(result).toMatchObject({ homeworkId: "b", overdue: false });
  });

  it("shows nothing when the past work is submitted and nothing is upcoming", () => {
    const result = pickHomeworkToShow([entry("a", "2026-10-10T12:00:00Z")], new Set(["a"]), now);
    expect(result).toBeNull();
  });

  it("shows nothing for a course with no homework", () => {
    expect(pickHomeworkToShow([], new Set(), now)).toBeNull();
  });
});
