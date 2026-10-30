"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {ExampleTickets} from "@/components/ExampleTickets";
import { useLanguage } from "@/components/LanguageProvider";
import { getDemoTickets, getMyAttendance } from "@/lib/api";
import type {AttendanceHistory} from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { t, localeForLanguage } from "@/lib/i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { getVerifiedTelegramSession, restoreGuest } from "@/lib/session";
import type { TicketTreatEvent, DemoGuest, DemoTicket } from "@/lib/types";

export function TicketsClient() {
  const {language} = useLanguage();
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [attendance,setAttendance]=useState<AttendanceHistory|null>(null);
  const [loading, setLoading] = useState(true);
  const [botEvents, setBotEvents] = useState<TicketTreatEvent[]>([]);
  const [error, setError] = useState("");

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
          <div><h1>{t(language, "tickets")}</h1>{guest && <p>{guest.first_name} · {guest.visits} {language==="cs"?"návštěv":language==="ru"?"посещений":language==="uk"?"відвідувань":"check-ins"}</p>}</div>
        </section>

        {loading ? <div className="state-card">{t(language, "loading")}</div> :
          <>
          {error && <div className="state-card state-error" role="alert">{userFacingError(error,language)}</div>}
          {tickets.length === 0 && botEvents.length === 0 && !error && <ExampleTickets language={language}/>}
          {tickets.length > 0 && <div className="ticket-list">
            {tickets.map((ticket) => (
              <Link className={`ticket-row ${ticket.ticket_status === "cancelled" ? "ticket-cancelled" : ""}`} href={`/tickets/${ticket.id}`} key={ticket.id}>
                <div>
                  <small>{ticket.code}</small>
                  <h3>{ticket.event?.title || t(language, "ticket")}</h3>
                  <p>{formatDate(ticket.event?.starts_at || null, language)}</p>
                </div>
                <div className="ticket-row-right">
                  <strong>{ticket.event ? formatPrice(ticket.event, language) : `${ticket.payment_amount} ${ticket.currency}`}</strong>
                  <span className={`status ${ticket.checked_in_at ? "status-success" : "status-demo"}`}>
                    {ticket.ticket_status === "cancelled" ? t(language, "cancelledTicket") : ticket.checked_in_at ? t(language, "checkedIn") : (ticket.payment_provider==="free" ?
                      (language==="ru"?"Бесплатно":language==="cs"?"Zdarma":language==="uk"?"Безкоштовно":"Free") :
                      t(language, "paid"))}
                  </span>
                </div>
              </Link>
            ))}
          </div>}
          <p><Link href="/loyalty" className="button button-outline">{language==="ru"?"Мои награды и уровни →":language==="cs"?"Moje odměny a úrovně →":language==="uk"?"Мої нагороди та рівні →":"My rewards and tiers →"}</Link></p>
          {attendance&&<section className="panel" style={{marginTop:20}}>
            <h2>{language==="ru"?"История посещений":language==="cs"?"Historie návštěv":language==="uk"?"Історія відвідувань":"Attendance history"}</h2>
            <p>{attendance.visit_count} {language==="cs"?"návštěv":language==="ru"?"посещений":language==="uk"?"відвідувань":"check-ins"} {attendance.visit_count>=attendance.limited_to?(language==="cs"?"(posledních 100)":language==="ru"?"(последние 100)":language==="uk"?"(останні 100)":"(last 100)"):""}</p>
            {attendance.history.map((item,i)=><div key={`${item.event_id}-${i}`} className="participant-row">
              <div><strong>{item.title}</strong><small>{item.location||""}</small></div>
              <small>{new Date(item.checked_in_at).toLocaleString(localeForLanguage(language))}</small>
            </div>)}
          </section>}
          {botEvents.length > 0 && <section className="section telegram-bot-events">
            <div className="section-heading">
              <div><h2>{language==="ru"?"Записи через Telegram-бота":language==="uk"?"Реєстрації через Telegram-бота":language==="cs"?"Registrace přes Telegram bota":"Telegram bot registrations"}</h2>
              <p>{language==="ru"?"Существующие записи из бота. Это не QR-билеты.":language==="cs"?"Dřívější registrace z bota; nejde o QR vstupenky.":language==="uk"?"Попередні реєстрації з бота. Це не QR-квитки.":"Existing bot registrations are shown separately from QR tickets."}</p></div>
            </div>
            <div className="ticket-list">
              {botEvents.map(event => (
                <Link href={`/events/${event.id}`} className="ticket-row" key={event.id}>
                  <div>
                    <small>Telegram · #{event.id}</small>
                    <h3>{event.title}</h3>
                    <p>{formatDate(event.starts_at,language)}</p>
                  </div>
                  <div className="ticket-row-right">
                    <span className="status status-demo">{event.is_cancelled ?
                      t(language,"cancelledTicket") : event.payment_status === "pending" ?
                      (language==="ru"?"Ожидает оплаты":language==="uk"?"Очікує оплати":language==="cs"?"Čeká na platbu":"Payment pending") :
                      (language==="ru"?"Записан":language==="uk"?"Зареєстровано":language==="cs"?"Přihlášen":"Registered")}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>}
          </>}
      </main>
    </div>
  );
}
