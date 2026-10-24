import {getLegalOperator} from "@/lib/legal-operator";

/** GDPR Article 13 notice: don't confuse brand with the natural/legal person
 * who actually determines the purpose and means of data processing. */
export function LegalOperatorIdentity(){
  const op=getLegalOperator();
  return <section className="tt-legal-operator" aria-label="Identity of the TicketTreat operator">
    <h2>Operator / Provozovatel a správce údajů</h2>
    {op.status==="complete"?<>
      <p><strong>{op.name}</strong></p>
      <p><strong>Contact / Kontaktní adresa:</strong> {op.address}</p>
      <p><strong>Privacy contact / Kontakt pro ochranu údajů:</strong>{" "}
        <a href={`mailto:${op.email}`}>{op.email}</a></p>
      {op.identificationNumber&&<p><strong>IČO:</strong> {op.identificationNumber}</p>}
    </>:<>
      <p className="tt-legal-pending" role="note">
        Controller identity and contact details are not yet verified for publication.
        The platform must not be opened to the public as a completed Czech/EU
        service until its responsible person or legal entity, a valid contact
        address and an operational privacy email are published here.
      </p>
      <p lang="cs">Údaje o správci osobních údajů dosud nebyly ověřeny pro zveřejnění.
        Před veřejným spuštěním musí být doplněno jméno či název skutečného
        správce, kontaktní adresa a funkční e-mail pro ochranu osobních údajů.</p>
    </>}
    <p>Platform support / Podpora: <a href="/support">TicketTreat Support Center</a>. Support tickets do not replace the controller contact details above.</p>
  </section>;
}
