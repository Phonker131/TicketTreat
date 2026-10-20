# Recovering a Crowdly global administrator

Use Railway project **stunning-spontaneity** → **Demo API** → **Variables**.

- GLOBAL_ADMIN_EMAILS: comma-separated eligible email addresses.
- GLOBAL_ADMIN_RECOVERY_SECRET: strong randomly generated key (minimum 32 characters).
- GLOBAL_ADMIN_ACCOUNT_IDS: optional legacy direct account IDs; prefer claims.

A configured email is **only an allowlist**, not sufficient to become an admin, because
this demo does not yet verify the email address at website signup.

1. Sign up / log in with one of the configured emails using the website.
2. Open /profile and find the "Recover global admin access" panel.
3. Paste GLOBAL_ADMIN_RECOVERY_SECRET from your private Railway Variables.
4. Confirm. The server stores a verified admin grant bound to the current account ID.
5. Your role changes to Global Admin immediately.

If that account is later deleted and recreated, the stored grant will not
authorize the new account automatically: repeat step 3 with the recovery secret.
That prevents someone from registering your email and silently becoming admin.

**Security:** Never expose the recovery secret in frontend NEXT_PUBLIC_ variables,
GitHub, logs, screenshots or a chat. Rotate the secret if disclosed. Once a proper
email ownership verification flow is implemented, recovery can be migrated to a
one-time expiring email link with rate limits.

Current production Bot and Backend are not involved.
