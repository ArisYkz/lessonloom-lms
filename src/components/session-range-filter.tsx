import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";

export type SessionRange = { from: string; to: string };

export function SessionRangeFilter({
  value,
  onChange,
  onReset,
}: {
  value: SessionRange;
  onChange: (next: SessionRange) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="session-range-from">{t("calendar.from")}</Label>
        <Input
          id="session-range-from"
          type="date"
          className="w-40"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="session-range-to">{t("calendar.to")}</Label>
        <Input
          id="session-range-to"
          type="date"
          className="w-40"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={onReset}>
        {t("calendar.reset")}
      </Button>
    </div>
  );
}
