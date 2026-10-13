export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function dateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekStartKey(key: string): string {
  const [y, m, d] = parseKey(key);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftDateKey(key, -((weekday + 6) % 7));
}

export function weekDayKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(startKey, i));
}

export function formatDateKey(key: string, locale: string, options: Intl.DateTimeFormatOptions) {
  const [y, m, d] = parseKey(key);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

export function formatTimeRange(
  startsAt: string,
  durationMinutes: number,
  timeZone: string,
  locale: string,
): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const format = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${format.format(start)}–${format.format(end)}`;
}
