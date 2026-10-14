import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimeRange, viewerTimeZone } from "@/lib/calendar";
import { useI18n } from "@/i18n/provider";

type SessionRowProps = {
  title: string;
  startsAt: string;
  durationMinutes: number;
  classroomName: string;
  format: string;
  meetingUrl: string | null;
  location: string | null;
  cancelled: boolean;
  attendees?: { avatarUrl: string | null }[] | undefined;
};

const STACK_LIMIT = 5;
const JOIN_OPENS_BEFORE_MS = 15 * 60_000;

export function joinWindow(startsAt: string, durationMinutes: number, now = Date.now()) {
  const startMs = new Date(startsAt).getTime();
  if (now < startMs - JOIN_OPENS_BEFORE_MS) return "upcoming" as const;
  if (now > startMs + durationMinutes * 60_000) return "ended" as const;
  return "open" as const;
}

export function SessionRow({
  title,
  startsAt,
  durationMinutes,
  classroomName,
  format,
  meetingUrl,
  location,
  cancelled,
  attendees,
}: SessionRowProps) {
  const { t, locale } = useI18n();
  const time = formatTimeRange(startsAt, durationMinutes, viewerTimeZone(), locale);
  const shown = (attendees ?? []).slice(0, STACK_LIMIT);
  const extra = (attendees?.length ?? 0) - shown.length;
  const where = format === "in_person" ? location : null;
  const window = joinWindow(startsAt, durationMinutes);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 ${cancelled ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">
          {time} · {classroomName}
          {where ? ` · ${where}` : null}
        </p>
      </div>
      {shown.length > 0 ? (
        <div className="flex items-center" title={t("calendar.whoIsComing")}>
          <div className="flex -space-x-2">
            {shown.map((a, i) => (
              <Avatar key={i} className="size-7 border-2 border-card">
                {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt="" /> : null}
                <AvatarFallback>
                  <User className="size-3.5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {extra > 0 ? <span className="ml-2 text-xs text-muted-foreground">+{extra}</span> : null}
        </div>
      ) : null}
      {cancelled ? (
        <Badge variant="outline">{t("session.cancelled")}</Badge>
      ) : meetingUrl && window === "open" ? (
        <Button asChild size="sm" variant="outline">
          <a href={meetingUrl} target="_blank" rel="noreferrer">
            {t("session.join")}
          </a>
        </Button>
      ) : meetingUrl && window === "upcoming" ? (
        <p className="text-xs text-muted-foreground">{t("session.linkOpens")}</p>
      ) : null}
    </div>
  );
}
