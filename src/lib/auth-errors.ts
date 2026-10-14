import type { Dict } from "@/i18n/dictionary";

// Supabase answers in English. Map the ones a learner actually hits; anything else falls
// back to the generic message rather than showing provider text in a trilingual UI.
const KNOWN: [string, keyof Dict][] = [
  ["Invalid login credentials", "auth.errCredentials"],
  ["Email not confirmed", "auth.errNotConfirmed"],
  ["User already registered", "auth.errRegistered"],
  ["known to be weak", "auth.errWeakPassword"],
  ["Password should be at least", "auth.errWeakPassword"],
];

export function authErrorKey(err: unknown): keyof Dict {
  const message = err instanceof Error ? err.message : "";
  return KNOWN.find(([text]) => message.includes(text))?.[1] ?? "common.error";
}
