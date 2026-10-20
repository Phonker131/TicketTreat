"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { createEvent, getEvents } from "@/lib/api";
import { getAdminKey, setAdminKey } from "@/lib/session";
import type { CrowdlyEvent } from "@/lib/types";

export function AdminClient() {
  const [adminKey, setKey] = useState("");
  const [events, setEvents] = useState<CrowdlyEvent[]>([]);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setKey(getAdminKey());
    getEvents(undefined, true).then(setEvents).catch(() => {});
  }, []);

  function saveKey(e: FormEvent) {
    e.preventDefault();
    setAdminKey(adminKey);
    setMessage("Admin key saved locally.");
  }

  async function submitEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const startsRaw = String(form.get("starts_at") || "");
    const price = String(form.get("price") || "0");
    const result = await createEvent({
      title: String(form.get("title") || ""),
      organizer: String(form.get("organizer") || "Crowdly"),
      location: String(form.get("location") || ""),
      description: String(form.get("description") || ""),
      max_participants: Number(form.get("max_participants") || 30),
      price,
      currency: String(form.get("currency") || "CZK"),
      payment_instructions: Number(price) > 0 ? "DEMO PAYMENT — automatically confirmed" : null,
      languages: ["en", "cs", "ru", "uk"],
      starts_at: startsRaw ? `${startsRaw}:00` : null,
      reminder_minutes_before: 180,
      reminder_text: "Your Crowdly event starts soon.",
    }, adminKey);
    setEvents((current) => [...current, result]);
    setShowCreate(false);
    setMessage("Event created.");
    e.currentTarget.reset();
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">
        <div className="admin-heading">
          <div><span className="status status-demo">DEMO ADMIN</span><h1>Organizer dashboard</h1><p>Events, guests, demo payments and check-in.</p></div>
          <Link className="button button-sun" href="/admin/check-in">Scan ticket</Link>
        </div>

        <section className="panel admin-key-panel">
          <form onSubmit={saveKey} className="inline-form">
            <label>Demo admin key<input value={adminKey} onChange={(e) => setKey(e.target.value)} placeholder="Enter secure demo admin key" /></label>
            <button className="button button-outline">Save key</button>
          </form>
          <small>Set the same value in Railway variable DEMO_ADMIN_KEY.</small>
        </section>

        {message && <div className="success-banner">{message}</div>}

        <div className="section-heading">
          <div><h2>Events</h2><p>{events.length} total</p></div>
          <button className="button button-primary" onClick={() => setShowCreate((v) => !v)}>+ Create event</button>
        </div>

        {showCreate && (
          <form className="panel form-stack" onSubmit={submitEvent}>
            <h2>New demo event</h2>
            <label>Title<input name="title" required /></label>
            <label>Organizer<input name="organizer" defaultValue="Crowdly" /></label>
            <label>Location<input name="location" required /></label>
            <label>Description<textarea name="description" rows={4} /></label>
            <div className="two-col">
              <label>Start<input name="starts_at" type="datetime-local" required /></label>
              <label>Capacity<input name="max_participants" type="number" min="1" defaultValue="30" /></label>
            </div>
            <div className="two-col">
              <label>Price<input name="price" type="number" min="0" step="0.01" defaultValue="350" /></label>
              <label>Currency<select name="currency" defaultValue="CZK"><option>CZK</option><option>EUR</option><option>USD</option></select></label>
            </div>
            <button className="button button-primary">Create event</button>
          </form>
        )}

        <div className="admin-event-grid">
          {events.map((event) => (
            <Link href={`/admin/events/${event.id}`} className="admin-event-card" key={event.id}>
              <small>#{event.id}</small>
              <h3>{event.title}</h3>
              <p>{event.location || "—"}</p>
              <div><span>{event.registered_count ?? 0} guests</span><span>{event.spots_left ?? "∞"} left</span></div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
