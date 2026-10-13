import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Bilim" },
      { name: "description", content: "Choose a new password for your Bilim account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reset password — Bilim" },
      { property: "og:description", content: "Choose a new password for your Bilim account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(t("auth.passwordUpdated"));
    navigate({ to: "/home" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="title-page">{t("auth.newPasswordTitle")}</h1>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <Label htmlFor="pw">{t("auth.password")}</Label>
          <Input
            id="pw"
            type="password"
            minLength={6}
            required
            className="mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {t("auth.savePassword")}
        </Button>
      </form>
    </div>
  );
}
