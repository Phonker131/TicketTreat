import Link from "next/link";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Terms of Service",description:"Terms for using TicketTreat accounts and event tickets."};
export default function TermsPage(){
 return <main className="page narrow-page" style={{paddingTop:36,paddingBottom:80}}>
  <Link href="/" className="back-link">← TicketTreat</Link>
  <h1>TicketTreat Terms of Service</h1>
  <p className="form-note">Last updated: 23 October 2026</p>
  <div className="panel form-stack">
   <h2>Service</h2>
   <p>TicketTreat is a pilot service for discovering events, creating participant accounts and managing event registrations and tickets. An organizer may set additional event-specific conditions, which should be reviewed before registering. For support, contact <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support on Telegram</a>.</p>
   <h2>Accounts and access</h2>
   <p>Provide accurate registration information, use an account you are authorized to control and keep your sign-in credentials secure. When using Google sign-in, you also agree to the relevant Google account requirements. Telegram and website accounts are linked only after you explicitly verify control of both accounts.</p>
   <h2>Tickets and events</h2>
   <p>Tickets are issued for the stated event and may be subject to venue admission rules and organizer conditions. An event organizer is responsible for communicating accurate event details and changes. Availability, ticket fees and any cancellation rules are shown in the event or registration flow. Do not share private QR codes or present invalid or cancelled tickets.</p>
   <h2>Fair use and service changes</h2>
   <p>Do not abuse automated registration, interfere with other users' access, access other users' tickets without permission or misuse the platform. The pilot service may change as features are developed. We aim to communicate significant changes affecting existing reservations.</p>
   <h2>Personal data</h2>
   <p>For information on how account, Google sign-in and ticket data are handled, see the <Link href="/privacy-policy">Privacy Policy</Link>.</p>
   <h2>Contact</h2>
   <p>For event-specific questions, contact the organizer. For platform access or privacy enquiries, use <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer">TicketTreat support</a>.</p>
  </div>
 </main>;
}
