"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { createEvent, getEvents, verifyDemoAdminKey } from "@/lib/api";
import type { LanguageCode } from "@/lib/types";
import { getAdminKey, setAdminKey } from "@/lib/session";
import type { CrowdlyEvent } from "@/lib/types";

function getErrorText(error: unknown, action: "auth" | "create") {
  const status = (error as {status?: number})?.status;
  if (status === 401 || status === 403) {
    return "Неверный ключ администратора (401). Проверь DEMO_ADMIN_KEY в Railway → Demo API → Variables.";
  }
  if (status === 422) {
    return "Некорректные данные события или постер. Проверь обязательные поля, языки и формат JPG/PNG/WebP.";
  }
  if (status === 413) {
    return "Постер слишком большой. Максимальный размер — 4 МБ.";
  }
  if (status === 409) {
    return "Не удалось создать событие из-за конфликта данных. Попробуй изменить параметры.";
  }
  const raw = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return "Нет соединения с Demo API. Проверь подключение к интернету и повтори попытку.";
  }
  return (action === "auth" ? "Ошибка проверки ключа: " : "Ошибка создания события: ") + raw;
}

export function AdminClient() {
  const [adminKey, setKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [events, setEvents] = useState<CrowdlyEvent[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const keyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    const stored = getAdminKey();
    setKey(stored);

    if (stored) {
      verifyDemoAdminKey(stored)
        .then(() => { if (mounted) setAuthenticated(true); })
        .catch(() => {
          if (mounted) {
            setAuthenticated(false);
            setError("Сохранённый ключ админа больше не подходит. Введи действующий DEMO_ADMIN_KEY.");
          }
        });
    }

    getEvents(undefined, true)
      .then((data) => { if (mounted) setEvents(data); })
      .catch((err: unknown) => { if (mounted) setError(getErrorText(err, "create")); })
      .finally(() => { if (mounted) setLoadingEvents(false); });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!poster) {
      setPosterPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(poster);
    setPosterPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [poster]);

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл постера."));
      reader.readAsDataURL(file);
    });
  }

  async function saveKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = adminKey.trim();
    setError("");
    setMessage("");
    setAuthenticated(false);

    if (!value) {
      setError("Введите ключ администратора, чтобы создавать события.");
      keyInput.current?.focus();
      return;
    }

    setVerifying(true);
    try {
      const response = await verifyDemoAdminKey(value);
      if (!response.authenticated) throw new Error("authentication_not_confirmed");
      setAdminKey(value);
      setKey(value);
      setAuthenticated(true);
      setMessage("✓ Доступ администратора подтверждён. Теперь можно создавать ивенты.");
    } catch (err) {
      setAdminKey("");
      setError(getErrorText(err, "auth"));
    } finally {
      setVerifying(false);
    }
  }

  function toggleCreate() {
    setShowCreate((value) => !value);
    setMessage("");
    setError("");
    if (!authenticated) {
      setError("Для создания ивента сначала введи и сохрани правильный ключ администратора выше.");
      keyInput.current?.focus();
    }
  }

  async function submitEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;

    setError("");
    setMessage("");
    if (!authenticated || !adminKey.trim()) {
      setError("Сначала подтверди ключ администратора.");
      keyInput.current?.focus();
      return;
    }

    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const startsRaw = String(form.get("starts_at") || "");
    const price = Number(form.get("price") || "0");
    const title = String(form.get("title") || "").trim();
    const maxParticipants = Number(form.get("max_participants") || 30);

    if (!title || !startsRaw || !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(maxParticipants) || maxParticipants < 1) {
      setError("Заполни название, дату начала, допустимую цену и количество мест.");
      return;
    }

    if (new Date(startsRaw).getTime() <= Date.now()) {
      setError("Дата начала должна быть в будущем.");
      return;
    }

    const selectedLanguages = form.getAll("languages")
      .map(String)
      .filter((code): code is LanguageCode =>
        code === "en" || code === "cs" || code === "ru" || code === "uk"
      );
    if (!selectedLanguages.length) {
      setError("Выбери хотя бы один язык ивента.");
      return;
    }

    const posterFile = form.get("poster");
    if (posterFile instanceof File && posterFile.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(posterFile.type)) {
        setError("Для постера можно использовать только JPG, PNG или WebP.");
        return;
      }
      if (posterFile.size > 4 * 1024 * 1024) {
        setError("Размер постера не должен превышать 4 МБ.");
        return;
      }
    }

    setCreating(true);
    try {
      const posterDataUrl = posterFile instanceof File && posterFile.size > 0
        ? await fileToDataUrl(posterFile)
        : null;
      const result = await createEvent({
        title,
        organizer: String(form.get("organizer") || "Crowdly").trim(),
        location: String(form.get("location") || "").trim(),
        description: String(form.get("description") || "").trim(),
        max_participants: maxParticipants,
        price: price.toString(),
        currency: String(form.get("currency") || "CZK"),
        payment_instructions: price > 0 ? "DEMO PAYMENT — automatically confirmed" : null,
        languages: selectedLanguages,
        poster_data_url: posterDataUrl,
        starts_at: startsRaw + ":00",
        reminder_minutes_before: 180,
        reminder_text: "Your Crowdly event starts soon.",
      }, adminKey.trim());
      if (!result || !result.id) {
        throw new Error("The API did not return a created event.");
      }
      setEvents((current) => [result, ...current.filter((ev) => ev.id !== result.id)]);
      setShowCreate(false);
      setPoster(null);
      setMessage("✓ Ивент успешно создан! Выбранные языки и постер сохранены.");
      formElement.reset();
    } catch (err) {
      if ((err as {status?: number})?.status === 401) {
        setAuthenticated(false);
        setAdminKey("");
      }
      setError(getErrorText(err, "create"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">
        <div className="admin-heading">
          <div>
            <span className="status status-demo">DEMO ADMIN</span>
            <h1>Organizer dashboard</h1>
            <p>Events, guests, demo payments and check-in.</p>
          </div>
          <Link className="button button-sun" href="/admin/check-in">Scan ticket</Link>
        </div>

        <section className="panel admin-key-panel">
          <form onSubmit={saveKey} className="inline-form">
            <label>
              Demo admin key
              <input
                ref={keyInput}
                type="password"
                autoComplete="off"
                value={adminKey}
                onChange={(ev) => {
                  setKey(ev.target.value);
                  setAuthenticated(false);
                  setMessage("");
                }}
                placeholder="Ключ DEMO_ADMIN_KEY из Railway"
                aria-label="Demo admin key"
              />
            </label>
            <button type="submit" className="button button-outline" disabled={verifying}>
              {verifying ? "Проверяем…" : "Проверить ключ"}
            </button>
          </form>
          <small>
            {authenticated
              ? "✓ Admin access verified. Demo payments do not charge real money."
              : "Чтобы создать событие, введи DEMO_ADMIN_KEY из Railway → Demo API → Variables и нажми «Проверить ключ»."}
          </small>
        </section>

        {error && <div className="state-card state-error" role="alert">{error}</div>}
        {message && <div className="success-banner" role="status">{message}</div>}

        <div className="section-heading">
          <div>
            <h2>Events</h2>
            <p>{loadingEvents ? "Загрузка…" : `${events.length} total`}</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={toggleCreate}
            aria-expanded={showCreate}
          >
            {showCreate ? "Отменить" : "+ Create event"}
          </button>
        </div>

        {showCreate && (
          <form className="panel form-stack" onSubmit={submitEvent}>
            <h2>New demo event</h2>
            {!authenticated && (
              <div className="demo-banner">
                Сначала подтверди ключ в панели выше — без него сервер не разрешает создание событий.
              </div>
            )}
            <label>Title<input name="title" required maxLength={255} placeholder="Например: Crowdly Quiz Night" /></label>
            <label>Organizer<input name="organizer" defaultValue="Crowdly" /></label>
            <label>Location<input name="location" required placeholder="Prague" /></label>
            <label>Description<textarea name="description" rows={4} /></label>

            <div className="event-poster-field">
              <label htmlFor="event-poster-input">Event poster (optional)</label>
              <input
                id="event-poster-input"
                name="poster"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(ev) => {
                  setPoster(ev.target.files?.[0] || null);
                  setError("");
                }}
              />
              <small>JPG, PNG or WebP · maximum 4 MB. Uploaded posters are stored and displayed on the event page.</small>
              {posterPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="event-poster-preview" src={posterPreview} alt="Event poster preview" />
              )}
            </div>
            <fieldset className="event-language-fieldset">
              <legend>Event languages (choose one or more)</legend>
              <div className="event-language-options">
                <label><input name="languages" type="checkbox" value="en" defaultChecked /> 🇬🇧 English</label>
                <label><input name="languages" type="checkbox" value="cs" /> 🇨🇿 Čeština</label>
                <label><input name="languages" type="checkbox" value="ru" defaultChecked /> 🇷🇺 Русский</label>
                <label><input name="languages" type="checkbox" value="uk" /> 🇺🇦 Українська</label>
              </div>
            </fieldset>

            <div className="two-col">
              <label>Start<input name="starts_at" type="datetime-local" required /></label>
              <label>Capacity<input name="max_participants" type="number" min="1" step="1" defaultValue="30" /></label>
            </div>
            <div className="two-col">
              <label>Price<input name="price" type="number" min="0" step="0.01" defaultValue="350" /></label>
              <label>Currency
                <select name="currency" defaultValue="CZK">
                  <option>CZK</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </label>
            </div>
            <button type="submit" className="button button-primary" disabled={!authenticated || creating}>
              {creating ? "Creating…" : "Create event"}
            </button>
          </form>
        )}

        <div className="admin-event-grid">
          {events.map((event) => (
            <Link href={`/admin/events/${event.id}`} className="admin-event-card" key={event.id}>
              <small>#{event.id}</small>
              <h3>{event.title}</h3>
              <p>{event.location || "—"}</p>
              <div>
                <span>{event.registered_count ?? 0} guests</span>
                <span>{event.spots_left ?? "∞"} left</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
