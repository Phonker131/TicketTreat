"use client";

import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { EventCard } from "@/components/EventCard";
import { useLanguage } from "@/components/LanguageProvider";
import { getEvents } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { CrowdlyEvent } from "@/lib/types";

export function HomeClient() {
  const { language } = useLanguage();
  const [events, setEvents] = useState<
    CrowdlyEvent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    getEvents(controller.signal)
      .then((items) => {
        setEvents(
          items.filter(
            (event) => !event.is_cancelled,
          ),
        );
      })
      .catch((requestError) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unknown error",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="page">
        <section className="hero">
          <div className="hero-pattern">
            <span className="hero-you" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">
              CROWDLY
            </p>
            <h1>{t(language, "upcoming")}</h1>
            <p>{t(language, "tagline")}</p>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <h2>{t(language, "home")}</h2>
              <p>
                {t(language, "upcomingHint")}
              </p>
            </div>
          </div>

          {loading && (
            <div className="state-card">
              {t(language, "loading")}
            </div>
          )}

          {!loading && error && (
            <div className="state-card state-error">
              {t(language, "loadError")}
              <small>{error}</small>
            </div>
          )}

          {!loading &&
            !error &&
            events.length === 0 && (
              <div className="state-card">
                {t(language, "noEvents")}
              </div>
            )}

          {!loading &&
            !error &&
            events.length > 0 && (
              <div className="event-grid">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                  />
                ))}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}
