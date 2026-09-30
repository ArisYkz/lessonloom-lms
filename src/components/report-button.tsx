import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { submitReport } from "@/lib/report.functions";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";

export function ReportButton({ targetType, targetId }: { targetType: "course" | "teacher" | "lesson"; targetId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const report = useServerFn(submitReport);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    setSending(true);
    try {
      await report({ data: { targetType, targetId, reason, description } });
      toast.success(t("report.sent"));
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Flag className="size-3.5" /> {t("report.title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report.course")}</DialogTitle>
          <DialogDescription>{t("report.sent")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            placeholder={t("report.reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            aria-label={t("report.reason")}
          />
          <Textarea
            placeholder={t("report.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            aria-label={t("report.description")}
          />
          <Button type="submit" className="w-full" disabled={sending}>
            {t("report.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
