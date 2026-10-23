/** Server-side verified operator details for Czech/EU legal notices.
 *
 * Never silently invent a company, company number, address or privacy email.
 * These values must be checked by the operators and supplied via Railway
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

export function getLegalOperator():LegalOperator {
  const name=clean("LEGAL_OPERATOR_NAME");
  const address=clean("LEGAL_OPERATOR_ADDRESS");
  const rawEmail=clean("LEGAL_PRIVACY_EMAIL",254);
  const email=rawEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)?rawEmail:null;
  const identificationNumber=clean("LEGAL_OPERATOR_ICO",20);
  return {name,address,email,identificationNumber,
    status:name&&address&&email?"complete":"incomplete"};
}
