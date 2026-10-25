/** Server-side verified operator details for Czech/EU legal notices.
 *
 * Never silently invent a company, company number, address or privacy email.
 * These values must be checked by the actual contracting operator and supplied via Railway
 * Frontend service variables before the platform is opened to the public.
 * Changes to server variables must be followed by a new Frontend deployment.
 */
export type LegalOperator={
  name:string|null;
  address:string|null;
  email:string|null;
  identificationNumber:string|null;
  status:"complete"|"incomplete";
};

function clean(name:string,max=300):string|null{
  const value=process.env[name]?.trim();
  if(!value || value.length>max || /[<>\r\n]/.test(value))return null;
  return value;
}

/** Czech IČO uses a checksum in the eighth (last) digit.
 * A syntactically valid IČO is NOT evidence of an active registration:
 * the actual operator and its business address must still be verified.
 */
export function validCzechIco(value:string):boolean {
  if(!/^[0-9]{8}$/.test(value))return false;
  const weighted=value.slice(0,7).split("").reduce((sum,digit,index)=>
    sum+Number(digit)*(8-index),0);
  const check=11-(weighted%11);
  const expected=check===10?0:check===11?1:check;
  return Number(value[7])===expected;
}

export function getLegalOperator():LegalOperator {
  const name=clean("LEGAL_OPERATOR_NAME");
  const address=clean("LEGAL_OPERATOR_ADDRESS");
  const rawEmail=clean("LEGAL_PRIVACY_EMAIL",254);
  const email=rawEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)?rawEmail:null;
  const rawIco=clean("LEGAL_OPERATOR_ICO",20);
  const identificationNumber=rawIco&&validCzechIco(rawIco)?rawIco:null;
  // Fail closed: the brand and an IČO alone cannot identify a Czech
  // natural-person operator or the GDPR data controller.
  const complete=Boolean(name&&address&&email&&identificationNumber);
  return {name,address,email,identificationNumber,
    status:complete?"complete":"incomplete"};
}
