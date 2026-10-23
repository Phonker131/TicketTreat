import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";

export const metadata:Metadata={
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
        <section>
          <h2>1. Who operates TicketTreat?</h2>
          <p>TicketTreat is an independently operated event-platform pilot in Czechia, currently before incorporation as a company. This notice concerns data processed to provide the TicketTreat website, participant accounts, tickets and Telegram integration.</p>
          <p>For questions about the responsible project operators, personal data and privacy requests, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support on Telegram</a>. You can also request information identifying the relevant data controller through this channel.</p>
        </section>
        <section>
          <h2>2. Information we process</h2>
          <ul>
            <li><strong>Accounts:</strong> name, email address, optional phone number, contact preferences, verified-account status and authentication details.</li>
            <li><strong>Google sign-in:</strong> the Google account identifier, verified email address and name provided during sign-in.</li>
            <li><strong>Telegram:</strong> Telegram account identifier and basic profile details if you use or explicitly link Telegram.</li>
            <li><strong>Events:</strong> reservations, participant details, tickets and QR tokens, check-in status, cancellations, waiting lists and event-related correspondence.</li>
            <li><strong>Security and support:</strong> session records, access attempts, limited technical logs, support messages and privacy requests.</li>
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
          <p>We rely on the grounds appropriate to each activity under applicable data-protection law, including provision of a requested service, legitimate interests in security, a legal obligation or consent where required. Optional promotional communications require an appropriate legal basis and, where necessary, an unsubscribe option.</p>
        </section>
        <section>
          <h2>5. Who receives information</h2>
          <p>Relevant event organizers can access participant information necessary for their event, such as registration and check-in records. We use infrastructure and service providers, including Railway for hosting and databases and Resend for transactional email delivery when enabled. Google processes authentication on its own systems when you choose Google sign-in; Telegram handles messages and account linkage when you choose to use Telegram.</p>
          <p>Providers may process information in countries outside Czechia. Where required, transfers are handled under applicable data-protection safeguards. We do not sell your personal information to advertisers.</p>
        </section>
        <section>
          <h2>6. Cookies and device storage</h2>
          <p>TicketTreat uses essential authentication and security cookies to maintain your session. Your device may also store your selected interface language and a non-secret login-state indicator. The site can load Telegram integration software for Mini App functionality. Any future optional analytics or advertising cookies will require a separate assessment and any consent required by law.</p>
        </section>
        <section>
          <h2>7. How long information is kept</h2>
          <p>We retain active account and event details while needed to provide the service, manage bookings and handle support. Security, organizer and communication records are kept as necessary for operational security, dispute handling and applicable legal obligations. Relevant records may remain for a longer period where law requires it. Backups may persist until their rotation period ends. Retention categories and periods are reviewed as the Czech pilot develops.</p>
        </section>
        <section>
          <h2>8. Your data protection rights</h2>
          <p>Subject to applicable conditions, you can request access, rectification, erasure, restriction, portability or object to processing; where consent is used, you can withdraw it. Signed-in users can submit an <Link href="/privacy">account-erasure request</Link>. For other privacy enquiries or if you cannot sign in, <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">contact support</a>.</p>
          <p>Requests are generally answered within one month, subject to extensions permitted by law. You may contact the Czech Data Protection Authority (<a href="https://uoou.gov.cz/" target="_blank" rel="noopener noreferrer">Úřad pro ochranu osobních údajů</a>) about your rights.</p>
        </section>
        <section>
          <h2>9. Policy updates</h2>
          <p>We may update this notice as TicketTreat introduces new features, payment processing or additional service providers. Material changes will be communicated through the service as appropriate; the latest effective version remains available at this URL.</p>
        </section>
      </article>
    </main>
  </div>;
}
