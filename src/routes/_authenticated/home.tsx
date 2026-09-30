import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { getHomeFeed } from "@/lib/catalog.functions";
import { getMyLearning, getMyProfile } from "@/lib/learn.functions";
import { useI18n } from "@/i18n/provider";
import { useMode } from "@/hooks/useMode";
import { FeedCard, Avatar } from "@/components/feed-card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Bilim" },
      { name: "description", content: "Trending courses, popular teachers and your learning on Bilim." },
      { property: "og:title", content: "Home — Bilim" },
      { property: "og:description", content: "Trending courses and popular teachers on Bilim." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { setMode } = useMode();
  const fetchLearning = useServerFn(getMyLearning);
  const fetchProfile = useServerFn(getMyProfile);
  const feed = useQuery({ queryKey: ["home-feed"], queryFn: () => getHomeFeed() });
  const learning = useQuery({ queryKey: ["my-learning"], queryFn: () => fetchLearning() });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  // Honour the default mode once per browser session.
  useEffect(() => {
    const p = profile.data;
    if (!p || sessionStorage.getItem("bilim.modeApplied")) return;
    sessionStorage.setItem("bilim.modeApplied", "1");
    if (p.default_mode === "teacher" && p.hasOrg) {
      setMode("teacher");
      navigate({ to: "/teach" });
    } else {
      setMode("student");
    }
  }, [profile.data, navigate, setMode]);

  const inProgress = (learning.data ?? []).filter((c) => c.percent < 100).slice(0, 4);
  const f = feed.data;

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6">
      <h1 className="title-page">
        {t("feed.hello")}
        {profile.data?.full_name ? `, ${profile.data.full_name.split(" ")[0]}` : ""}
      </h1>

      {inProgress.length > 0 ? (
        <Row title={t("feed.continue")} link={<Link to="/dashboard" className="text-sm text-primary hover:underline">{t("feed.seeAll")}</Link>}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {inProgress.map((c) => (
              <Link key={c.slug} to="/learn/$slug" params={{ slug: c.slug }} className="group flex flex-col gap-2">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-accent">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt={c.title} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center"><BookOpen className="size-7 text-accent-foreground" /></div>
                  )}
                  <div className="absolute inset-x-0 bottom-0"><Progress value={c.percent} className="h-1 rounded-none" /></div>
                </div>
                <p className="line-clamp-1 font-medium group-hover:underline">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.percent}% · {c.teacherName}</p>
              </Link>
            ))}
          </div>
        </Row>
      ) : null}

      {feed.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3"><Skeleton className="aspect-video rounded-xl" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          ))}
        </div>
      ) : !f || f.newest.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">{t("feed.empty")}</p>
      ) : (
        <>
          <CardRow title={t("feed.trending")} items={f.trending} />
          {f.teachers.length > 0 ? (
            <Row title={t("feed.teachers")}>
              <div className="flex gap-6 overflow-x-auto pb-2">
                {f.teachers.map((tch) => (
                  <Link key={tch.slug} to="/teachers/$slug" params={{ slug: tch.slug }} className="flex w-32 shrink-0 flex-col items-center gap-2 text-center">
                    <Avatar name={tch.name} url={tch.logoUrl} size="size-24" />
                    <span className="line-clamp-2 text-sm font-medium">{tch.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {tch.courses} {t("feed.courses")} · {tch.students} {t("feed.students")}
                    </span>
                  </Link>
                ))}
              </div>
            </Row>
          ) : null}
          <CardRow title={t("feed.new")} items={f.newest} />
          <CardRow title={t("feed.free")} items={f.free} />
          {f.categories.map((c) => (
            <CardRow key={c.slug} title={locale === "kk" ? c.name_kk : locale === "en" ? c.name_en : c.name_ru} items={c.courses} />
          ))}
        </>
      )}
    </div>
  );
}

function Row({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="title-section">{title}</h2>
        {link}
      </div>
      {children}
    </section>
  );
}

function CardRow({ title, items }: { title: string; items: Parameters<typeof FeedCard>[0]["course"][] }) {
  if (items.length === 0) return null;
  return (
    <Row title={title}>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((c) => <FeedCard key={c.id} course={c} />)}
      </div>
    </Row>
  );
}
