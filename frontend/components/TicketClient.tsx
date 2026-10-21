"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { cancelDemoTicket, getDemoTicket } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { restoreGuest } from "@/lib/session";
import type { DemoTicket } from "@/lib/types";

export function TicketClient() {
  const {language} = useLanguage();
  const params = useParams<{id: string}>();
  const search = useSearchParams();
  const [ticket, setTicket] = useState<DemoTicket | null>(null);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState(search.get("paid") === "1" ? t(language, "paymentSuccess") : null);

  async function load() {
    const guest = await restoreGuest();
    if (!guest || !params?.id) return;
    const data = await getDemoTicket(guest.access_token, params.id);
    setTicket(data);
    setQr(await QRCode.toDataURL(`CROWDLY:TICKET:${data.qr_token}`, {width: 360, margin: 1}));
  }

  useEffect(() => { load().catch(() => setMessage(t(language, "loadError"))); }, [params?.id]);

  async function cancel() {
    if (!ticket) return;
    const guest = await restoreGuest();
    if (!guest) return;
    if (!window.confirm(t(language, "cancelTicket"))) return;
    const result = await cancelDemoTicket(guest.access_token, ticket.id);
    setTicket(result.ticket);
    setMessage(t(language, "cancelledTicket"));
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <Link href="/tickets" className="back-link">← {t(language, "tickets")}</Link>
        {message && <div className="success-banner">{message}</div>}
        {!ticket ? <div className="state-card">{t(language, "loading")}</div> : (
          <article className={`ticket-card ${ticket.ticket_status === "cancelled" ? "ticket-card-cancelled" : ""}`}>
            <div className="ticket-top">
              <span className="status status-demo">{t(language, "demo")}</span>
              <strong>{ticket.code}</strong>
            </div>
            <div className="ticket-main">
              <p className="eyebrow">CROWDLY PASS</p>
              <h1>{ticket.event?.title}</h1>
              <div className="ticket-facts">
                <div><span>{t(language, "startsAt")}</span><strong>{formatDate(ticket.event?.starts_at || null, language)}</strong></div>
                <div><span>{t(language, "location")}</span><strong>{ticket.event?.location || "—"}</strong></div>
                <div><span>{t(language, "price")}</span><strong>{ticket.event ? formatPrice(ticket.event, language) : `${ticket.payment_amount} ${ticket.currency}`}</strong></div>
              </div>
              {qr && ticket.ticket_status === "active" && (
                <div className="qr-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Crowdly ticket QR" />
                  <p>{t(language, "qrHint")}</p>
                </div>
              )}
              <div className="ticket-status-grid">
                <span className="status status-success">✓ {t(language, "paid")}</span>
                <span className={`status ${ticket.checked_in_at ? "status-success" : "status-muted"}`}>
                  {ticket.checked_in_at ? t(language, "checkedIn") : t(language, "notCheckedIn")}
                </span>
              </div>
              <div className="demo-banner">{t(language, "demoHint")}</div>
              {ticket.ticket_status === "active" && !ticket.checked_in_at && (
                <button className="button button-outline button-wide" onClick={cancel}>{t(language, "cancelTicket")}</button>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
