import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationsRead } from "@/lib/activity.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => fetchList(), refetchInterval: 60_000 });
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && unread > 0) void markRead().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={t("act.notifications")}>
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {!data || data.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t("act.noNotifications")}</p>
        ) : (
          data.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 py-2"
              onClick={() => n.link && navigate({ to: n.link })}
            >
              <span className={cn("text-sm", !n.read_at && "font-semibold")}>{t(`notif.${n.kind}` as keyof Dict) ?? n.kind}</span>
              <span className="text-xs text-muted-foreground">{n.title}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
