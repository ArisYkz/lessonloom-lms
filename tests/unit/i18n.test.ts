import { describe, expect, it } from "vitest";
import { dictionaries, type Dict, type Locale } from "@/i18n/dictionary";

const locales = Object.keys(dictionaries) as Locale[];
const keys = Object.keys(dictionaries.en) as (keyof Dict)[];

describe("translations", () => {
  it.each(locales)("%s has a non-empty string for every key", (locale) => {
    const empty = keys.filter((key) => {
      const value = dictionaries[locale][key];
      return typeof value !== "string" || value.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});
