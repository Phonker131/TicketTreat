import type { TicketTreatEvent, LanguageCode } from "@/lib/types";
import { localeForLanguage, t } from "@/lib/i18n";

/** Venue-local timestamps must be rendered identically on Railway and phones. */
export function eventDisplayDate(value: string): {date:Date;timeZone:string} {
  // Offset-free datetimes represent the venue's wall-clock time (Prague pilot).
  // Treat them as floating rather than shifting them into the device timezone.
  const floating = !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return {
    date:new Date(floating ? value + "Z" : value),
    timeZone:floating ? "UTC" : "Europe/Prague",
  };
}

export function formatDate(value: string | null, language: LanguageCode): string {
  if (!value) return "—";
  const {date,timeZone}=eventDisplayDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPrice(event: Pick<TicketTreatEvent, "price" | "currency">, language: LanguageCode): string {
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
