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
  meetingUrl: string | null;
  cancelled: boolean;
  attendees?: { avatarUrl: string | null }[] | undefined;
};

const STACK_LIMIT = 5;

export function SessionRow({
  title,
  startsAt,
  durationMinutes,
  classroomName,
  meetingUrl,
  cancelled,
  attendees,
}: SessionRowProps) {
  const { t, locale } = useI18n();
  const time = formatTimeRange(startsAt, durationMinutes, viewerTimeZone(), locale);
  const shown = (attendees ?? []).slice(0, STACK_LIMIT);
  const extra = (attendees?.length ?? 0) - shown.length;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 ${cancelled ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">
          {time} · {classroomName}
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
      ) : meetingUrl ? (
        <Button asChild size="sm" variant="outline">
          <a href={meetingUrl} target="_blank" rel="noreferrer">
            {t("session.join")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
