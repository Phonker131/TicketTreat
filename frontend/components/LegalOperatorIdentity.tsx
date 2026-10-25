import Link from "next/link";
import {getLegalOperator} from "@/lib/legal-operator";

/** Only present verified service contacts and supplied business details.
 * Do not substitute the TicketTreat brand for a verified statutory person.
 */
export function LegalOperatorIdentity(){
  const op=getLegalOperator();
  return <section className="tt-legal-operator" aria-label="TicketTreat identification and contacts">
    <header className="tt-legal-operator-heading">
      <div>
        <span className="tt-legal-operator-brand">TicketTreat</span>
        <h2>Who is responsible / Kdo je odpovědný</h2>
      </div>
    </header>
    <div className="tt-legal-operator-copy">
      <p>
        <strong>TicketTreat</strong> is an event registration and ticketing platform in Czechia.
        {op.identificationNumber&&<> Business identification number: <strong>IČO {op.identificationNumber}</strong>.</>}
        {" "}For general enquiries, write to{" "}
        {op.contactEmail?<a href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>:<Link href="/support">TicketTreat Support</Link>}.
        {op.email&&<> For questions about your personal data, contact{" "}
          <a href={`mailto:${op.email}`}>{op.email}</a>.</>}
      </p>
      <p lang="cs">
        <strong>TicketTreat</strong> je platforma pro registrace na akce a elektronické vstupenky v Česku.
        {op.identificationNumber&&<> Identifikační číslo: <strong>IČO {op.identificationNumber}</strong>.</>}
        {" "}S obecnými dotazy se obracejte na{" "}
        {op.contactEmail?<a href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>:<Link href="/support">podporu TicketTreat</Link>}.
        {op.email&&<> Pro dotazy k osobním údajům napište na{" "}
          <a href={`mailto:${op.email}`}>{op.email}</a>.</>}
      </p>
    </div>
    {op.status==="complete"&&<dl className="tt-legal-operator-details">
      <div><dt>Registered operator / Registrovaný provozovatel</dt><dd>{op.name}</dd></div>
      <div><dt>Registered business address / Sídlo</dt><dd>{op.address}</dd></div>
    </dl>}
    <p className="tt-legal-operator-support">
      Account and ticket assistance / Podpora účtů a vstupenek:{" "}
      <Link href="/support">TicketTreat Support Center</Link>.
    </p>
  </section>;
}
