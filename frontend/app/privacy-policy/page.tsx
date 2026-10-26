import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";
import {LegalOperatorIdentity} from "@/components/LegalOperatorIdentity";

export const metadata:Metadata={
  alternates:{canonical:"/privacy-policy"},
  title:"Privacy Policy",
  description:"TicketTreat Privacy Policy: account, Google sign-in, event ticket and Telegram data practices.",
};

export default function PrivacyPolicyPage(){
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-legal-page">
      <Link href="/" className="back-link">← TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / LEGAL</p>
      <h1 className="tt-legal-title">Privacy Policy</h1>
      <p className="tt-legal-intro">How we handle personal information when you use TicketTreat to find events, register and manage tickets.</p>
      <p className="tt-legal-updated">Last updated: 23 October 2026</p>
      <article className="tt-legal-content">
        <LegalOperatorIdentity/>
        <p className="tt-legal-language-note">The English information appears below. <a href="#ceska-verze">Úplné informace v češtině ↓</a></p>
        <section>
          <h2>1. Controller and scope</h2>
          <p>TicketTreat is a brand for an event-platform pilot in Czechia, not an incorporated legal entity by itself. The person or entity identified in the operator box above must be the actual GDPR controller for platform accounts, authentication, security and platform support. Event organizers may separately determine purposes and means of processing participant data for their own events; their identity and obligations must be clarified before public event sales.</p>
          <p>Use the verified privacy email in the operator box above for data protection requests, or the <Link href="/support">TicketTreat Support Center</Link> for general help. If the operator box is incomplete, the service is not yet ready for public launch: a brand or support username alone is not enough to identify the data controller.</p>
        </section>
        <section>
          <h2>2. Information we process</h2>
          <ul>
            <li><strong>Accounts:</strong> name, email address, optional phone number, contact preferences, verified-account status and authentication details.</li>
            <li><strong>Google sign-in:</strong> the Google account identifier, verified email address and name provided during sign-in.</li>
            <li><strong>Telegram:</strong> Telegram account identifier and basic profile details if you use or explicitly link Telegram.</li>
            <li><strong>Events:</strong> reservations, participant details, tickets and QR tokens, check-in status, cancellations, waiting lists and event-related correspondence.</li>
            <li><strong>Organizer-direct payments:</strong> TicketTreat does not collect attendees' card details, bank account credentials or payment funds in the initial Czech pilot. If an organizer receives payment directly, that organizer is responsible for their own payment records; TicketTreat may process only reservation/payment-status information that the organizer submits as part of attendance management.</li>
            <li><strong>Security and support:</strong> session records, access attempts, limited technical logs, account-bound support tickets (subject, category, descriptions, replies, delivery status), support messages and privacy requests. Support messages may contain additional personal information supplied by the customer.</li>
          </ul>
          <p>You may choose not to provide optional details, but some information is necessary to sign in, reserve an event or receive a ticket.</p>
        </section>
        <section>
          <h2>3. What Google sign-in accesses</h2>
          <p>If you select “Continue with Google”, Google authenticates you and TicketTreat receives basic identity information: your Google account ID, name and verified email address. We use this to create an account or securely link Google to an existing account with your authorization.</p>
          <p>TicketTreat requests only the <code>openid</code>, <code>email</code> and <code>profile</code> scopes. This sign-in feature does not request access to Gmail messages, Google Drive, your contacts or your calendar. We do not receive your Google password or retain Google API access and refresh tokens for this sign-in feature.</p>
        </section>
        <section>
          <h2>4. Why we use your data</h2>
          <ul>
            <li>Provide accounts, identity verification, event registration and admission tickets.</li>
            <li>Send service messages, such as account verification, booking confirmations, event reminders, changes and cancellations.</li>
            <li>Allow organizers to administer events, validate tickets and communicate information relevant to attendance.</li>
            <li>Prevent fraud, enforce access controls, investigate incidents and maintain security.</li>
            <li>Handle support, privacy requests and compliance with applicable legal obligations.</li>
          </ul>
          <p><strong>Legal bases under GDPR Article 6:</strong> account registration, ticket delivery and essential service messages are generally necessary for the requested contract or steps before it (Art. 6(1)(b)); access security, abuse detection and basic operational logging are generally based on legitimate interests subject to balancing (Art. 6(1)(f)); legally mandated records rely on a legal obligation where one exists (Art. 6(1)(c)). Optional non-essential tracking and promotional mail require a separately documented lawful basis and any consent or opt-out required by Czech electronic communications law. We do not treat acceptance of these terms as blanket consent to marketing.</p>
        </section>
        <section>
          <h2>5. Who receives information</h2>
          <p>Relevant event organizers can access participant information necessary for their event, such as registration and check-in records. An organizer accepting payment outside TicketTreat processes payment data under its own privacy responsibilities. Organizer status updates stored on TicketTreat do not mean that TicketTreat processes the payment itself.  We use infrastructure and service providers, including Railway for hosting and databases and Resend for transactional email delivery when enabled. Google processes authentication on its own systems when you choose Google sign-in; Telegram handles messages and account linkage when you choose to use Telegram.</p>
          <p>Data may be processed outside Czechia or the European Economic Area, depending on a provider's configuration. The responsible operator must verify processor agreements, locations, subprocessors and any GDPR Chapter V transfer mechanism (such as an adequacy decision or appropriate safeguards) before making the service publicly available. We do not sell your personal information to advertisers.</p>
        </section>
        <section>
          <h2>6. Cookies and device storage</h2>
          <p>TicketTreat uses strictly necessary authentication and security cookies to maintain sessions, and browser storage for your language and a non-secret session indicator. The cookie-consent selection itself is stored in first-party localStorage for up to 180 days. Our <Link href="/cookie-policy">Cookie Policy</Link> describes the precise cookie names, purposes and durations. Telegram Mini App support software is integrated for requested Mini App functionality, and Google authentication is initiated when you select Google sign-in. Those providers can receive technical network information according to their own policies.</p><p>The optional embedded Google Maps iframe is <strong>not loaded until you explicitly allow it</strong> in the cookie preferences. You can reject this option without affecting your account, bookings or tickets, and withdraw permission at any time through the footer Cookie settings link. Google Analytics and advertising/marketing pixels are not currently installed. Any future optional trackers require an updated inventory, separate purpose-specific consent and technical blocking before activation.</p>
        </section>
        <section>
          <h2>7. How long information is kept</h2>
          <p>Support requests and responses are stored while the case is open and afterwards as needed for complaint handling, legal claims or required retention. Eligible closed support conversations are included in the account erasure process; active cases may need manual review. We retain an active account while it is needed to provide login and ticket services, or until a valid erasure request is fulfilled. Registrations and check-in information are used for event participation and, after an event, only as needed for related claims, security or applicable legal duties. Authentication and operational logs are retained only for the minimum period necessary for incident response and service protection. Statutory accounting records, if payments are activated, follow the applicable legal requirements. Backups are removed under the approved rotation policy rather than instantly when an active account is erased.</p><p><strong>Before public launch:</strong> the controller must approve and publish a retention schedule with concrete periods or sufficiently precise criteria for each category, configure deletion/backup rotation, and ensure the live text matches actual practices. This pilot notice does not claim an unverified fixed retention period.</p>
        </section>
        <section>
          <h2>8. Your data protection rights</h2>
          <p>Subject to applicable conditions, you can request access, rectification, erasure, restriction, portability or object to processing; where consent is used, you can withdraw it. Signed-in users can submit an <Link href="/privacy">account-erasure request</Link>. For other privacy enquiries or if you cannot sign in, <Link href="/support">contact our support team</Link>.</p>
          <p>Requests are answered without undue delay and ordinarily within one month; in complex cases this may be extended by up to two more months if the individual is told within the first month. You can withdraw consent where consent is the basis, and you may object to legitimate-interest processing. If a request is refused, reasons and remedies must be explained. You may contact the Czech Data Protection Authority (<a href="https://uoou.gov.cz/" target="_blank" rel="noopener noreferrer">Úřad pro ochranu osobních údajů</a>) about your rights.</p>
        </section>
        <section>
          <h2>9. Automated decisions and mandatory information</h2>
          <p>We do not currently use personal data for solely automated decisions producing legal or similarly significant effects. Required registration data is marked in account or event forms; without it, we cannot authenticate an account or issue its ticket. Optional data is not required for these services. Where information is obtained from an organizer rather than directly from you, we must provide an appropriate notice under GDPR Article 14.</p>
        </section>
        <section>
          <h2>10. Policy updates</h2>
          <p>We may update this notice as TicketTreat introduces new features, payment processing or additional service providers. Material changes will be communicated through the service as appropriate; the latest effective version remains available at this URL.</p>
        </section>
        <section lang="cs" id="ceska-verze" className="tt-legal-czech">
          <h2>Úplné informace o zpracování osobních údajů (česky)</h2>
          <p><strong>1. Správce údajů:</strong> TicketTreat je značka projektu, nikoliv samostatná právnická osoba. Skutečným správcem osobních údajů musí být konkrétní fyzická nebo právnická osoba uvedená v identifikačním bloku v horní části této stránky. Není-li identifikace doplněna, nejde o dokončené informace podle čl. 13 GDPR a veřejné spuštění musí počkat. Organizátor akce může být samostatným správcem pro účely vlastní akce; rozdělení odpovědností musí být určeno před zpřístupněním placených akcí.</p>
          <p><strong>2. Rozsah údajů:</strong> jméno, e-mail, případně telefon, přihlašovací a bezpečnostní údaje, propojení účtu Google (identifikátor, ověřený e-mail a jméno), dobrovolné propojení Telegramu, registrace na akce, rezervace, QR vstupenky, stav odbavení, stornování, čekací listiny a potřebné servisní zprávy.</p>
          <p><strong>Platby přímo pořadateli:</strong> během úvodního provozu TicketTreat nepřijímá platby za vstupenky od účastníků a nezpracovává údaje o jejich platebních kartách ani přihlašovací údaje k bankovnictví. Údaje o samotné platbě zpracovává příslušný pořadatel či prodávající podle vlastních informačních povinností. Platforma může zpracovat pouze stav rezervace nebo potvrzení o platbě sdělené pořadatelem v rozsahu potřebném k zajištění účasti.</p>
          <p><strong>3. Účely a právní základ:</strong> vedení účtu, rezervace, vystavení vstupenek a nezbytná oznámení jsou zpravidla nezbytná pro smlouvu nebo jednání o jejím uzavření (čl. 6 odst. 1 písm. b) GDPR). Ochrana účtů a předcházení zneužití může vycházet z oprávněného zájmu po provedení posouzení (písm. f). Zákonné evidence z právní povinnosti (písm. c). Volitelné marketingové zprávy a netechnické cookies vyžadují samostatně doložený právní základ a případný předchozí souhlas podle českých předpisů. Přijetí obchodních podmínek není souhlasem s marketingem.</p>
          <p><strong>4. Google a Telegram:</strong> Google přihlášení žádá pouze rozsahy <code>openid</code>, <code>email</code>, <code>profile</code>; TicketTreat nepožaduje přístup k obsahu Gmailu či Disku Google a nezískává heslo Google. Při dobrovolném použití Telegramu se zpracovává identifikátor a údaje potřebné pro propojení a zasílání provozních zpráv.</p>
          <p><strong>5. Příjemci a přenosy:</strong> údaje nezbytné pro pořádání konkrétní akce mohou být zpřístupněny jejímu organizátorovi. K poskytování služby mohou být zapojeny hosting a databáze Railway, transakční doručování e-mailů přes Resend a poskytovatelé Google a Telegram podle použitých funkcí. Před veřejným provozem musí správce ověřit zpracovatelské smlouvy, seznam příjemců, umístění dat a případné přenosy mimo EHP podle kapitoly V GDPR.</p>
          <p><strong>6. Cookies a úložiště:</strong> používáme nezbytné cookies pro přihlášení a bezpečnost účtu a místní úložiště pro jazyk a indikátor relace. Výběr souhlasu ukládáme do úložiště prohlížeče nejdéle na 180 dní. <Link href="/cookie-policy">Zásady cookies</Link> uvádějí jejich názvy, účely a dobu uložení. Integrační software Telegramu slouží k fungování vyžádané Mini App; přihlášení Google uživatel volí samostatně. Vložené Mapy Google nenačítáme bez předchozího souhlasu, který lze stejně snadno odmítnout a kdykoli odvolat v nastavení cookies v zápatí. Analytické ani reklamní cookies v současnosti nepoužíváme. Případné budoucí sledovací technologie vyžadují samostatný informovaný souhlas a technické blokování před udělením souhlasu.</p>
          <p><strong>7. Doba uložení:</strong> účet se zpracovává po dobu poskytování služby nebo do oprávněného výmazu. Údaje o účasti se uchovávají pro zajištění akce a případné související nároky; bezpečnostní údaje jen po nezbytnou dobu. Případné účetní doklady podle právních lhůt a zálohy podle schváleného cyklu mazání. Konkrétní lhůty nebo přesná kritéria musí správce schválit a doložit před veřejným spuštěním.</p>
          <p><strong>8. Práva:</strong> máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost tam, kde se uplatní, námitku a odvolání souhlasu. Žádost lze podat prostřednictvím kontaktního e-mailu správce nebo po přihlášení v <a href="/privacy">nastavení soukromí</a>. Správce odpovídá bez zbytečného odkladu, zpravidla nejpozději do měsíce; za podmínek GDPR lze lhůtu prodloužit. Stížnost lze podat u <a href="https://uoou.gov.cz/">Úřadu pro ochranu osobních údajů</a>.</p>
          <p><strong>9. Povinné údaje a automatizace:</strong> bez povinných údajů nelze vytvořit účet ani vystavit vstupenku; volitelné údaje povinné nejsou. Neprovádíme výhradně automatizované rozhodování s právními nebo obdobně významnými účinky. Informace o změnách této politiky jsou zveřejňovány na této stránce.</p>
        </section>
      </article>
    </main>
  </div>;
}
