import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listCategories, listCourses } from "@/lib/catalog.functions";
import { CourseCard } from "@/components/course-card";
import { useI18n } from "@/i18n/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTENT_LANGUAGES } from "@/i18n/dictionary";

type Search = {
  q?: string | undefined;
  category?: string | undefined;
  language?: string | undefined;
  level?: string | undefined;
};

const catalogQuery = (search: Search) =>
  queryOptions({
    queryKey: ["catalog", search],
    queryFn: async () => ({
      courses: await listCourses({
        data: {
          ...(search.q ? { search: search.q } : {}),
          ...(search.category ? { category: search.category } : {}),
          ...(search.language ? { language: search.language } : {}),
          ...(search.level ? { level: search.level } : {}),
        },
      }),
      categories: await listCategories(),
    }),
  });

export const Route = createFileRoute("/catalog")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    category:
      typeof search["category"] === "string" && search["category"] ? search["category"] : undefined,
    language:
      typeof search["language"] === "string" && search["language"] ? search["language"] : undefined,
    level: typeof search["level"] === "string" && search["level"] ? search["level"] : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(catalogQuery(deps)),
  head: () => ({
    meta: [
      { title: "Course catalog — Bilim" },
      {
        name: "description",
        content: "Search every published course on Bilim by category, language and level.",
      },
      { property: "og:title", content: "Course catalog — Bilim" },
      { property: "og:description", content: "Browse courses by category, language and level." },
    ],
  }),
  component: Catalog,
  errorComponent: ({ error }) => <div className="p-10 text-center text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center">404</div>,
});

const ALL = "__all";

function Catalog() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalog" });
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(catalogQuery(search));

  const set = (patch: Search) => navigate({ search: (prev) => ({ ...prev, ...patch }) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-page">{t("catalog.title")}</h1>

      <div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("catalog.search")}</Label>
          <Input
            className="mt-1"
            defaultValue={search.q ?? ""}
            placeholder={t("catalog.search")}
            onKeyDown={(e) => {
              if (e.key === "Enter") set({ q: (e.target as HTMLInputElement).value || undefined });
            }}
            onBlur={(e) => set({ q: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("catalog.category")}</Label>
          <Select
            value={search.category ?? ALL}
            onValueChange={(v) => set({ category: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("catalog.all")}</SelectItem>
              {data.categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {locale === "kk" ? c.name_kk : locale === "en" ? c.name_en : c.name_ru}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t("catalog.language")}</Label>
            <Select
              value={search.language ?? ALL}
              onValueChange={(v) => set({ language: v === ALL ? undefined : v })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("catalog.all")}</SelectItem>
                {CONTENT_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {t(l.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("catalog.level")}</Label>
            <Select
              value={search.level ?? ALL}
              onValueChange={(v) => set({ level: v === ALL ? undefined : v })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("catalog.all")}</SelectItem>
                <SelectItem value="beginner">{t("level.beginner")}</SelectItem>
                <SelectItem value="intermediate">{t("level.intermediate")}</SelectItem>
                <SelectItem value="advanced">{t("level.advanced")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {data.courses.length} {t("catalog.results")}
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate({ search: {} })}>
          {t("catalog.clear")}
        </Button>
      </div>

      {data.courses.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{t("catalog.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
