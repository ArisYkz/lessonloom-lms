import { Link } from "@tanstack/react-router";
import { BookOpen, Clock } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/catalog.functions";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionary";
import { Badge } from "@/components/ui/badge";

export function formatPrice(priceModel: string, priceKzt: number, t: (k: keyof Dict) => string) {
  if (priceModel === "free") return t("price.free");
  return `${priceKzt.toLocaleString("ru-RU")} ₸ ${t("price.perMonth")}`;
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const { t } = useI18n();
  return (
    <Link
      to="/courses/$slug"
      params={{ slug: course.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="aspect-[16/10] w-full overflow-hidden bg-accent">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-accent-foreground">
            <BookOpen className="size-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-medium uppercase tracking-wider text-[10px]">
            {course.language}
          </Badge>
          <span>{t(`level.${course.level}` as keyof Dict)}</span>
          {course.estimatedMinutes > 0 ? (
            <span className="ml-auto inline-flex items-center gap-1">
              <Clock className="size-3" />
              {course.estimatedMinutes} {t("course.minutes")}
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground">{course.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">{course.teacherName}</span>
          <span className="text-sm font-medium text-foreground">
            {formatPrice(course.priceModel, course.priceKzt, t)}
          </span>
        </div>
      </div>
    </Link>
  );
}
