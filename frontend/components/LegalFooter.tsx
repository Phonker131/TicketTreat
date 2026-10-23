"use client";

import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";

const labels = {
  en: {tagline:"Tickets and events across Czechia",rights:"All rights reserved.",support:"Support"},
  ru: {tagline:"Билеты и мероприятия в Чехии",rights:"Все права защищены.",support:"Поддержка"},
  cs: {tagline:"Vstupenky a akce v Česku",rights:"Všechna práva vyhrazena.",support:"Podpora"},
  uk: {tagline:"Квитки та події в Чехії",rights:"Усі права захищено.",support:"Підтримка"},
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
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/legal-notice">Legal Notice / Provozovatel</Link>
        <Link href="/support">{tr.support}</Link>
        <a href="https://t.me/TicketTreatBot" target="_blank" rel="noopener noreferrer" aria-label="Official TicketTreat Telegram bot">Telegram ↗</a>
      </nav>
    </footer>
  );
}
