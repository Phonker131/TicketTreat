# TicketTreat — legal operator publication checklist

TicketTreat is a product brand, **not** a registered company by itself.
A founder's IČO cannot simply be attached to a platform unless that person
really operates the service and assumes the corresponding obligations.

## Privacy-conscious but lawful presentation

- Keep **TicketTreat** as the name in product navigation, footer, bot,
  event emails, social presence and marketing.
- Publish the **actual statutory operator's identity** only in clearly
  labeled legal disclosures: Legal Notice, Terms, Privacy and Cookie Policy.
  Those disclosures must remain easy to find and must not be hidden from users.
- For an OSVČ, the operator's registered business identity, registered
  business address (sídlo), IČO and working privacy contact are required
  once that person is the actual operator. The brand or IČO alone is not a
  replacement for the legally required name.
- If founders do not want to associate a natural person's name with the
  public-facing operator, use an appropriately registered and genuinely
  responsible **legal entity**, for example a Czech s.r.o., and show that
  legal entity's legal details. Public business registries can still identify
  the company’s owners or management.
- Never add a cofounder's private name, home address, or an IČO to source
  code, repository history, logs, screenshots, analytics or marketing.
  Public statutory disclosures are the explicit exception, after verification.
  Do not assume a person’s registered *sídlo* can be replaced by an unrelated
  contact address.

## Production configuration

Only once both founders agree who is the true operator, check the record
in official ARES and add these **four** Railway Frontend variables:

```text
LEGAL_OPERATOR_NAME=<verified legal name as registered>
LEGAL_OPERATOR_ADDRESS=<verified registered business address>
LEGAL_OPERATOR_ICO=<verified Czech eight-digit IČO>
LEGAL_PRIVACY_EMAIL=<working privacy email controlled by the operator>
```

**Never use placeholder values.** The legal-operator component will deliberately
show an incomplete notice until all four fields are configured and the IČO
has a valid Czech checksum. Checksum validity alone does **not** prove an
active business registration or authorization to run TicketTreat.

After configuration, redeploy the Frontend and manually review all four
legal pages and the GDPR controller disclosure, ideally with a Czech lawyer.
There may be additional obligations based on the actual business model.

Relevant legal provisions: Czech Civil Code §435 and GDPR Article 13(1)(a).
