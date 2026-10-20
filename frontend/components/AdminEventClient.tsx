"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { adminCheckIn, getAdminEventTickets } from "@/lib/api";
import { getAdminKey } from "@/lib/session";
import type { AdminEventTickets } from "@/lib/types";

export function AdminEventClient() {
  const params = useParams<{id: string}>();
  const eventId = Number(params?.id);
  const [data, setData] = useState<AdminEventTickets | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const result = await getAdminEventTickets(eventId, getAdminKey());
      setData(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => { if (eventId) load(); }, [eventId]);

  async function checkIn(qrToken: string) {
    try {
      await adminCheckIn(qrToken, getAdminKey());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">
        <Link href="/admin" className="back-link">← Organizer dashboard</Link>
        {error && <div className="state-card state-error">{error}</div>}
        {!data ? <div className="state-card">Loading…</div> : (
          <>
            <div className="admin-heading">
              <div><span className="status status-demo">EVENT #{data.event.id}</span><h1>{data.event.title}</h1><p>{data.event.location}</p></div>
              <Link className="button button-sun" href={`/admin/check-in?event=${data.event.id}`}>Scan QR</Link>
            </div>

            <div className="stats-grid">
              <div className="stat-card"><strong>{data.tickets.filter((t) => t.ticket_status === "active").length}</strong><span>Tickets</span></div>
              <div className="stat-card"><strong>{data.tickets.filter((t) => t.checked_in_at).length}</strong><span>Checked in</span></div>
              <div className="stat-card"><strong>{data.waitlist.filter((w) => w.status === "waiting").length}</strong><span>Waitlist</span></div>
            </div>

            <section className="panel">
              <h2>Participants</h2>
              <div className="participant-list">
                {data.tickets.length === 0 && <p>No tickets yet.</p>}
                {data.tickets.map((ticket) => (
                  <div className="participant-row" key={ticket.id}>
                    <div>
                      <strong>{ticket.guest?.first_name} {ticket.guest?.last_name}</strong>
                      <small>{ticket.guest?.email || `Telegram ${ticket.guest?.telegram_id || ""}`}</small>
                      <small>{ticket.code} · {ticket.payment_status}</small>
                    </div>
                    <div className="participant-actions">
                      <span className={`status ${ticket.checked_in_at ? "status-success" : ticket.ticket_status === "cancelled" ? "status-danger" : "status-demo"}`}>
                        {ticket.ticket_status === "cancelled" ? "Cancelled" : ticket.checked_in_at ? "Checked in" : "Paid"}
                      </span>
                      {ticket.ticket_status === "active" && !ticket.checked_in_at && (
                        <button className="button button-outline" onClick={() => checkIn(ticket.qr_token)}>Check in</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Waitlist</h2>
              {data.waitlist.filter((w) => w.status === "waiting").length === 0 ? <p>No one is waiting.</p> :
                data.waitlist.filter((w) => w.status === "waiting").map((w, index) => (
                  <div className="participant-row" key={w.id}><div><strong>#{index + 1} {w.guest.first_name} {w.guest.last_name}</strong><small>{w.guest.email}</small></div><span className="status status-muted">Waiting</span></div>
                ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
