"use client";

import Link from "next/link";
import { useParams,useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getEvent,getBookingConfig,getManageEvent } from "@/lib/api";
import {getWebToken} from "@/lib/session";
import {downloadCalendar,mapQuery} from "@/lib/event-actions";
import { formatDate, formatPrice } from "@/lib/format";
import { LANGUAGE_NAMES, t } from "@/lib/i18n";
import type { TicketTreatEvent } from "@/lib/types";

export function EventDetailClient({preview=false}:{preview?:boolean}) {
  const params = useParams<{id: string}>();
  const query=useSearchParams();
  const source=(query.get("utm_source")||query.get("ref")||"").toLowerCase();
  const attributed=/^[a-z0-9_-]{1,40}$/.test(source)?`&utm_source=${encodeURIComponent(source)}`:"";
  const {language} = useLanguage();
  const [event, setEvent] = useState<TicketTreatEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoPayments,setDemoPayments]=useState(false);
  const [mapOpen,setMapOpen]=useState(false);

  useEffect(() => {
    if (!params?.id) return;
    const token=getWebToken();
    const result=preview ? (token ? getManageEvent(Number(params.id),token) : Promise.reject(new Error("Login required"))) : getEvent(params.id);
    result.then(setEvent).catch((e) => setError(e instanceof Error ? e.message : "error"));
  }, [params?.id,preview]);

  useEffect(()=>{getBookingConfig().then(cfg=>setDemoPayments(cfg.demo_payment_mode)).catch(()=>{});},[]);

  if (error) {
    return <><AppHeader /><main className="page"><div className="state-card state-error">{t(language, "eventNotFound")}</div></main></>;
  }

  if (!event) {
    return <><AppHeader /><main className="page"><div className="state-card">{t(language, "loading")}</div></main></>;
  }

  const mapUrl=mapQuery(event);
  const eventUrl=typeof window!=="undefined" ? window.location.origin+`/events/${event.id}` : `/events/${event.id}`;
  const posterUrl=preview&&!event.publication?.visible&&event.image_url?.includes(`/demo/events/${event.id}/poster`)
    ? `/api/gateway/demo/events/${event.id}/poster` : event.image_url;
  const galleryUrls=preview&&!event.publication?.visible
    ? (event.gallery_urls||[]).map(url=>url.includes(`/demo/events/${event.id}/gallery/`)?
        `/api/gateway/demo/events/${event.id}/gallery/${url.split("/").pop()}`:url)
    : event.gallery_urls||[];

  const langs = event.languages?.length
    ? event.languages.map((code) => LANGUAGE_NAMES[language][code]).join(", ")
    : t(language, "notSpecified");

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page event-page">
        <Link href={preview?`/admin/events/${event.id}`:"/"} className="back-link">← {preview?"Управление ивентом":t(language, "back")}</Link>
        {preview&&<div className="state-card" role="status"><strong>Предпросмотр — доступен только организатору.</strong> {event.publication?.visible?"Ивент также опубликован.":"Черновик пока не виден гостям и не принимает регистрации."}</div>}

        <section className="event-hero">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="event-image" src={posterUrl} alt="" />
          ) : (
            <div className="event-image event-image-placeholder"><div className="mini-crowd"><span/><span/><span className="mini-you"/><span/><span/></div></div>
          )}

          <div className="event-hero-copy">
            <div className="event-badges">
              {event.is_cancelled && <span className="status status-danger">{t(language, "cancelled")}</span>}
              {event.spots_left === 0 && <span className="status status-danger">{t(language, "soldOut")}</span>}
              {demoPayments&&<span className="status status-demo">{t(language, "demo")}</span>}
            </div>
            <h1>{event.title}</h1>
            {event.description && <p className="event-description">{event.description}</p>}
          </div>
        </section>

        {Boolean(galleryUrls.length) && <section className="panel" style={{marginBottom:20}}>
          <h2>{language==="ru"?"Фотографии":language==="uk"?"Світлини":language==="cs"?"Fotogalerie":"Photo gallery"}</h2>
          <div className="event-media-gallery">{galleryUrls.map((url,index)=><a key={url+index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Event gallery photo ${index+1}`} loading="lazy" referrerPolicy="no-referrer"/></a>)}</div>
        </section>}
        {event.video_url && <section className="panel" style={{marginBottom:20}}>
          <h2>{language==="ru"?"Видео мероприятия":language==="uk"?"Відео події":language==="cs"?"Video z akce":"Event video"}</h2>
          <a className="button button-outline" href={event.video_url} target="_blank" rel="noopener noreferrer">
          {language==="ru"?"Смотреть видео ↗":language==="uk"?"Дивитися відео ↗":language==="cs"?"Zobrazit video ↗":"Watch video ↗"}</a>
        </section>}
        <section className="detail-grid">
          <div className="detail-item"><span>{t(language, "startsAt")}</span><strong>{formatDate(event.starts_at, language)}</strong></div>
          <div className="detail-item"><span>{t(language, "location")}</span><strong>{event.location || "—"}</strong></div>
          <div className="detail-item"><span>{t(language, "organizer")}</span><strong>{event.organizer === "Crowdly" ? "TicketTreat" : (event.organizer || "TicketTreat")}</strong></div>
          <div className="detail-item"><span>{t(language, "price")}</span><strong>{formatPrice(event, language)}</strong></div>
          <div className="detail-item"><span>{t(language, "spots")}</span><strong>{event.spots_left ?? "∞"}</strong></div>
          <div className="detail-item"><span>{t(language, "languages")}</span><strong>{langs}</strong></div>
        </section>
        <section className="panel" style={{marginTop:20,marginBottom:20}}>
          <h2>{language==="ru"?"Как добраться и сохранить дату":language==="cs"?"Místo a kalendář":language==="uk"?"Як дістатися та календар":"Venue and calendar"}</h2>
          <div className="admin-event-actions">
            {event.starts_at&&<button type="button" className="button button-outline" onClick={()=>downloadCalendar(event,eventUrl)}>↓ {language==="ru"?"Добавить в календарь":language==="cs"?"Přidat do kalendáře":language==="uk"?"Додати в календар":"Add to calendar"}</button>}
            {mapUrl&&<><a className="button button-outline" href={mapUrl} target="_blank" rel="noopener noreferrer">↗ {language==="ru"?"Открыть карту":language==="cs"?"Otevřít mapu":language==="uk"?"Відкрити карту":"Open map"}</a>
              <button type="button" className="button button-outline" onClick={()=>setMapOpen(v=>!v)}>{mapOpen?"Скрыть карту":"Показать карту"}</button></>}
          </div>
          {mapOpen&&mapUrl&&<iframe title="Карта места проведения" loading="lazy" referrerPolicy="no-referrer"
            style={{width:"100%",height:300,border:0,borderRadius:12,marginTop:16}}
            src={`https://maps.google.com/maps?q=${encodeURIComponent([event.location,event.city,event.country_code].filter(Boolean).join(", "))}&output=embed`} />}
        </section>

        {preview ? <section className="state-card"><h2>Предпросмотр карточки</h2><p>Регистрация в режиме предпросмотра недоступна. Чтобы открыть её для гостей, опубликуй мероприятие в админке.</p></section> : event.is_cancelled ? (
          <section className="state-card state-error">
            <h2>{t(language,"cancelled")}</h2>
            <p><strong>{language==="en"?"Cancellation reason":language==="cs"?"Důvod zrušení":language==="uk"?"Причина скасування":"Причина отмены"}:</strong> {event.cancellation_reason || "—"}</p>
            <p>{language==="en"?"Registration is closed.":language==="cs"?"Registrace je uzavřena.":language==="uk"?"Реєстрацію закрито.":"Регистрация закрыта."}</p>
          </section>
        ) : (
          <section className="join-card">
            <div>
              <h2>{event.spots_left === 0 ? t(language, "soldOut") : t(language, "join")}</h2>
              <p>{Number(event.price||0)<=0 ? (language==="ru"?"Бесплатный QR-билет после подтверждённой регистрации.":language==="cs"?"QR vstupenka zdarma po ověřené registraci.":language==="uk"?"Безкоштовний QR-квиток після підтвердженої реєстрації.":"Free QR ticket after verified registration.") : demoPayments?t(language,"demoHint"):(language==="ru"?"Продажа платных билетов пока недоступна.":language==="cs"?"Prodej placených vstupenek zatím není dostupný.":language==="uk"?"Продаж платних квитків поки недоступний.":"Paid ticket sales are not available yet.")}</p>
            </div>
            {event.spots_left === 0 ? (
              <Link className="button button-sun" href={`/checkout/${event.id}?waitlist=1${attributed}`}>{t(language, "waitlist")}</Link>
            ) : (
              <Link className="button button-primary" href={`/checkout/${event.id}${attributed?`?utm_source=${encodeURIComponent(source)}`:""}`}>{t(language, "join")}</Link>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
