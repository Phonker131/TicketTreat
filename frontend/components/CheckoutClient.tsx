"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { createDemoGuest, demoCheckout, getEvent, joinWaitlist } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getStoredGuestToken, restoreGuest, storeGuest } from "@/lib/session";
import type { CrowdlyEvent, DemoGuest } from "@/lib/types";

type PaymentMethod = "card" | "apple" | "google";

export function CheckoutClient() {
  const params = useParams<{id: string}>();
  const router = useRouter();
  const search = useSearchParams();
  const { language } = useLanguage();

  const eventId = Number(params?.id);
  const wantsWaitlist = search.get("waitlist") === "1";

  const [event, setEvent] = useState<CrowdlyEvent | null>(null);
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [loadingGuest, setLoadingGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!Number.isFinite(eventId)) return;
    getEvent(eventId).then(setEvent).catch(() => setMessage(t(language, "eventNotFound")));
  }, [eventId, language]);

  useEffect(() => {
    restoreGuest()
      .then(setGuest)
      .finally(() => setLoadingGuest(false));
  }, []);

  const price = useMemo(() => event ? formatPrice(event, language) : "", [event, language]);

  async function submitGuest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const created = await createDemoGuest({
        first_name: firstName,
        last_name: lastName || null,
        email,
      });
      storeGuest(created);
      setGuest(created);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function performCheckout() {
    if (!event || !guest) return;
    setBusy(true);
    setMessage(null);
    try {
      if (wantsWaitlist || event.spots_left === 0) {
        const result = await joinWaitlist(event.id, guest.access_token);
        setMessage(`${t(language, "waitlistJoined")}${result.position ? ` #${result.position}` : ""}`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
      const result = await demoCheckout(event.id, guest.access_token, language);
      router.push(`/tickets/${result.ticket.id}?paid=1`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Error";
      if (text === "event_full") {
        setMessage(t(language, "soldOut"));
      } else {
        setMessage(text);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="checkout-header">
          <span className="status status-demo">{t(language, "demo")}</span>
          <h1>{t(language, "checkout")}</h1>
          <p>{t(language, "demoHint")}</p>
        </div>

        {!event || loadingGuest ? (
          <div className="state-card">{t(language, "loading")}</div>
        ) : (
          <>
            <section className="checkout-summary">
              <div>
                <small>{event.organizer || "Crowdly"}</small>
                <h2>{event.title}</h2>
              </div>
              <strong>{price}</strong>
            </section>

            {!guest ? (
              <>
              <section className="panel account-signup-banner">
                <h2>{language === "en" ? "Create your Crowdly profile" : language === "cs" ? "Vytvoř si profil Crowdly" : language === "uk" ? "Створи профіль Crowdly" : "Создай профиль Crowdly"}</h2>
                <p>{language === "en" ? "Sign up or log in to save your tickets and access them from any device." : language === "cs" ? "Přihlas se nebo zaregistruj, abys měl vstupenky na všech zařízeních." : language === "uk" ? "Зареєструйся або увійди, щоб квитки були доступні з будь-якого пристрою." : "Зарегистрируйся или войди, чтобы билеты сохранялись в профиле и были доступны с любого устройства."}</p>
                <Link href="/profile" className="button button-primary">
                  {language === "en" ? "Sign up / Log in" : language === "cs" ? "Registrovat / Přihlásit se" : language === "uk" ? "Реєстрація / Вхід" : "Регистрация / Вход"}
                </Link>
              </section>
              <form className="panel form-stack" onSubmit={submitGuest}>
                <h2>{language === "en" ? "Or continue as a demo guest" : language === "cs" ? "Nebo pokračuj jako demo host" : language === "uk" ? "Або продовж як демо-гість" : "Или продолжить как демо-гость"}</h2>
                <h2>{t(language, "yourDetails")}</h2>
                <label>{t(language, "firstName")}<input required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
                <label>{t(language, "lastName")}<input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
                <label>{t(language, "email")}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <button className="button button-primary" disabled={busy}>{busy ? t(language, "loading") : t(language, "continue")}</button>
              </form>
              </>
            ) : (
              <section className="panel">
                <div className="guest-chip">
                  <div className="avatar">{guest.first_name.charAt(0).toUpperCase()}</div>
                  <div><strong>{guest.first_name} {guest.last_name || ""}</strong><small>{guest.email || `Telegram ${guest.telegram_id}`}</small></div>
                </div>

                {wantsWaitlist || event.spots_left === 0 ? (
                  <>
                    <h2>{t(language, "waitlist")}</h2>
                    <p>{t(language, "soldOut")}</p>
                    <button className="button button-sun button-wide" onClick={performCheckout} disabled={busy}>
                      {busy ? t(language, "loading") : t(language, "waitlist")}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>{t(language, "payment")}</h2>
                    <div className="demo-banner">{t(language, "demoHint")}</div>
                    <div className="payment-methods">
                      {[
                        ["card", "💳", t(language, "card")],
                        ["apple", "", t(language, "applePay")],
                        ["google", "G", t(language, "googlePay")],
                      ].map(([key, icon, label]) => (
                        <button
                          type="button"
                          key={key}
                          className={`payment-method ${method === key ? "selected" : ""}`}
                          onClick={() => setMethod(key as PaymentMethod)}
                        >
                          <span>{icon}</span><strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                    {method === "card" && (
                      <div className="fake-card-fields">
                        <input value="4242 4242 4242 4242" readOnly aria-label="Demo card number" />
                        <div><input value="12/30" readOnly aria-label="Expiry" /><input value="123" readOnly aria-label="CVC" /></div>
                      </div>
                    )}
                    <button className="button button-primary button-wide" onClick={performCheckout} disabled={busy}>
                      {busy ? t(language, "loading") : `${t(language, "pay")} ${price}`}
                    </button>
                  </>
                )}
              </section>
            )}
          </>
        )}

        {message && <div className="state-card">{message}</div>}
      </main>
    </div>
  );
}
