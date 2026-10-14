import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { checkInToSession } from "@/lib/learn.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import type { Dict } from "@/i18n/dictionary";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/checkin/$token")({
  head: () => ({
    meta: [{ title: "Check in — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckInByQr,
});

type Result = { ok: true } | { ok: false; key: keyof Dict };

function CheckInByQr() {
  const { token } = Route.useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const checkIn = useServerFn(checkInToSession);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;
    checkIn({ data: { token } }).then(
      () => {
        if (!active) return;
        queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
        setResult({ ok: true });
      },
      (err: unknown) => {
        if (active) setResult({ ok: false, key: classroomErrorKey(err) });
      },
    );
    return () => {
      active = false;
    };
    // One scan, one check-in. The query client and translator are stable for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!result) {
    return (
      <p className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        {t("checkin.checking")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <p className={result.ok ? "title-panel" : "text-muted-foreground"}>
        {result.ok ? t("checkin.success") : t(result.key)}
      </p>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("learn.myCourses")}</Link>
      </Button>
    </div>
  );
}
