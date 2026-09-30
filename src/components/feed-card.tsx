import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type { FeedCard as FeedCardData } from "@/lib/catalog.functions";
import { useI18n } from "@/i18n/provider";
import { formatPrice } from "@/components/course-card";

function duration(min: number) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:00` : `${m}:00`;
}

export function FeedCard({ course }: { course: FeedCardData }) {
  const { t } = useI18n();
  const d = duration(course.estimatedMinutes);
  return (
    <div className="group flex w-full flex-col gap-3">
      <Link to="/courses/$slug" params={{ slug: course.slug }} className="relative block aspect-video overflow-hidden rounded-xl bg-accent">
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.title} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center text-accent-foreground">
            <BookOpen className="size-8" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground">
          {formatPrice(course.priceModel, course.priceKzt, t)}
        </span>
        {d ? <span className="absolute bottom-2 right-2 rounded-md bg-foreground/85 px-1.5 py-0.5 text-xs font-medium text-background">{d}</span> : null}
      </Link>
      <div className="flex gap-3">
        <Link to="/teachers/$slug" params={{ slug: course.teacherSlug }} className="shrink-0">
          <Avatar name={course.teacherName} url={course.teacherLogoUrl} size="size-9" />
        </Link>
        <div className="min-w-0">
          <Link to="/courses/$slug" params={{ slug: course.slug }} className="line-clamp-2 font-medium leading-snug hover:underline">
            {course.title}
          </Link>
          <Link to="/teachers/$slug" params={{ slug: course.teacherSlug }} className="mt-1 block truncate text-sm text-muted-foreground hover:text-foreground">
            {course.teacherName}
          </Link>
          <p className="text-sm text-muted-foreground">
            {course.students.toLocaleString("ru-RU")} {t("feed.students")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ name, url, size = "size-10" }: { name: string; url: string | null; size?: string }) {
  return url ? (
    <img src={url} alt={name} className={`${size} rounded-full border border-border object-cover`} />
  ) : (
    <span className={`${size} flex items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground`}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
