"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getDemoTickets } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getVerifiedTelegramSession, restoreGuest } from "@/lib/session";
import type { CrowdlyEvent, DemoGuest, DemoTicket } from "@/lib/types";

export function TicketsClient() {
  const {language} = useLanguage();
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [botEvents, setBotEvents] = useState<CrowdlyEvent[]>([]);
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
          <div><h1>{t(language, "tickets")}</h1>{guest && <p>{guest.first_name} · {guest.visits} check-ins</p>}</div>
        </section>

        {loading ? <div className="state-card">{t(language, "loading")}</div> :
          <>
          {error && <div className="state-card state-error" role="alert">{error}</div>}
          {tickets.length === 0 && botEvents.length === 0 && <div className="state-card">{t(language, "noTickets")}</div>}
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
          {botEvents.length > 0 && <section className="section telegram-bot-events">
            <div className="section-heading">
              <div><h2>{language==="ru"?"Записи через Telegram-бота":language==="uk"?"Записи через Telegram-бота":language==="cs"?"Registrace přes Telegram bota":"Telegram bot registrations"}</h2>
              <p>{language==="ru"?"Существующие записи из бота. Это не QR-билеты.":language==="cs"?"Dřívější registrace z bota; nejde o QR vstupenky.":"Existing bot registrations are shown separately from QR tickets."}</p></div>
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
