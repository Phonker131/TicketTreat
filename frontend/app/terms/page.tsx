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
          <p>Before registering, check the organizer, venue, date and time, capacity, admission rules and event-specific conditions. For the initial Czech pilot, TicketTreat offers free event registration and information about events for which payment is handled directly by their organizer. TicketTreat does not accept, collect or transfer participant payments for event tickets.</p><p>When an event has a price, the organizer or identified contractual seller is responsible for explaining the full price (including any compulsory fees), how and when payment is made, the contract conditions and available cancellation, complaint and refund procedures. These arrangements take place directly between the participant and that organizer or seller, outside TicketTreat payment processing. Any on-platform registration for a priced event must clearly state whether a place is merely requested, confirmed or still awaiting organizer verification and payment.</p>
          <p>A TicketTreat ticket documents a reservation for the stated event. It is not valid for a different event, and an invalidated or cancelled QR ticket may be refused at check-in. Keep private ticket links and QR codes secure.</p>
        </section>
        <section>
          <h2>4. Changes, cancellations and refunds</h2>
          <p>Events may be changed or cancelled by their organizer. TicketTreat may deliver service notifications to verified email or linked Telegram channels. The trader responsible for a paid event must explain cancellation, rescheduling, complaint and refund arrangements before purchase. Non-waivable consumer rights remain unaffected.</p>
          <p>Under Czech Civil Code § 1837(j), the usual 14-day no-reason withdrawal right generally does not apply to contracts for leisure activities supplied on a specific date or during a defined period (such as a ticket to a dated concert). <strong>This is not a blanket rule for every kind of service or purchase</strong>; any applicable right to withdraw, refunds or remedies for cancellation or non-performance remains governed by Czech/EU law and the actual contract.</p>
          <p>TicketTreat does not take ticket payments during this pilot. Any invoice, payment receipt or refund for a directly paid event is provided by the relevant organizer/seller, where legally required. TicketTreat QR or reservation status by itself is not proof that the organizer received payment. A booking does not guarantee that an event will proceed unchanged. Any future introduction of payments through TicketTreat will require revised terms and checkout disclosures before activation.</p>
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
          <p>TicketTreat handles platform-account and technical support but not payments made directly to an organizer. For event-related complaints or paid-ticket refunds, first contact the organizer or trader identified in the event booking. For platform-related issues, contact TicketTreat support. Where the operator or organizer acts as a Czech trader in a consumer contract, the responsible trader must provide the legally required complaint contact and information about alternative dispute resolution. For many consumer disputes about goods and services, this is the <a href="https://coi.gov.cz/informace-o-adr/" target="_blank" rel="noopener noreferrer">Czech Trade Inspection Authority (ČOI), ADR</a>. This does not replace your rights to a court remedy.</p>
        </section>
        <section>
          <h2>9. Questions and updates</h2>
          <p>For platform questions, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support</a>. These terms may be updated as the pilot evolves. The current version and update date are published at this URL.</p>
        </section>
        <section id="obchodni-podminky-cz" lang="cs" className="tt-legal-czech">
          <h2>Obchodní podmínky – české znění</h2>
          <p><strong>1. Provozovatel a účel:</strong> TicketTreat je značka služby pro vyhledávání akcí, registraci účastníků a vystavování elektronických vstupenek. Samotná značka není právnickou osobou. Skutečný provozovatel a správce dat musí být uveden v identifikačním bloku této stránky. Není-li identifikace zveřejněna, není služba připravena k veřejnému komerčnímu provozu.</p>
          <p><strong>2. Účty:</strong> při registraci uveďte pravdivé údaje a chraňte své přihlašovací prostředky. Přihlášení přes Google a Telegram je dobrovolné; propojení stávajícího účtu může vyžadovat dodatečné ověření. Není dovoleno zneužívat cizí účet nebo získávat cizí vstupenky.</p>
          <p><strong>3. Pořadatel a smluvní strana:</strong> u každé akce musí být jasně uveden pořadatel, místo a termín, pravidla účasti a dostupný kontakt. V úvodním provozu v ČR TicketTreat umožňuje registraci na bezplatné akce a zobrazení akcí, u nichž účastník platí přímo pořadateli či jinému výslovně určenému prodávajícímu. TicketTreat sám od účastníků platby za vstupenky nepřijímá ani je pořadatelům nepřeposílá. Před případným uzavřením smlouvy musí být zřejmá totožnost skutečné smluvní strany, její postavení podnikatele a rozdělení odpovědností.</p>
          <p><strong>4. Cena a platba mimo TicketTreat:</strong> bezplatná registrace je označena jako bezplatná. U placené akce musí skutečný pořadatel či prodávající před vznikem závazku jasně sdělit celkovou cenu včetně daní a povinných poplatků, způsob přímé platby, kontakty, podmínky účasti, storna a reklamace. Platba probíhá mimo platební systém TicketTreat. Registrace nebo zobrazení QR kódu samo o sobě nepotvrzuje, že pořadatel přijal platbu. Případné budoucí zavedení plateb přes TicketTreat bude vyžadovat úpravu těchto podmínek a nákupního procesu.</p>
          <p><strong>5. Vstupenky a potvrzení úhrady:</strong> vstupenka a QR kód platí pouze pro příslušnou akci podle zveřejněných podmínek. U placených akcí doklad nebo QR kód z TicketTreat nenahrazuje potvrzení přijetí platby pořadatelem. Chraňte své osobní odkazy a QR kódy. Padělané a neplatné vstupenky nelze použít. Zákonná práva spotřebitele tím nejsou omezena.</p>
          <p><strong>6. Odstoupení, storno a refundace:</strong> platbu a případnou refundaci u placené akce řeší smluvní pořadatel či prodávající, který peníze přijal; TicketTreat neprovádí refundace částek, které sám nepřijal.  u služeb využití volného času poskytovaných v určitém termínu zpravidla není podle § 1837 písm. j) občanského zákoníku zákonné 14denní právo odstoupit bez udání důvodu (například vstupenka na koncert s pevným datem). To neplatí automaticky pro všechny služby a nevylučuje práva v případě zrušení akce, vadného či neposkytnutého plnění. Konkrétní storno podmínky, postup reklamace a vracení peněz musí prodávající sdělit před nákupem.</p>
          <p><strong>7. Změny a dostupnost:</strong> pořadatel může akci změnit nebo zrušit. O významných změnách může TicketTreat zaslat provozní zprávy na ověřené komunikační kanály. Pilotní platforma může být dočasně nedostupná, aniž by tím byla dotčena kogentní práva uživatelů.</p>
          <p><strong>8. Reklamace a řešení sporů:</strong> s reklamací se nejprve obraťte na skutečného prodávajícího či pořadatele uvedeného u akce; s problémem účtu na podporu TicketTreat. Tam, kde se uplatní zákon o ochraně spotřebitele, musí podnikatel uvést příslušný subjekt mimosoudního řešení sporů. Pro řadu spotřebitelských sporů je jím <a href="https://coi.gov.cz/informace-o-adr/">Česká obchodní inspekce – ADR</a>. Právo obrátit se na soud tím není dotčeno.</p>
          <p><strong>9. Osobní údaje a změny:</strong> informace o zpracování údajů najdete v <a href="/privacy-policy">zásadách ochrany osobních údajů</a>. Aktualizované podmínky jsou zveřejňovány na této stránce. Provozovatel nemůže jednostranně odejmout již vzniklá zákonná práva ani zpětně měnit uzavřené smlouvy v rozporu se zákonem.</p>
        </section>
      </article>
    </main>
  </div>;
}
