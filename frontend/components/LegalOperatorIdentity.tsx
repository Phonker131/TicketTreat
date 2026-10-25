import Link from "next/link";
import {getLegalOperator} from "@/lib/legal-operator";

/** TicketTreat is a brand, not an independently registered company.
 * Only legally verified operator details appear in the legal disclosure;
 * the person's name must never be promoted as platform branding.
 */
export function LegalOperatorIdentity(){
  const op=getLegalOperator();
  return <section className="tt-legal-operator" aria-label="TicketTreat legal operator identity">
    <header className="tt-legal-operator-heading">
      <div>
        <span className="tt-legal-operator-brand">TicketTreat</span>
        <h2>Legal operator / Právní provozovatel</h2>
        <p className="tt-legal-operator-description">
          TicketTreat is the platform brand. These are the statutory details of
          the person or company legally responsible for operating it.
        </p>
      </div>
    </header>
    {op.status==="complete"?(
      <dl className="tt-legal-operator-details">
        <div><dt>Registered name / Jméno nebo název</dt><dd>{op.name}</dd></div>
        <div><dt>Registered address / Sídlo</dt><dd>{op.address}</dd></div>
        <div><dt>IČO</dt><dd>{op.identificationNumber}</dd></div>
        <div><dt>Privacy contact / Kontakt pro ochranu údajů</dt>
          <dd><a href={`mailto:${op.email}`}>{op.email}</a></dd></div>
      </dl>
    ):(
      <>
        {op.identificationNumber&&(
          <dl className="tt-legal-operator-details tt-legal-operator-pilot-ico">
            <div>
              <dt>Provided IČO / Poskytnuté IČO</dt>
              <dd>{op.identificationNumber}</dd>
            </div>
          </dl>
        )}
        <div className="tt-legal-operator-pending" role="note">
          <p><strong>Legal operator details are being finalized.</strong> The IČO above
            was provided for the TicketTreat pilot, but it does not by itself
            identify the contracting operator or the GDPR controller.
            The verified registered name, business address and working privacy
            contact must be published before commercial operation.</p>
          <p lang="cs"><strong>Údaje o právním provozovateli se doplňují.</strong>
            Výše uvedené IČO bylo poskytnuto pro pilotní provoz TicketTreat,
            samotné však neidentifikuje smluvního provozovatele ani správce
            osobních údajů. Před komerčním provozem je nutné zveřejnit
            ověřené jméno či název, sídlo a funkční kontakt pro ochranu údajů.</p>
        </div>
      </>
    )}
    <p className="tt-legal-operator-support">
      Platform assistance / Podpora: <Link href="/support">TicketTreat Support Center</Link>.
      Support does not replace the statutory operator contact above.
    </p>
  </section>;
}
