import { describe, expect, it } from "vitest";
import {
  dateKey,
  formatDateKey,
  formatTimeRange,
  shiftDateKey,
  weekDayKeys,
  weekStartKey,
} from "@/lib/calendar";

describe("dateKey", () => {
  it("uses the viewer's time zone, so a late session can fall on the next day", () => {
    const d = new Date("2026-10-13T20:00:00Z");
    expect(dateKey(d, "UTC")).toBe("2026-10-13");
    expect(dateKey(d, "Asia/Almaty")).toBe("2026-10-14");
  });
});

describe("week helpers", () => {
  it("finds the Monday that starts the week", () => {
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12");
    expect(weekStartKey("2026-10-12")).toBe("2026-10-12");
  });

  it("lists seven days from Monday to Sunday", () => {
    const days = weekDayKeys("2026-10-12");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-12");
    expect(days[6]).toBe("2026-10-18");
  });

  it("moves across month and year boundaries", () => {
    expect(shiftDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formatting", () => {
  it("shows a session's start and end in the given zone", () => {
    expect(formatTimeRange("2026-11-01T05:00:00Z", 60, "Asia/Almaty", "en")).toBe("10:00–11:00");
  });

  it("formats a day key without shifting it", () => {
    expect(formatDateKey("2026-10-13", "en", { day: "numeric", month: "long" })).toBe("October 13");
  });
});
