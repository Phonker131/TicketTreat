import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";
import {LegalOperatorIdentity} from "@/components/LegalOperatorIdentity";

export const metadata:Metadata={
  title:"Legal Notice / Provozovatel",
  description:"TicketTreat operator information, privacy contact and Czech consumer complaint information.",
};
export default function LegalNoticePage(){
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-legal-page">
      <Link href="/" className="back-link">← TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / LEGAL</p>
      <h1 className="tt-legal-title">Legal Notice / Provozovatel</h1>
      <p className="tt-legal-updated">Last updated / Poslední aktualizace: 23 October 2026</p>
      <article className="tt-legal-content">
        <LegalOperatorIdentity/>
        <section>
          <h2>Platform / Služba</h2>
          <p>TicketTreat.eu is an event registration and ticketing platform initially operating in Czechia. TicketTreat is a project brand, not by itself a registered legal entity. Any person acting as the platform operator or ticket seller must accurately publish the details required by Czech law before the service is publicly marketed or commercial sales begin.</p>
          <p lang="cs">TicketTreat.eu je platforma pro registraci na akce a elektronické vstupenky působící nejprve v Česku. TicketTreat je značka projektu, nikoliv sama o sobě právnická osoba. Skutečný provozovatel a případný prodávající musí před veřejným komerčním provozem zveřejnit zákonem požadované identifikační údaje.</p>
        </section>
        <section>
          <h2>Help, complaints and privacy / Podpora, reklamace a ochrana údajů</h2>
          <p>For platform help, use <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support</a>. For data requests, contact the verified controller privacy email displayed above. For problems with the event or a paid ticket, the relevant organizer/trader, identified at checkout, is the primary contract contact.</p>
          <p lang="cs">S požadavky týkajícími se účtu kontaktujte podporu TicketTreat. Pro výkon práv podle GDPR použijte ověřený kontakt správce uvedený výše. Za konkrétní akci nebo placenou vstupenku odpovídá skutečný pořadatel či prodávající určený před uzavřením smlouvy.</p>
          <p>Where Czech consumer ADR rules apply to the contracting trader, information on the competent body must be provided. For many service disputes it is <a href="https://coi.gov.cz/informace-o-adr/" target="_blank" rel="noopener noreferrer">Česká obchodní inspekce (ČOI)</a>.</p>
        </section>
        <section>
          <h2>Legal documents / Právní dokumenty</h2>
          <p><Link href="/privacy-policy">Privacy Policy / Ochrana osobních údajů</Link> · <Link href="/terms">Terms of Service / Obchodní podmínky</Link></p>
        </section>
      </article>
    </main>
  </div>;
}
