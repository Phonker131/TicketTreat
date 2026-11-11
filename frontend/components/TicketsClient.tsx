"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getDemoTickets, getMyAttendance } from "@/lib/api";
import type {AttendanceHistory} from "@/lib/api";
import { eventDisplayDate, formatDate } from "@/lib/format";
import { t, localeForLanguage } from "@/lib/i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { getVerifiedTelegramSession, restoreGuest } from "@/lib/session";
import type { TicketTreatEvent, DemoGuest, DemoTicket } from "@/lib/types";
import {PageFaq} from "@/components/premium/PageFaq";

export function TicketsClient() {
  const {language} = useLanguage();
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [attendance,setAttendance]=useState<AttendanceHistory|null>(null);
  const [loading, setLoading] = useState(true);
  const [botEvents, setBotEvents] = useState<TicketTreatEvent[]>([]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(false);
  const words = {
    cs:["Nadcházející","Historie","Zobrazit QR kód","Zatím tu nejsou žádné vstupenky.","Prohlédnout akce","Zatím žádné minulé rezervace.","Čeká na potvrzení pořadatele","Registrace přes Telegram","Přihlásit se"],
    en:["Upcoming","History","Show QR code","No upcoming tickets yet.","Find an event","No past bookings yet.","Awaiting organizer confirmation","Telegram registration","Sign in"],
    ru:["Предстоящие","История","Показать QR-код","Пока нет предстоящих билетов.","Найти событие","Пока нет прошлых записей.","Ожидает подтверждения организатора","Запись через Telegram","Войти"],
    uk:["Майбутні","Історія","Показати QR-код","Поки немає майбутніх квитків.","Знайти подію","Поки немає минулих записів.","Очікує підтвердження організатора","Реєстрація через Telegram","Увійти"]
  }[language];
  const day = (date:Date, timeZone:string) => new Intl.DateTimeFormat("sv-SE", {timeZone}).format(date);
  const today = day(new Date(), "Europe/Prague");
  const ticketEvents = new Set(tickets.filter(ticket => ticket.ticket_status === "active").map(ticket => ticket.event_id));
  const rows = [
    ...tickets.map(ticket => ({event:ticket.event, ticket})),
    ...botEvents.filter(event => !ticketEvents.has(event.id)).map(event => ({event, ticket:null}))
  ].map(({event, ticket}) => {
    const start = event?.starts_at ? eventDisplayDate(event.starts_at) : null;
    const dated = start && Number.isFinite(start.date.getTime()) ? start : null;
    const cancelled = Boolean(event?.is_cancelled || ticket?.ticket_status === "cancelled");
    const past = Boolean(cancelled || ticket?.checked_in_at || (dated && day(dated.date, dated.timeZone) < today));
    return {event, ticket, cancelled, past, time:dated?.date.getTime() ?? Infinity};
  }).filter(row => row.past === history).sort((a,b) => history ? b.time-a.time : a.time-b.time);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const [guest, telegram] = await Promise.all([
          restoreGuest(), getVerifiedTelegramSession(),
        ]);
        if (!live) return;
        setGuest(guest);
        if (telegram) setBotEvents(telegram.bot_registrations);
        if (guest) {
          const items = await getDemoTickets(guest.access_token);
          if (live) setTickets(items);
          void getMyAttendance().then(history=>{if(live)setAttendance(history)}).catch(()=>{});
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Authentication error");
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {live = false;};
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">
        <section className="section-heading">
          <div><h1>{t(language, "tickets")}</h1>{guest && <p>{guest.first_name}, {guest.visits} {language==="cs"?"návštěv":language==="ru"?"посещений":language==="uk"?"відвідувань":"check-ins"}</p>}</div>
        </section>

        {loading ? <div className="state-card">{t(language, "loading")}</div> :
          <>
          {error && <div className="state-card state-error" role="alert">{userFacingError(error,language)}</div>}
          <div className="profile-actions" role="group" aria-label={t(language,"tickets")}>
            {[false,true].map((past,i)=><button type="button" key={words[i]} aria-pressed={past===history}
              className={past===history?"button button-primary":"button button-outline"} onClick={()=>setHistory(past)}>{words[i]}</button>)}
          </div>
          {!error && !rows.length && <section className="panel"><p>{history ? words[5] : words[3]}</p>
            {!history && <Link className="button button-primary" href="/#events">{words[4]}</Link>}
            {!guest && !history && <Link className="button button-outline" href="/login">{words[8]}</Link>}
          </section>}
          <div className="ticket-list">{rows.map(({event,ticket,cancelled})=>{
            const qr = ticket?.ticket_status==="active" && !history && !cancelled && ticket.payment_status!=="pending";
            const label = cancelled ? t(language,"cancelledTicket") : ticket?.checked_in_at ? t(language,"checkedIn")
              : (ticket?.payment_status ?? event?.payment_status)==="pending" ? words[6] : ticket ? t(language,"ticket") : words[7];
            return <Link className="ticket-row" key={ticket ? "ticket-"+ticket.id : "event-"+event?.id}
              href={ticket ? `/tickets/${ticket.id}${qr?"?show=qr":""}` : `/events/${event?.id}`}>
              <div><small>{label}</small><h3>{event?.title || t(language,"ticket")}</h3><p>{formatDate(event?.starts_at ?? null,language)}</p></div>
              <span className="button button-outline">{qr ? words[2] : t(language,"details")}</span>
            </Link>;
          })}</div>
          {history&&attendance&&<section className="panel" style={{marginTop:20}}>
            <h2>{language==="ru"?"История посещений":language==="cs"?"Historie návštěv":language==="uk"?"Історія відвідувань":"Attendance history"}</h2>
            <p>{attendance.visit_count} {language==="cs"?"návštěv":language==="ru"?"посещений":language==="uk"?"відвідувань":"check-ins"} {attendance.visit_count>=attendance.limited_to?(language==="cs"?"(posledních 100)":language==="ru"?"(последние 100)":language==="uk"?"(останні 100)":"(last 100)"):""}</p>
            {attendance.history.map((item,i)=><div key={`${item.event_id}-${i}`} className="participant-row">
              <div><strong>{item.title}</strong><small>{item.location||""}</small></div>
              <small>{new Date(item.checked_in_at).toLocaleString(localeForLanguage(language))}</small>
            </div>)}
          </section>}

          </>}
<PageFaq topic="tickets"/>
      </main>
    </div>
  );
}
