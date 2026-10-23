import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";
import {LegalOperatorIdentity} from "@/components/LegalOperatorIdentity";

export const metadata:Metadata={
  title:"Terms of Service",
  description:"TicketTreat Terms of Service covering event registration, accounts, tickets and cancellations.",
};

export default function TermsPage(){
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-legal-page">
      <Link href="/" className="back-link">← TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / LEGAL</p>
      <h1 className="tt-legal-title">Terms of Service</h1>
      <p className="tt-legal-intro">Rules for using TicketTreat to discover events, register, receive tickets and manage your account.</p>
      <p className="tt-legal-updated">Last updated: 23 October 2026</p>
      <article className="tt-legal-content">
        <LegalOperatorIdentity/>
        <p className="tt-legal-language-note">English version below. <a href="#obchodni-podminky-cz">České obchodní podmínky ↓</a></p>
        <section>
          <h2>1. About the service</h2>
          <p>TicketTreat is the brand of an event-platform pilot in Czechia and is not itself a separate registered legal person. The operator identified above provides the platform account and ticketing interface. An event organizer remains responsible for providing accurate event information and holding the event. Before public paid ticket sales, the platform must clearly identify the actual contracting seller, whether an organizer is a trader, and the division of responsibilities before checkout.</p>
          <p>For platform support, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support on Telegram</a>. For questions about a specific event, please contact its organizer.</p>
        </section>
        <section>
          <h2>2. Accounts and access</h2>
          <p>You agree to provide accurate account information and maintain the security of your sign-in credentials. You must use accounts you own or are authorized to access and must not attempt to access another participant's bookings.</p>
          <p>You may sign in with email and password, Google or Telegram where those options are available. Connecting an external identity to an existing TicketTreat account may require separate confirmation of account ownership.</p>
        </section>
        <section>
          <h2>3. Event registration and tickets</h2>
          <p>Before registering, check the event organizer, venue, date and time, capacity, admission rules and event-specific conditions. Free registrations and paid tickets must be distinguishable. For any paid checkout, the contracting trader, total price including all taxes and compulsory fees, payment method and essential conditions must be displayed before placing a binding order. Paid checkout must not be activated until these disclosures and payment infrastructure have been verified.</p>
          <p>A TicketTreat ticket documents a reservation for the stated event. It is not valid for a different event, and an invalidated or cancelled QR ticket may be refused at check-in. Keep private ticket links and QR codes secure.</p>
        </section>
        <section>
          <h2>4. Changes, cancellations and refunds</h2>
          <p>Events may be changed or cancelled by their organizer. TicketTreat may deliver service notifications to verified email or linked Telegram channels. The trader responsible for a paid event must explain cancellation, rescheduling, complaint and refund arrangements before purchase. Non-waivable consumer rights remain unaffected.</p>
          <p>Under Czech Civil Code § 1837(j), the usual 14-day no-reason withdrawal right generally does not apply to contracts for leisure activities supplied on a specific date or during a defined period (such as a ticket to a dated concert). <strong>This is not a blanket rule for every kind of service or purchase</strong>; any applicable right to withdraw, refunds or remedies for cancellation or non-performance remains governed by Czech/EU law and the actual contract.</p>
          <p>Where payments are available, the platform must identify who receives the payment and handles refunds, issue applicable confirmations and ensure that any payment obligation is unambiguous. The availability of a reservation does not guarantee that an event will proceed unchanged.</p>
        </section>
        <section>
          <h2>5. Acceptable use</h2>
          <p>Do not interfere with TicketTreat systems, bypass ticket checks, misuse participant information, automate abusive registrations, distribute fraudulent tickets or interfere with other users. Organizers must use participant information only as authorized and comply with laws and notices applicable to their events.</p>
        </section>
        <section>
          <h2>6. Availability and changes to the pilot</h2>
          <p>TicketTreat is in active development. Features, supported event types and integrations may change, and maintenance or outages may temporarily interrupt access. Where practicable, we will give notice of changes that materially affect existing registrations. Nothing in these terms excludes rights that cannot lawfully be excluded.</p>
        </section>
        <section>
          <h2>7. Personal information</h2>
          <p>Read the <Link href="/privacy-policy">Privacy Policy</Link> for information about account data, Google and Telegram sign-in, ticket records, service providers and your data protection rights.</p>
        </section>
        <section>
          <h2>8. Complaints and alternative dispute resolution</h2>
          <p>For event-related complaints, first contact the organizer or trader identified in the event booking. For platform-related issues, contact TicketTreat support. Where the operator or organizer acts as a Czech trader in a consumer contract, the responsible trader must provide the legally required complaint contact and information about alternative dispute resolution. For many consumer disputes about goods and services, this is the <a href="https://coi.gov.cz/informace-o-adr/" target="_blank" rel="noopener noreferrer">Czech Trade Inspection Authority (ČOI), ADR</a>. This does not replace your rights to a court remedy.</p>
        </section>
        <section>
          <h2>9. Questions and updates</h2>
          <p>For platform questions, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support</a>. These terms may be updated as the pilot evolves. The current version and update date are published at this URL.</p>
        </section>
        <section id="obchodni-podminky-cz" lang="cs" className="tt-legal-czech">
          <h2>Obchodní podmínky – české znění</h2>
          <p><strong>1. Provozovatel a účel:</strong> TicketTreat je značka služby pro vyhledávání akcí, registraci účastníků a vystavování elektronických vstupenek. Samotná značka není právnickou osobou. Skutečný provozovatel a správce dat musí být uveden v identifikačním bloku této stránky. Není-li identifikace zveřejněna, není služba připravena k veřejnému komerčnímu provozu.</p>
          <p><strong>2. Účty:</strong> při registraci uveďte pravdivé údaje a chraňte své přihlašovací prostředky. Přihlášení přes Google a Telegram je dobrovolné; propojení stávajícího účtu může vyžadovat dodatečné ověření. Není dovoleno zneužívat cizí účet nebo získávat cizí vstupenky.</p>
          <p><strong>3. Pořadatel a smluvní strana:</strong> popis každé akce musí jasně uvádět pořadatele, místo, čas, pravidla účasti a kontakt. Je-li vstupenka placená, musí být před potvrzením objednávky identifikován konkrétní prodávající/podnikatel a určeno, kdo nese odpovědnost za konání akce, přijetí platby a případné vrácení peněz. Pokud služby nabízí třetí strana, je nutné podle příslušných předpisů informovat také o jejím postavení a rozdělení povinností.</p>
          <p><strong>4. Cena a objednávka:</strong> bezplatná registrace musí být označena jako bezplatná. U placeného prodeje musí být před uzavřením smlouvy uvedena úplná konečná cena včetně daní a povinných poplatků, platební podmínky a případná omezení. Tlačítko vytvářející povinnost platby musí tuto povinnost jednoznačně vyjadřovat. Do ověření těchto náležitostí nemá být placená pokladna veřejně aktivována.</p>
          <p><strong>5. Vstupenky:</strong> vstupenka a QR kód platí pouze pro příslušnou akci podle zveřejněných podmínek. Chraňte své osobní odkazy a QR kódy. Padělané a neplatné vstupenky nelze použít. Zákonná práva spotřebitele tím nejsou omezena.</p>
          <p><strong>6. Odstoupení, storno a refundace:</strong> u služeb využití volného času poskytovaných v určitém termínu zpravidla není podle § 1837 písm. j) občanského zákoníku zákonné 14denní právo odstoupit bez udání důvodu (například vstupenka na koncert s pevným datem). To neplatí automaticky pro všechny služby a nevylučuje práva v případě zrušení akce, vadného či neposkytnutého plnění. Konkrétní storno podmínky, postup reklamace a vracení peněz musí prodávající sdělit před nákupem.</p>
          <p><strong>7. Změny a dostupnost:</strong> pořadatel může akci změnit nebo zrušit. O významných změnách může TicketTreat zaslat provozní zprávy na ověřené komunikační kanály. Pilotní platforma může být dočasně nedostupná, aniž by tím byla dotčena kogentní práva uživatelů.</p>
          <p><strong>8. Reklamace a řešení sporů:</strong> s reklamací se nejprve obraťte na skutečného prodávajícího či pořadatele uvedeného u akce; s problémem účtu na podporu TicketTreat. Tam, kde se uplatní zákon o ochraně spotřebitele, musí podnikatel uvést příslušný subjekt mimosoudního řešení sporů. Pro řadu spotřebitelských sporů je jím <a href="https://coi.gov.cz/informace-o-adr/">Česká obchodní inspekce – ADR</a>. Právo obrátit se na soud tím není dotčeno.</p>
          <p><strong>9. Osobní údaje a změny:</strong> informace o zpracování údajů najdete v <a href="/privacy-policy">zásadách ochrany osobních údajů</a>. Aktualizované podmínky jsou zveřejňovány na této stránce. Provozovatel nemůže jednostranně odejmout již vzniklá zákonná práva ani zpětně měnit uzavřené smlouvy v rozporu se zákonem.</p>
        </section>
      </article>
    </main>
  </div>;
}
