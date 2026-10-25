import Link from "next/link";
import {getLegalOperator} from "@/lib/legal-operator";

/**
 * The operator's personal details come only from server-side Railway variables.
 * Listing a registered entrepreneur does not independently establish GDPR
 * controllership; that role is documented in the approved privacy notice.
 */
export function LegalOperatorIdentity(){
  const op=getLegalOperator();

  return <section className="tt-legal-operator" aria-label="TicketTreat legal identity and contacts">
    <div className="tt-legal-operator-main" lang="en">
      <p className="tt-legal-operator-eyebrow">TICKETTREAT <span aria-hidden="true">/</span> LEGAL INFORMATION</p>
      <h2>Who is responsible</h2>
      <p className="tt-legal-operator-lead">
        The registered business details published for <strong>TicketTreat</strong> identify{" "}
        {op.name?<strong>{op.name}</strong>:<span>the platform&apos;s registered entrepreneur</span>}
        {op.identificationNumber&&<>, IČO <strong>{op.identificationNumber}</strong></>}
        {op.address&&<>, with the registered business address at <strong>{op.address}</strong></>}.
      </p>
      <p className="tt-legal-operator-contact">
        For questions about your personal data, write to{" "}
        <a href={`mailto:${op.email}`}>{op.email}</a>.
        {" "}For general enquiries, contact{" "}
        <a href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>.
      </p>
      <p className="tt-legal-operator-help">
        Need help with a ticket or account?{" "}
        <Link href="/support">Visit the TicketTreat Support Center</Link>.
      </p>
    </div>
    <div className="tt-legal-operator-czech" lang="cs">
      <h3>Kdo je odpovědný</h3>
      <p>
        Ve zveřejněných podnikatelských údajích platformy <strong>TicketTreat</strong> je uvedena{" "}
        {op.name?<strong>{op.name}</strong>:<span>podnikající fyzická osoba</span>}
        {op.identificationNumber&&<>, IČO <strong>{op.identificationNumber}</strong></>}
        {op.address&&<>, se sídlem <strong>{op.address}</strong></>}.
      </p>
      <p>
        V záležitostech ochrany osobních údajů nám napište na{" "}
        <a href={`mailto:${op.email}`}>{op.email}</a>.
        {" "}Pro obecné dotazy využijte{" "}
        <a href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>.
        {" "}S účtem nebo vstupenkou vám pomůže{" "}
        <Link href="/support">centrum podpory TicketTreat</Link>.
      </p>
    </div>
  </section>;
}
