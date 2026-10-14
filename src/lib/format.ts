import type { Locale } from "@/i18n/dictionary";

// Numbers follow the interface language: ru and kk group with a space, en with a comma.
const NUMBER_LOCALES: Record<Locale, string> = {
  kk: "kk-KZ",
  ru: "ru-RU",
  en: "en-US",
};

const formatters: Record<Locale, Intl.NumberFormat> = {
  kk: new Intl.NumberFormat(NUMBER_LOCALES.kk),
  ru: new Intl.NumberFormat(NUMBER_LOCALES.ru),
  en: new Intl.NumberFormat(NUMBER_LOCALES.en),
};

export function formatNumber(value: number, locale: Locale) {
  return formatters[locale].format(value);
}
