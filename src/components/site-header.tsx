import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, getMyRoles } from "@/lib/learn.functions";
import { useMode } from "@/hooks/useMode";
import { GraduationCap, Globe, Menu } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/provider";
import { LOCALES } from "@/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
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
  const { mode, setMode } = useMode();
  const fetchProfile = useServerFn(getMyProfile);
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const fetchRoles = useServerFn(getMyRoles);
  const roles = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: () => fetchRoles(),
    enabled: !!user,
  });
  const hasOrg = !!profile.data?.hasOrg;
  const teacherMode = !!user && mode === "teacher";

  function switchMode() {
    if (teacherMode) {
      setMode("student");
      navigate({ to: "/home" });
    } else {
      setMode("teacher");
      navigate({ to: "/teach" });
    }
  }
  const linkCls =
    "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = { className: "text-sm font-medium text-primary" };

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const links = teacherMode ? (
    <>
      <Link
        to="/teach"
        activeOptions={{ exact: true }}
        className={linkCls}
        activeProps={activeCls}
        onClick={() => setOpen(false)}
      >
        {t("nav.teach")}
      </Link>
      <Link
        to="/teach/inbox"
        className={linkCls}
        activeProps={activeCls}
        onClick={() => setOpen(false)}
      >
        {t("act.inbox")}
      </Link>
    </>
  ) : (
    <>
      {user ? (
        <Link to="/home" className={linkCls} activeProps={activeCls} onClick={() => setOpen(false)}>
          {t("nav.home")}
        </Link>
      ) : null}
      <Link
        to="/catalog"
        className={linkCls}
        activeProps={activeCls}
        onClick={() => setOpen(false)}
      >
        {t("nav.catalog")}
      </Link>
      {user ? (
        <Link
          to="/dashboard"
          className={linkCls}
          activeProps={activeCls}
          onClick={() => setOpen(false)}
        >
          {t("nav.dashboard")}
        </Link>
      ) : (
        <Link
          to="/teach"
          className={linkCls}
          activeProps={activeCls}
          onClick={() => setOpen(false)}
        >
          {t("nav.teach")}
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-8 px-6">
        <Link
          to={user ? (teacherMode ? "/teach" : "/home") : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
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

          {user ? <NotificationBell /> : null}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("nav.account")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {teacherMode ? t("mode.teacher") : t("mode.student")}
                </div>
                {hasOrg ? (
                  <DropdownMenuItem onClick={switchMode}>
                    {t("mode.switchTo")}{" "}
                    {teacherMode
                      ? t("mode.student").toLowerCase()
                      : t("mode.teacher").toLowerCase()}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate({ to: "/teach" })}>
                    {t("mode.becomeTeacher")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                  {t("nav.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  {t("nav.profile")}
                </DropdownMenuItem>
                {roles.data?.includes("admin") && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    {t("nav.admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>{t("nav.signOut")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              {t("nav.signIn")}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 md:hidden">
          {links}
        </div>
      ) : null}
    </header>
  );
}
