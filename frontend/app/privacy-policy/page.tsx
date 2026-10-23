import Link from "next/link";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Privacy Policy",description:"How TicketTreat handles personal data for event registrations and Google sign-in."};
export default function PrivacyPolicyPage(){
 return <main className="page narrow-page" style={{paddingTop:36,paddingBottom:80}}>
  <Link href="/" className="back-link">← TicketTreat</Link>
  <h1>TicketTreat Privacy Policy</h1>
  <p className="form-note">Last updated: 23 October 2026</p>
  <div className="panel form-stack">
   <h2>About TicketTreat</h2>
   <p>TicketTreat is an event-discovery and registration platform currently operating as a pilot in Czechia. This policy describes the handling of personal data by the TicketTreat project operators. For questions about the responsible operator or your privacy rights, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support on Telegram</a>.</p>
   <h2>Data we process</h2>
   <p>When you register or use TicketTreat, we may process your name, email address, optional phone number and contact preferences, event reservations and ticket status, account-security and session records, and communications needed to manage events. Organizers may receive information relevant to participant registration and check-in.</p>
   <h2>Sign in with Google</h2>
   <p>When you choose Google sign-in, Google authenticates you and TicketTreat receives the account's verified identity information (Google account identifier, name and email) for sign-in. We associate the Google identifier with your TicketTreat account. The current sign-in integration does not request access to your Gmail, Google Drive, contacts or calendar, and does not retain Google API access or refresh tokens.</p>
   <h2>Why we use this information</h2>
   <p>We use account and registration data to provide sign-in, issue tickets, manage check-in, notify you about event changes or reminders, secure the service and respond to support or privacy requests. Depending on the processing purpose, the legal basis may be performance of the service requested by you, legitimate interests in security and reliability, consent where required, or a legal obligation.</p>
   <h2>Services involved</h2>
   <p>TicketTreat uses hosting and database infrastructure, transactional email delivery, Google authentication when selected, and Telegram integration when selected. These providers process only the information needed for their functions, subject to their respective terms and privacy notices. International transfers, where applicable, are handled according to the relevant legal safeguards.</p>
   <h2>Retention and security</h2>
   <p>Account data, tickets, event records and technical security information are retained for as long as reasonably necessary to run the service, protect users, address disputes and meet applicable legal requirements. Retention can differ for active bookings and financial or audit records. Login sessions use secure, HTTP-only cookies where supported, and privileged access is restricted.</p>
   <h2>Your choices and rights</h2>
   <p>You may request access to, correction of, or deletion of eligible personal data, object to or restrict certain processing, and exercise other rights under applicable data protection law. Certain records may need to be retained where required by law or for an active event. You can access account privacy requests from <Link href="/privacy">Privacy and personal data</Link> after signing in, or contact support. You may also lodge a complaint with the competent data protection authority.</p>
   <h2>Changes</h2>
   <p>We may update this policy when TicketTreat changes its features or processing practices. The date above indicates the most recent version.</p>
  </div>
 </main>;
}
