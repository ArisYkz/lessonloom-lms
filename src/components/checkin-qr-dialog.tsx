import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QrCode } from "lucide-react";
import { listSessionCheckins, rotateSessionCheckin } from "@/lib/teach.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import { useI18n } from "@/i18n/provider";
import { QrCodeImage } from "@/components/qr-code-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROTATE_MS = 25_000;

export function CheckinQrDialog({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="size-4" /> {t("checkin.open")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("checkin.title")}</DialogTitle>
          <DialogDescription>{t("checkin.help")}</DialogDescription>
        </DialogHeader>
        {open ? <CheckinQrBody sessionId={sessionId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// Lives inside the open dialog so the code only rotates while a teacher is looking at it.
function CheckinQrBody({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const rotate = useServerFn(rotateSessionCheckin);
  const fetchCheckins = useServerFn(listSessionCheckins);

  const { data: tokenData, error } = useQuery({
    queryKey: ["checkin-token", sessionId],
    queryFn: () => rotate({ data: { sessionId } }),
    refetchInterval: ROTATE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: checkins } = useQuery({
    queryKey: ["session-checkins", sessionId],
    queryFn: () => fetchCheckins({ data: { sessionId } }),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive">{t(classroomErrorKey(error))}</p>
      ) : tokenData ? (
        <div className="flex justify-center">
          <QrCodeImage value={`${window.location.origin}/checkin/${tokenData.token}`} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      <div>
        <p className="text-sm font-medium">
          {t("checkin.count")}: {checkins?.length ?? 0}
        </p>
        {checkins && checkins.length > 0 ? (
          <ul className="mt-2 max-h-48 divide-y divide-border overflow-auto text-sm">
            {checkins.map((c) => (
              <li key={c.userId} className="py-1.5">
                {c.name || "—"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("checkin.none")}</p>
        )}
      </div>
    </div>
  );
}
