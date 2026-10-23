import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";

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
        <section>
          <h2>1. About the service</h2>
          <p>TicketTreat is an independently operated event-platform pilot in Czechia, currently before incorporation as a company. It provides an online service for viewing events, registering as a participant, obtaining event tickets and receiving event-related notifications. The organizer of each event is responsible for the event itself and may set additional event-specific rules.</p>
          <p>For platform support, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support on Telegram</a>. For questions about a specific event, please contact its organizer.</p>
        </section>
        <section>
          <h2>2. Accounts and access</h2>
          <p>You agree to provide accurate account information and maintain the security of your sign-in credentials. You must use accounts you own or are authorized to access and must not attempt to access another participant's bookings.</p>
          <p>You may sign in with email and password, Google or Telegram where those options are available. Connecting an external identity to an existing TicketTreat account may require separate confirmation of account ownership.</p>
        </section>
        <section>
          <h2>3. Event registration and tickets</h2>
          <p>Each event page should identify its organizer, location, date, availability and relevant participation terms. Confirm these details before registering. Some tickets are free, while other events may involve a fee. Any applicable price and payment method are shown before you commit to a transaction.</p>
          <p>A TicketTreat ticket documents a reservation for the stated event. It is not valid for a different event, and an invalidated or cancelled QR ticket may be refused at check-in. Keep private ticket links and QR codes secure.</p>
        </section>
        <section>
          <h2>4. Changes, cancellations and refunds</h2>
          <p>Events may be changed or cancelled by their organizer. Where available, TicketTreat sends notifications to contact channels associated with your account. Individual event and organizer terms govern attendance conditions and available cancellation options. Any payment, cancellation or refund rights under mandatory consumer law remain unaffected.</p>
          <p>Where payment functionality is offered, checkout should display relevant payment information and event-specific conditions before purchase. The availability of a registration or ticket does not guarantee that an event will take place without changes.</p>
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
          <h2>8. Questions and updates</h2>
          <p>For platform questions, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support</a>. These terms may be updated as the pilot evolves. The current version and update date are published at this URL.</p>
        </section>
      </article>
    </main>
  </div>;
}
