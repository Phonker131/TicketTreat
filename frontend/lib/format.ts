import type { CrowdlyEvent, LanguageCode } from "@/lib/types";
import { localeForLanguage, t } from "@/lib/i18n";

export function formatDate(value: string | null, language: LanguageCode): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPrice(event: Pick<CrowdlyEvent, "price" | "currency">, language: LanguageCode): string {
  const numeric = Number(event.price || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return t(language, "free");
  const currency = (event.currency || "CZK").toUpperCase();
  try {
    return new Intl.NumberFormat(localeForLanguage(language), {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}
