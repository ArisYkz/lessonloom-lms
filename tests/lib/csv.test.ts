import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a header and one row per record, ending with a newline", () => {
    const csv = toCsv([
      ["Name", "Joined"],
      ["Aisha", "2026-10-01"],
      ["Daniyar", "2026-10-02"],
    ]);
    expect(csv).toBe("Name,Joined\r\nAisha,2026-10-01\r\nDaniyar,2026-10-02\r\n");
  });

  it("quotes a value containing a comma", () => {
    expect(toCsv([["Saparov, Aisha"]])).toBe('"Saparov, Aisha"\r\n');
  });

  it("doubles internal quotes and wraps the value", () => {
    expect(toCsv([['Aisha "Aya" Saparova']])).toBe('"Aisha ""Aya"" Saparova"\r\n');
  });

  it("quotes a value containing a line break, so the row stays one record", () => {
    expect(toCsv([["line one\nline two"]])).toBe('"line one\nline two"\r\n');
  });

  it("keeps empty values empty rather than quoting them", () => {
    expect(toCsv([["", "x"]])).toBe(",x\r\n");
  });

  it("writes a single empty line for empty input", () => {
    expect(toCsv([])).toBe("");
  });
});
