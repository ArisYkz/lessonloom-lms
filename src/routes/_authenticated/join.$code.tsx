import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { joinClassroom } from "@/lib/learn.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import type { Dict } from "@/i18n/dictionary";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/join/$code")({
  head: () => ({
    meta: [{ title: "Join class — Bilim" }, { name: "robots", content: "noindex" }],
  }),
  component: JoinByQr,
});

function JoinByQr() {
  const { code } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const join = useServerFn(joinClassroom);
  const [error, setError] = useState<keyof Dict | null>(null);

  useEffect(() => {
    let active = true;
    join({ data: { code } }).then(
      ({ alreadyMember }) => {
        if (!active) return;
        queryClient.invalidateQueries({ queryKey: ["my-learning"] });
        queryClient.invalidateQueries({ queryKey: ["enrollment"] });
        if (alreadyMember) toast.info(t("join.alreadyMember"));
        else toast.success(t("join.success"));
        navigate({ to: "/dashboard", replace: true });
      },
      (err: unknown) => {
        if (active) setError(classroomErrorKey(err));
      },
    );
    return () => {
      active = false;
    };
    // The join runs once per scanned code; t and the query client are stable for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <p className="text-muted-foreground">{t(error)}</p>
        <Button asChild variant="outline">
          <Link to="/dashboard">{t("learn.myCourses")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <p className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
      {t("join.joining")}
    </p>
  );
}
