-- Production incident invariant, also safe to apply on empty CI databases.
-- Verify exact account identity matches rather than accidentally applying the
-- incident response to unrelated fixture users with the same numeric IDs.
-- A failed check aborts the deploy instead of silently claiming revocation.
DO $incident_revocation$
DECLARE
    incident_accounts INTEGER;
    permanently_denied INTEGER;
BEGIN
    SELECT count(*) INTO incident_accounts
    FROM demo_web_accounts a
    WHERE (a.id = 42 AND lower(a.email) = 'ttqa20261125@euploading.com')
       OR (a.id = 43 AND lower(a.email) = 'ttorg20261125@euploading.com');

    SELECT count(*) INTO permanently_denied
    FROM demo_web_accounts a
    JOIN demo_permanent_account_bans p ON p.account_id = a.id
    WHERE (a.id = 42 AND lower(a.email) = 'ttqa20261125@euploading.com')
       OR (a.id = 43 AND lower(a.email) = 'ttorg20261125@euploading.com');

    IF permanently_denied <> incident_accounts THEN
        RAISE EXCEPTION 'Incident account permanent-ban invariant failed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM demo_web_sessions s
        JOIN demo_permanent_account_bans p ON p.account_id = s.account_id
    ) OR EXISTS (
        SELECT 1 FROM demo_mfa_sessions m
        JOIN demo_permanent_account_bans p ON p.account_id = m.account_id
    ) OR EXISTS (
        SELECT 1 FROM demo_email_challenges c
        JOIN demo_permanent_account_bans p ON p.account_id = c.account_id
    ) OR EXISTS (
        SELECT 1 FROM demo_telegram_email_claims c
        JOIN demo_permanent_account_bans p ON p.account_id = c.account_id
    ) OR EXISTS (
        SELECT 1 FROM demo_telegram_browser_logins l
        JOIN demo_telegram_identities t ON t.telegram_id = l.telegram_id
        JOIN demo_web_accounts a ON a.guest_id = t.guest_id
        JOIN demo_permanent_account_bans p ON p.account_id = a.id
    ) THEN
        RAISE EXCEPTION 'Permanent-ban authentication artifacts still exist';
    END IF;

    RAISE NOTICE 'Incident revocation verified: % matching accounts, % permanent bans, zero auth artifacts',
        incident_accounts, permanently_denied;
END
$incident_revocation$;
