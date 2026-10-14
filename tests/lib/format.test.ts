import { describe, expect, it } from "vitest";
import { formatNumber } from "@/lib/format";

describe("formatNumber", () => {
  it("groups thousands the way each locale does", () => {
    // ru/kk use a space, en uses a comma.
    expect(formatNumber(15300, "ru")).not.toContain(",");
    expect(formatNumber(15300, "en")).toBe("15,300");
  });

  it("leaves small numbers unchanged", () => {
    expect(formatNumber(0, "ru")).toBe("0");
    expect(formatNumber(7, "en")).toBe("7");
  });
});
