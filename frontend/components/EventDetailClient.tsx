"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getEvent } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { LANGUAGE_NAMES, t } from "@/lib/i18n";
import type { CrowdlyEvent } from "@/lib/types";

export function EventDetailClient() {
  const params = useParams<{id: string}>();
  const {language} = useLanguage();
  const [event, setEvent] = useState<CrowdlyEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    getEvent(params.id)
      .then(setEvent)
      .catch((e) => setError(e instanceof Error ? e.message : "error"));
  }, [params?.id]);

  if (error) {
    return <><AppHeader /><main className="page"><div className="state-card state-error">{t(language, "eventNotFound")}</div></main></>;
  }

  if (!event) {
    return <><AppHeader /><main className="page"><div className="state-card">{t(language, "loading")}</div></main></>;
  }

  const langs = event.languages?.length
    ? event.languages.map((code) => LANGUAGE_NAMES[language][code]).join(", ")
    : t(language, "notSpecified");

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page event-page">
        <Link href="/" className="back-link">← {t(language, "back")}</Link>

        <section className="event-hero">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="event-image" src={event.image_url} alt="" />
          ) : (
            <div className="event-image event-image-placeholder"><div className="mini-crowd"><span/><span/><span className="mini-you"/><span/><span/></div></div>
          )}

          <div className="event-hero-copy">
            <div className="event-badges">
              {event.is_cancelled && <span className="status status-danger">{t(language, "cancelled")}</span>}
              {event.spots_left === 0 && <span className="status status-danger">{t(language, "soldOut")}</span>}
              <span className="status status-demo">{t(language, "demo")}</span>
            </div>
            <h1>{event.title}</h1>
            {event.description && <p className="event-description">{event.description}</p>}
          </div>
        </section>

        {Boolean(event.gallery_urls?.length) && <section className="panel" style={{marginBottom:20}}>
          <h2>{language==="ru"?"Фотографии":language==="uk"?"Світлини":language==="cs"?"Fotogalerie":"Photo gallery"}</h2>
          <div className="event-media-gallery">{event.gallery_urls?.map((url,index)=><a key={url+index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Event gallery photo ${index+1}`} loading="lazy" referrerPolicy="no-referrer"/></a>)}</div>
        </section>}
        {event.video_url && <section className="panel" style={{marginBottom:20}}>
          <h2>{language==="ru"?"Видео мероприятия":language==="uk"?"Відео події":language==="cs"?"Video z akce":"Event video"}</h2>
          <a className="button button-outline" href={event.video_url} target="_blank" rel="noopener noreferrer">
          {language==="ru"?"Смотреть видео ↗":language==="uk"?"Дивитися відео ↗":language==="cs"?"Zobrazit video ↗":"Watch video ↗"}</a>
        </section>}
        <section className="detail-grid">
          <div className="detail-item"><span>{t(language, "startsAt")}</span><strong>{formatDate(event.starts_at, language)}</strong></div>
          <div className="detail-item"><span>{t(language, "location")}</span><strong>{event.location || "—"}</strong></div>
          <div className="detail-item"><span>{t(language, "organizer")}</span><strong>{event.organizer || "Crowdly"}</strong></div>
          <div className="detail-item"><span>{t(language, "price")}</span><strong>{formatPrice(event, language)}</strong></div>
          <div className="detail-item"><span>{t(language, "spots")}</span><strong>{event.spots_left ?? "∞"}</strong></div>
          <div className="detail-item"><span>{t(language, "languages")}</span><strong>{langs}</strong></div>
        </section>

        {event.is_cancelled ? (
          <section className="state-card state-error">
            <h2>{t(language,"cancelled")}</h2>
            <p><strong>{language==="en"?"Cancellation reason":language==="cs"?"Důvod zrušení":language==="uk"?"Причина скасування":"Причина отмены"}:</strong> {event.cancellation_reason || "—"}</p>
            <p>{language==="en"?"Registration is closed.":language==="cs"?"Registrace je uzavřena.":language==="uk"?"Реєстрацію закрито.":"Регистрация закрыта."}</p>
          </section>
        ) : (
          <section className="join-card">
            <div>
              <h2>{event.spots_left === 0 ? t(language, "soldOut") : t(language, "join")}</h2>
              <p>{t(language, "demoHint")}</p>
            </div>
            {event.spots_left === 0 ? (
              <Link className="button button-sun" href={`/checkout/${event.id}?waitlist=1`}>{t(language, "waitlist")}</Link>
            ) : (
              <Link className="button button-primary" href={`/checkout/${event.id}`}>{t(language, "join")}</Link>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
