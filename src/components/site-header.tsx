import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Globe, Menu } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import { LOCALES } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const links = (
    <>
      <Link
        to="/catalog"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        activeProps={{ className: "text-sm font-medium text-foreground" }}
        onClick={() => setOpen(false)}
      >
        {t("nav.catalog")}
      </Link>
      <Link
        to="/teach"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        activeProps={{ className: "text-sm font-medium text-foreground" }}
        onClick={() => setOpen(false)}
      >
        {t("nav.teach")}
      </Link>
      {user ? (
        <Link
          to="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-sm font-medium text-foreground" }}
          onClick={() => setOpen(false)}
        >
          {t("nav.dashboard")}
        </Link>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span>{t("brand")}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">{links}</nav>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Globe className="size-4" />
                <span className="hidden sm:inline">{locale.toUpperCase()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLocale(l.code)}>
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("nav.account")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                  {t("nav.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/teach" })}>{t("nav.teach")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>{t("nav.profile")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>{t("nav.admin")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>{t("nav.signOut")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              {t("nav.signIn")}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen((v) => !v)}>
            <Menu className="size-4" />
          </Button>
        </div>
      </div>
      {open ? <div className="flex flex-col gap-3 border-t border-border px-4 py-4 md:hidden">{links}</div> : null}
    </header>
  );
}
