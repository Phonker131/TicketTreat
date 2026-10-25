"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  CONSENT_EVENT, OPEN_CONSENT_EVENT, readConsent, saveConsent,
  type ConsentChoice,
} from "@/lib/cookie-consent";

const copy = {
  ru: {
    title:"Cookies и конфиденциальность",
    intro:"Необходимые cookies помогают войти в аккаунт и пользоваться TicketTreat. Если разрешишь дополнительные cookies, на страницах событий смогут загружаться карты Google. Рекламных и аналитических cookies у нас нет.",
    accept:"Разрешить cookies", reject:"Отклонить необязательные", settings:"Настроить",
    optionsTitle:"Настройки cookies",
    necessary:"Необходимые cookies и локальные настройки", necessaryInfo:"Всегда включены. Сессия, защита входа, язык, работа Mini App и сохранение выбора cookies. Без них некоторые функции не работают.",
    media:"Встроенные карты Google", mediaInfo:"Необязательные. При разрешении на странице события может загружаться Google Maps. Google может обрабатывать данные устройства и устанавливать собственные cookies.",
    noTracking:"Google Analytics, рекламные пиксели и маркетинговые cookies на TicketTreat сейчас не подключены. Их не активирует ни одна из этих кнопок.",
    save:"Сохранить мой выбор", close:"Закрыть", policy:"Политика cookies",
    hint:"Отказ не влияет на регистрацию и получение билетов. Выбор можно изменить в футере.",
  },
  en: {
    title:"Cookies and privacy",
    intro:"Essential cookies help you sign in and use TicketTreat. If you allow optional cookies, event pages can load Google Maps. We don't use advertising or analytics cookies.",
    accept:"Allow cookies", reject:"Reject optional", settings:"Customize",
    optionsTitle:"Cookie preferences",
    necessary:"Essential cookies and local preferences", necessaryInfo:"Always on. Sign-in, session security, language, Mini App features and remembering cookie choices. Some features require these technologies.",
    media:"Embedded Google Maps", mediaInfo:"Optional. When enabled, Google Maps can load on an event page. Google may receive device data and set its own cookies.",
    noTracking:"Google Analytics, advertising pixels and marketing cookies are not currently installed on TicketTreat. These buttons will not activate them.",
    save:"Save my choice",close:"Close",policy:"Cookie Policy",
    hint:"Rejecting optional media won't affect booking or tickets. You can change your choice in the footer.",
  },
  cs: {
    title:"Cookies a ochrana soukromí",
    intro:"Nezbytné cookies slouží k přihlášení a používání TicketTreat. Pokud povolíte volitelné cookies, na stránkách akcí se mohou zobrazit Mapy Google. Reklamní ani analytické cookies nepoužíváme.",
    accept:"Povolit cookies",reject:"Odmítnout volitelné",settings:"Nastavit",
    optionsTitle:"Nastavení cookies",
    necessary:"Nezbytné cookies a místní nastavení",necessaryInfo:"Vždy zapnuté. Přihlášení, zabezpečení relace, jazyk, funkce Mini App a uchování volby cookies. Bez nich nemusí některé funkce fungovat.",
    media:"Vložené Mapy Google",mediaInfo:"Volitelné. Po souhlasu lze na stránce akce načíst Mapy Google. Google může zpracovávat údaje zařízení a používat vlastní cookies.",
    noTracking:"Google Analytics, reklamní pixely ani marketingové cookies nyní v TicketTreat nepoužíváme. Žádné z těchto tlačítek je neaktivuje.",
    save:"Uložit volbu",close:"Zavřít",policy:"Zásady cookies",
    hint:"Odmítnutí neomezí rezervace ani vstupenky. Nastavení lze kdykoliv změnit v zápatí.",
  },
  uk: {
    title:"Cookies і конфіденційність",
    intro:"Необхідні cookies допомагають входити в акаунт і користуватися TicketTreat. Якщо дозволиш додаткові cookies, на сторінках подій зможуть завантажуватися карти Google. Рекламних та аналітичних cookies у нас немає.",
    accept:"Дозволити cookies",reject:"Відхилити необов’язкові",settings:"Налаштувати",
    optionsTitle:"Налаштування cookies",
    necessary:"Необхідні cookies та локальні налаштування",necessaryInfo:"Завжди ввімкнено. Вхід, захист сесії, мова, Mini App і збереження вибору cookies.",
    media:"Вбудовані Google Maps",mediaInfo:"Необов’язкові. Після дозволу карти можуть завантажуватися на сторінках подій. Google може обробляти дані пристрою й використовувати власні cookies.",
    noTracking:"Google Analytics, рекламні пікселі та маркетингові cookies зараз не підключені. Ці кнопки їх не вмикають.",
    save:"Зберегти вибір",close:"Закрити",policy:"Політика cookies",
    hint:"Відмова не обмежує реєстрацію чи квитки. Вибір можна змінити у футері.",
  },
} as const;

