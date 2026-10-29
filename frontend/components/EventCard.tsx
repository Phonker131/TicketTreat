"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

import { useLanguage } from "@/components/LanguageProvider";
import {
  LANGUAGE_NAMES,
  localeForLanguage,
  t,
} from "@/lib/i18n";
import type { TicketTreatEvent } from "@/lib/types";
import { eventDisplayDate } from "@/lib/format";

function formatDate(
  value: string | null,
  language: "en" | "cs" | "ru" | "uk",
): string {
  if (!value) {
    return "—";
  }

  const {date,timeZone} = eventDisplayDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    localeForLanguage(language),
    {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatPrice(
  event: TicketTreatEvent,
  language: "en" | "cs" | "ru" | "uk",
): string {
  const numeric = Number(event.price || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return t(language, "free");
  }

  const currency = (
    event.currency || "CZK"
  ).toUpperCase();

  try {
    return new Intl.NumberFormat(
      localeForLanguage(language),
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          Number.isInteger(numeric) ? 0 : 2,
      },
    ).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

export function EventCard({
  event,
}: {
  event: TicketTreatEvent;
}) {
  const { language } = useLanguage();
  const [posterUnavailable,setPosterUnavailable]=useState(false);
  useEffect(()=>setPosterUnavailable(false),[event.image_url]);

  const startsAt=event.starts_at?eventDisplayDate(event.starts_at):null;
  const validStart=startsAt&&!Number.isNaN(startsAt.date.getTime());
  const sticker=validStart?{
    day:new Intl.DateTimeFormat(localeForLanguage(language),{day:"2-digit",timeZone:startsAt.timeZone}).format(startsAt.date),
    month:new Intl.DateTimeFormat(localeForLanguage(language),{month:"short",weekday:"short",timeZone:startsAt.timeZone}).format(startsAt.date).toUpperCase(),
  }:null;

  const eventLanguages =
    event.languages?.length > 0
      ? event.languages
          .map(
            (code) =>
              LANGUAGE_NAMES[language][code],
          )
          .join(", ")
      : t(language, "notSpecified");

  return (
    <article className="event-card">
      <div className="tt-event-poster-wrap">
        {event.image_url && !posterUnavailable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="event-card-poster" src={event.image_url} alt={event.title} loading="lazy" onError={()=>setPosterUnavailable(true)}/>
        ) : (
          <div className="event-card-accent" aria-hidden="true">
            <span/><span/><span className="accent-you"/><span/><span/>
          </div>
        )}
        {sticker&&<div className="tt-event-date-sticker" aria-label={formatDate(event.starts_at,language)}>
          <strong>{sticker.day}</strong><span>{sticker.month}</span>
        </div>}
      </div>

      <div className="event-card-body">
        <div className="event-card-meta">
          <span>
            {formatDate(
              event.starts_at,
              language,
            )}
          </span>
          <span>
            {formatPrice(event, language)}
          </span>
        </div>

        <h2>{event.title}</h2>
        {event.organizer_profile&&<Link href={`/organizers/${event.organizer_profile.slug}`} className="tt-event-organizer-link">{event.organizer_profile.display_name} ↗</Link>}

        <p className="event-card-location">
          {event.location || "—"}
        </p>

        <p className="event-card-languages">
          {t(language, "languages")}:{" "}
          {eventLanguages}
        </p>

        <div className="event-card-footer">
          {event.spots_left === 0 ? (
            <span className="status status-danger">
              {t(language, "soldOut")}
            </span>
          ) : (
            <span className="status">
              {event.spots_left == null
                ? "●"
                : `${t(language, "spots")}: ${event.spots_left}`}
            </span>
          )}

          <Link
            href={`/events/${event.id}?lang=${language}`}
            className="button button-secondary"
          >
            {t(language, "details")}
          </Link>
        </div>
      </div>
    </article>
  );
}
