"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

import { useLanguage } from "@/components/LanguageProvider";
import { getDemoTickets, getEvents, getMyAttendance } from "@/lib/api";
import {BrandIcon} from "@/components/BrandIcon";
import {useWanted} from "@/lib/wanted";
import type {AttendanceHistory} from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
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
  const [wanted,setWanted]=useWanted();
  const [catalogue,setCatalogue]=useState<TicketTreatEvent[]>([]);
  useEffect(()=>{
    if(!wanted.length||catalogue.length)return;
    const controller=new AbortController();
    getEvents(controller.signal).then(setCatalogue).catch(()=>{});
    return()=>controller.abort();
  },[wanted.length,catalogue.length]);
  const savedEvents=catalogue.filter(event=>wanted.includes(event.id)&&!event.is_cancelled);
  const guidance = {
    en: {empty:"No tickets here yet", find:"Browse events", book:"Choose an event and complete your booking. Confirmed tickets appear here.", login:"Already booked? Sign in with the account you used.", profile:"Open my profile", qr:"Open your event ticket to show the QR code at the door."},
    cs: {empty:"Zatím tu nejsou žádné vstupenky", find:"Prohlédnout akce", book:"Vyber si akci a dokonči rezervaci. Potvrzené vstupenky najdeš tady.", login:"Už máš rezervaci? Přihlas se stejným účtem.", profile:"Otevřít můj profil", qr:"U vstupu otevři vstupenku na svou akci a ukaž QR kód."},
    ru: {empty:"Здесь пока нет билетов", find:"Найти событие", book:"Выбери событие и заверши запись. Подтверждённые билеты появятся здесь.", login:"Уже записался? Войди в аккаунт, с которого оформил билет.", profile:"Открыть мой профиль", qr:"Открой билет на своё событие и покажи QR-код на входе."},
    uk: {empty:"Тут поки немає квитків", find:"Знайти подію", book:"Обери подію та заверши реєстрацію. Підтверджені квитки з’являться тут.", login:"Уже маєш квиток? Увійди в обліковий запис, з якого його оформив.", profile:"Відкрити мій профіль", qr:"Відкрий квиток на свою подію та покажи QR-код на вході."}
  }[language];
  const savedWords={
    ru:{title:"Хочу пойти",hint:"Ивенты, которые ты сохранил свайпом или сердечком. Это ещё не билеты.",remove:"Убрать из избранного"},
    cs:{title:"Chci jít",hint:"Akce uložené přejetím doprava nebo srdíčkem. Zatím to nejsou vstupenky.",remove:"Odebrat z uložených"},
    uk:{title:"Хочу піти",hint:"Події, збережені свайпом або сердечком. Це ще не квитки.",remove:"Прибрати з обраного"},
    en:{title:"Want to go",hint:"Events you saved with a swipe or the heart. These are not tickets yet.",remove:"Remove from saved"}
  }[language];

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
          <div><h1>{t(language, "tickets")}</h1>{tickets.length > 0 && <p>{guidance.qr}</p>}</div>
        </section>

        {loading ? <div className="state-card">{t(language, "loading")}</div> :
          <>
          {error && <div className="state-card state-error" role="alert">{userFacingError(error,language)}</div>}
          {tickets.length === 0 && botEvents.length === 0 && !error && (<section className="panel"><h2>{guidance.empty}</h2><p>{guidance.book}</p><Link href="/#events" className="button button-primary">{guidance.find}</Link>{!guest && <p>{guidance.login} <Link href="/profile">{guidance.profile}</Link></p>}</section>)}
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
                    {ticket.ticket_status === "cancelled" ? t(language, "cancelledTicket") : ticket.checked_in_at ? t(language, "checkedIn") : (ticket.payment_provider==="registration_only" ?
                      (language==="ru"?"Записан":language==="cs"?"Registrován":language==="uk"?"Записано":"Registered") :
                      ticket.payment_provider==="free" ?
                      (language==="ru"?"Бесплатно":language==="cs"?"Zdarma":language==="uk"?"Безкоштовно":"Free") :
                      t(language, "paid"))}
                  </span>
                </div>
              </Link>
            ))}
          </div>}
          {savedEvents.length>0&&<section className="section tp-saved-section" aria-labelledby="tp-saved-title">
            <div className="section-heading"><div><h2 id="tp-saved-title">{savedWords.title}</h2><p>{savedWords.hint}</p></div></div>
            <div className="ticket-list">
              {savedEvents.map(event=><div className="ticket-row tp-saved-row" key={event.id}>
                <Link href={`/events/${event.id}`} className="tp-saved-main">
                  <small>{event.location||"Praha"}</small>
                  <h3>{event.title}</h3>
                  <p>{formatDate(event.starts_at,language)}</p>
                </Link>
                <div className="ticket-row-right">
                  <strong>{formatPrice(event,language)}</strong>
                  <button type="button" className="tp-heart is-inline" aria-pressed="true" aria-label={savedWords.remove} onClick={()=>setWanted(event.id,false)}><BrandIcon name="heart" size={20}/></button>
                </div>
              </div>)}
            </div>
          </section>}
          <p><Link href="/loyalty" className="button button-outline">{language==="ru"?"Мои награды и уровни":language==="cs"?"Moje odměny a úrovně":language==="uk"?"Мої нагороди та рівні":"My rewards and tiers"}</Link></p>
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
                    <small>Telegram, #{event.id}</small>
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
<PageFaq topic="tickets"/>
      </main>
    </div>
  );
}