export function CookieConsentBanner() {
  const { language } = useLanguage();
  const tr = copy[language];
  const [loaded, setLoaded] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [mediaChecked, setMediaChecked] = useState(false);

  useEffect(() => {
    const restore = () => {
      const current = readConsent();
      setChoice(current);
      setMediaChecked(current?.externalMedia ?? false);
    };
    restore();
    setLoaded(true);
    const show = () => {
      const current = readConsent();
      setChoice(current);
      setMediaChecked(current?.externalMedia ?? false);
      setEditing(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, show);
    window.addEventListener(CONSENT_EVENT, restore);
    window.addEventListener("storage", restore);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, show);
      window.removeEventListener(CONSENT_EVENT, restore);
      window.removeEventListener("storage", restore);
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [editing]);

  const decide = (externalMedia: boolean) => {
    setChoice(saveConsent(externalMedia));
    setMediaChecked(externalMedia);
    setEditing(false);
  };
  if (!loaded || (choice && !editing)) return null;
  return <aside className="tt-consent-banner" aria-label={tr.title} data-testid="tt-cookie-banner">
    <div className="tt-consent-inner">
      <div className="tt-consent-heading">
        <span className="tt-consent-badge" aria-hidden="true">◈</span>
        <h2 id="tt-consent-title">{editing ? tr.optionsTitle : tr.title}</h2>
        {choice && editing && <button type="button" className="tt-consent-close" onClick={() => setEditing(false)} aria-label={tr.close}>×</button>}
      </div>
      <p className="tt-consent-description">{tr.intro}</p>
      {editing && <div className="tt-consent-categories">
        <div className="tt-consent-category">
          <div><strong>{tr.necessary}</strong><p>{tr.necessaryInfo}</p></div>
          <label className="tt-consent-status">
            <input type="checkbox" checked readOnly disabled aria-label={tr.necessary} /> <span>✓</span>
          </label>
        </div>
        <div className="tt-consent-category">
          <div><strong>{tr.media}</strong><p>{tr.mediaInfo}</p></div>
          <label className="tt-consent-toggle">
            <input aria-label={tr.media} type="checkbox" checked={mediaChecked}
              onChange={event => setMediaChecked(event.target.checked)}/>
            <span aria-hidden="true">{mediaChecked?"✓":"○"}</span>
          </label>
        </div>
        <p className="tt-consent-no-trackers">{tr.noTracking}</p>
      </div>}
      <p className="tt-consent-hint">{tr.hint} <Link href="/cookie-policy">{tr.policy} →</Link></p>
      <div className="tt-consent-actions">
        <button type="button" className="tt-consent-decision" onClick={() => decide(true)}>{tr.accept}</button>
        <button type="button" className="tt-consent-decision" onClick={() => decide(false)}>{tr.reject}</button>
        {editing
          ? <button type="button" className="tt-consent-secondary" onClick={() => decide(mediaChecked)}>{tr.save}</button>
          : <button type="button" className="tt-consent-secondary" onClick={() => setEditing(true)}>{tr.settings}</button>}
      </div>
    </div>
  </aside>;
}
