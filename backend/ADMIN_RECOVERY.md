# Global administrator access

Global administrator permissions are granted server-side. Knowing or registering an allowlisted email address **does not grant access**.

## Recovery prerequisites

1. The account must control and verify its email address with TicketTreat.
2. The account email must be included in the server-side `GLOBAL_ADMIN_EMAILS` allowlist.
3. The server must have a strong, private `GLOBAL_ADMIN_RECOVERY_SECRET` (32+ characters).
4. The applicant signs in and enters the recovery secret through the Profile recovery flow. The backend checks the proof and binds the grant to that account ID.
5. Account roles and ownership must be rechecked on staging after upgrades.

Do **not** share or commit the secret; configure it in the Railway API service's **Variables**. Restrict who can view/edit production variables and rotate the secret after any suspected disclosure.

This process is a temporary recovery control, **not MFA**. Privileged phishing-resistant MFA and audited administrator enrollment remain release blockers. See [security status](SECURITY_STATUS.md).
