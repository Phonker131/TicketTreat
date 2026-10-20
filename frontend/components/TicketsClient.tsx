"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getDemoTickets } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { restoreGuest } from "@/lib/session";
import type { DemoGuest, DemoTicket } from "@/lib/types";

export function TicketsClient() {
  const {language} = useLanguage();
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreGuest()
      .then(async (g) => {
        setGuest(g);
        if (g) setTickets(await getDemoTickets(g.access_token));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">
        <section className="section-heading">
          <div><h1>{t(language, "tickets")}</h1>{guest && <p>{guest.first_name} · {guest.visits} check-ins</p>}</div>
        </section>

        {loading ? <div className="state-card">{t(language, "loading")}</div> :
          tickets.length === 0 ? <div className="state-card">{t(language, "noTickets")}</div> :
          <div className="ticket-list">
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
                    {ticket.ticket_status === "cancelled" ? t(language, "cancelledTicket") : ticket.checked_in_at ? t(language, "checkedIn") : t(language, "paid")}
                  </span>
                </div>
              </Link>
            ))}
          </div>}
      </main>
    </div>
  );
}
