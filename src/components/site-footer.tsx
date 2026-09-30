import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n/provider";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {t("brand")} · Қазақстан
        </p>
        <nav className="flex gap-6">
          <Link to="/catalog" className="hover:text-foreground">
            {t("nav.catalog")}
          </Link>
          <Link to="/teach" className="hover:text-foreground">
            {t("nav.teach")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
