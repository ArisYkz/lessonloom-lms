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
};

export function SessionRow({
  title,
  startsAt,
  durationMinutes,
  classroomName,
  meetingUrl,
  cancelled,
}: SessionRowProps) {
  const { t, locale } = useI18n();
  const time = formatTimeRange(startsAt, durationMinutes, viewerTimeZone(), locale);

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
