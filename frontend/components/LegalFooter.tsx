"use client";

import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";
import {openCookieSettings} from "@/lib/cookie-consent";

const labels = {
  en: {tagline:"Tickets and events across Czechia",rights:"All rights reserved.",support:"Support",faq:"FAQ",privacy:"Privacy Policy",cookies:"Cookie Policy",terms:"Terms of Service",legal:"Legal Notice / Operator"},
  ru: {tagline:"Билеты и мероприятия в Чехии",rights:"Все права защищены.",support:"Поддержка",faq:"FAQ",privacy:"Политика конфиденциальности",cookies:"Политика cookies",terms:"Условия использования",legal:"Сведения об операторе"},
  cs: {tagline:"Vstupenky a akce v Česku",rights:"Všechna práva vyhrazena.",support:"Podpora",faq:"FAQ",privacy:"Ochrana osobních údajů",cookies:"Zásady cookies",terms:"Obchodní podmínky",legal:"Informace o provozovateli"},
  uk: {tagline:"Квитки та події в Чехії",rights:"Усі права захищено.",support:"Підтримка",faq:"FAQ",privacy:"Політика конфіденційності",cookies:"Політика cookies",terms:"Умови користування",legal:"Відомості про оператора"},
};

export function LegalFooter(){
  const {language}=useLanguage();
  const tr=labels[language];
  return (
    <footer className="tt-support-footer tt-legal-footer" aria-label="TicketTreat legal information and support">
      <div className="tt-legal-footer-brand">
        <Link className="tt-legal-footer-home" href="/" aria-label="TicketTreat homepage">
          <img src="/app-icon-256.png" alt="" width={48} height={48}/>
          <span>TicketTreat</span>
        </Link>
        <small>{tr.tagline}</small>
        <p>© {new Date().getFullYear()} TicketTreat. {tr.rights}</p>
      </div>
      <nav className="tt-legal-footer-links" aria-label="Legal and support links">
        <Link href="/privacy-policy">{tr.privacy}</Link>
        <Link href="/cookie-policy">{tr.cookies}</Link>
        <button type="button" className="tt-cookie-settings-link" onClick={openCookieSettings}>{language==="ru"?"Настройки cookies":language==="cs"?"Nastavení cookies":language==="uk"?"Налаштування cookies":"Cookie settings"}</button>
        <Link href="/terms">{tr.terms}</Link>
        <Link href="/legal-notice">{tr.legal}</Link>
        <Link href={language==="ru"?"/faq":"/"+language+"/faq"}>{tr.faq}</Link>
        <Link href="/support">{tr.support}</Link>
        <Link className="tt-business-footer-link" href="/organizers">
          {language==="ru"?"Для организаторов и фирм":language==="cs"?"Pro pořadatele a firmy":language==="uk"?"Для організаторів і компаній":"For organizers and businesses"}
        </Link>
        <a href="https://t.me/TicketTreatBot" target="_blank" rel="noopener noreferrer" aria-label="Official TicketTreat Telegram bot">Telegram ↗</a>
      </nav>
    </footer>
  );
}
