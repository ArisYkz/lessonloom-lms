import type { Dict } from "@/i18n/dictionary";

const KNOWN_CODES = new Set(["INVALID_JOIN_CODE", "PLAN_STUDENT_LIMIT"]);

export function classroomErrorKey(err: unknown): keyof Dict {
  const code = err instanceof Error ? err.message : "";
  return (KNOWN_CODES.has(code) ? `classroom.${code}` : "classroom.error") as keyof Dict;
}
