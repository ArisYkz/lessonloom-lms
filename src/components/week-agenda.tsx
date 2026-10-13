import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import {
  dateKey,
  formatDateKey,
  shiftDateKey,
  viewerTimeZone,
  weekDayKeys,
  weekStartKey,
} from "@/lib/calendar";

type WeekAgendaProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  getStartsAt: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};

export function WeekAgenda<T>({ items, getKey, getStartsAt, renderItem }: WeekAgendaProps<T>) {
  const { t, locale } = useI18n();
  const timeZone = viewerTimeZone();
  const todayKey = dateKey(new Date(), timeZone);
  const [weekStart, setWeekStart] = useState(() => weekStartKey(todayKey));

  const days = useMemo(() => {
    const keys = weekDayKeys(weekStart);
    const byDay = new Map<string, T[]>(keys.map((key) => [key, []]));
    for (const item of items) {
      byDay.get(dateKey(new Date(getStartsAt(item)), timeZone))?.push(item);
    }
    return keys.map((key) => ({ key, items: byDay.get(key) ?? [] }));
  }, [items, weekStart, getStartsAt, timeZone]);

  const first = weekStart;
  const last = shiftDateKey(weekStart, 6);
  const weekIsEmpty = days.every((day) => day.items.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.prev")}
            onClick={() => setWeekStart(shiftDateKey(weekStart, -7))}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartKey(todayKey))}>
            {t("calendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.next")}
            onClick={() => setWeekStart(shiftDateKey(weekStart, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateKey(first, locale, { day: "numeric", month: "short" })} –{" "}
          {formatDateKey(last, locale, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {weekIsEmpty ? (
        <p className="text-sm text-muted-foreground">{t("calendar.weekEmpty")}</p>
      ) : null}

      <div className="space-y-5">
        {days.map((day) => (
          <section key={day.key} className="space-y-2">
            <h2
              className={
                day.key === todayKey
                  ? "text-sm font-semibold text-primary"
                  : "text-sm font-semibold text-foreground"
              }
            >
              {formatDateKey(day.key, locale, { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            {day.items.length > 0 ? (
              <ul className="space-y-2">
                {day.items.map((item) => (
                  <li key={getKey(item)}>{renderItem(item)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
