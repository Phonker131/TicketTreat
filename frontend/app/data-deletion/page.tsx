import Link from "next/link";
import type {Metadata} from "next";
import {AppHeader} from "@/components/AppHeader";
import {LegalOperatorIdentity} from "@/components/LegalOperatorIdentity";
import {getLegalOperator} from "@/lib/legal-operator";

export const metadata:Metadata={
  alternates:{canonical:"/data-deletion"},
  title:"Delete your data / Žádost o výmaz údajů",
  description:"How to request deletion of TicketTreat account information, including information used for Facebook sign-in.",
};

/** Public, sign-in-free instructions for Meta's Data Deletion Instructions URL.
 * This is not a Meta webhook and does not pretend to erase data on GET.
 * Existing identity-verification and administrator-reviewed erasure stay authoritative.
 */
export default function DataDeletionPage(){
  const {email}=getLegalOperator();
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-legal-page">
      <Link href="/" className="back-link">TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / PRIVACY</p>
      <h1 className="tt-legal-title">Delete your data / Výmaz osobních údajů</h1>
      <p className="tt-legal-intro">Request removal of your TicketTreat account and personal information, including data received when you choose Facebook sign-in.</p>
      <article className="tt-legal-content">
        <LegalOperatorIdentity/>
        <section lang="en">
          <h2>How to request deletion</h2>
          <ol>
            <li>If you can sign in to TicketTreat, open <Link href="/privacy">Privacy settings</Link> and choose <strong>Account erasure request</strong>. Follow the identity-confirmation instructions.</li>
            <li>If you cannot sign in, or only wish to request removal of Facebook-linked data, email <a href={`mailto:${email}?subject=TicketTreat%20data%20deletion%20request`}>{email}</a> with the subject <strong>TicketTreat data deletion request</strong>. Include the email address used with your TicketTreat account and briefly describe what you wish to delete. Do not send passwords, access tokens or identity documents in the initial message.</li>
            <li>We may ask you to verify that the account belongs to you before processing the request. We will acknowledge and review the request, normally responding within one month under GDPR, subject to lawful extensions.</li>
          </ol>
          <p>Disconnecting TicketTreat in Facebook settings stops future access but does not itself request deletion of your TicketTreat account. You can still follow the steps above to request deletion of the Facebook account identifier, profile details obtained through Facebook and other eligible TicketTreat data.</p>
          <p>Some booking, event, security or financial records may need to be retained where required by law or for legitimate unresolved claims. We will explain any relevant exceptions. For more information, read our <Link href="/privacy-policy">Privacy Policy</Link>.</p>
        </section>
        <section lang="cs" id="cesky">
          <h2>Jak požádat o výmaz údajů</h2>
          <ol>
            <li>Pokud se můžete přihlásit do TicketTreat, otevřete <Link href="/privacy">Nastavení soukromí</Link> a vyberte <strong>Žádost o výmaz účtu</strong>. Postupujte podle pokynů k ověření totožnosti.</li>
            <li>Pokud se nemůžete přihlásit nebo chcete požádat pouze o výmaz údajů souvisejících s Facebookem, napište na <a href={`mailto:${email}?subject=Zadost%20o%20vymaz%20udaju%20TicketTreat`}>{email}</a>. Do předmětu uveďte <strong>Žádost o výmaz údajů TicketTreat</strong> a do zprávy e-mail použitý pro účet TicketTreat a popis žádosti. V první zprávě neposílejte hesla, přístupové tokeny ani doklady totožnosti.</li>
            <li>Před vyřízením žádosti můžeme potřebovat ověřit, že je účet váš. Žádost potvrdíme a posoudíme; podle GDPR zpravidla odpovíme do jednoho měsíce, pokud zákon neumožňuje prodloužení lhůty.</li>
          </ol>
          <p>Odebrání TicketTreat z nastavení Facebooku zabrání dalšímu přístupu, samo o sobě ale neznamená žádost o výmaz účtu TicketTreat. Výmaz identifikátoru Facebooku, údajů získaných z Facebooku a dalších způsobilých osobních údajů můžete vyžádat výše uvedeným způsobem.</p>
          <p>Některé údaje o rezervacích, akcích, bezpečnosti nebo účetnictví může být nezbytné uchovat ze zákonných důvodů nebo kvůli nevyřešeným nárokům. Případné výjimky vysvětlíme. Více informací najdete v <Link href="/privacy-policy">zásadách ochrany osobních údajů</Link>.</p>
        </section>
      </article>
    </main>
  </div>;
}
