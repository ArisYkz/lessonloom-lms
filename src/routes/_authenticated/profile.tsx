import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { LOCALES } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Bilim" },
      { name: "description", content: "Update your Bilim profile details and preferred language." },
      { property: "og:title", content: "Profile — Bilim" },
      { property: "og:description", content: "Update your Bilim profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t, setLocale } = useI18n();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const { data } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [locale, setLocalePref] = useState("ru");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullName(data.full_name ?? "");
    setBio(data.bio ?? "");
    setLocalePref(data.preferred_locale ?? "ru");
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { fullName, bio, preferredLocale: locale } });
      setLocale(locale as "kk" | "ru" | "en");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
      <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="fullName">{t("profile.name")}</Label>
          <Input id="fullName" className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bio">{t("profile.bio")}</Label>
          <Textarea id="bio" className="mt-1" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div>
          <Label>{t("profile.locale")}</Label>
          <Select value={locale} onValueChange={setLocalePref}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>
          {t("profile.save")}
        </Button>
      </form>
    </div>
  );
}
