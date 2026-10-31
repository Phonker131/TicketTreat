## What changed?
Describe the feature, fix or content update.

## Critical file / data impact
- [ ] No DB schema, migrations, auth, tokens, sessions, API gateway, role checks, check-in or security settings changed
- [ ] OR: Critical areas changed; I have documented the security/DB impact and requested review from `@Phonker131`

## Verification
- [ ] Relevant tests ran; CI is passing
- [ ] No production credentials or personal data in the diff/logs
- [ ] Changes were made in a feature branch and the PR targets `release/tickettreat-production`
- [ ] If any migrations were added: staging restore/preflight and recovery plan documented
- [ ] If backend/identity/check-in changed: relevant integration tests and owner approval obtained

## Deployment / rollback
Risks, any required variables, deployment steps, recovery plan (or **none**).

See [Contributing](../CONTRIBUTING.md) and [critical code boundaries](../docs/CRITICAL_CODE_AREAS.md).
