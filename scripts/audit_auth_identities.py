"""Read-only integrity audit before backfilling canonical TicketTreat identities.

No personal identifiers, tokens, email addresses or query results are printed.
Only anonymized aggregate counts. Can run against a restored database without
changing data; exits 2 if any issue blocks a safe provider-identity backfill.
"""
from __future__ import annotations

import json
import os
import sys

from sqlalchemy import create_engine, inspect, text

# The same candidates query will be used by the separately approved backfill.
# Sources are authoritative only for their **verified** provider identity:
#   email via demo_verified_emails;
#   Google via OAuth subject registered after token validation;
#   Telegram via HMAC/OIDC-verified numerical user ID stored in link table.
CANDIDATES = """
WITH candidates AS (
  SELECT 'email'::varchar AS provider, lower(btrim(a.email)) AS provider_subject,
         a.id AS account_id, v.verified_at AS verified_at
  FROM demo_web_accounts a
  JOIN demo_verified_emails v ON v.account_id = a.id
  WHERE a.email IS NOT NULL
  UNION ALL
  SELECT 'google'::varchar, gi.subject, gi.account_id, gi.created_at
  FROM demo_google_identities gi
  UNION ALL
  SELECT 'telegram'::varchar, ti.telegram_id::varchar, a.id, now()
  FROM demo_telegram_identities ti
  JOIN demo_web_accounts a ON a.guest_id = ti.guest_id
)
"""


def audit(database_url: str) -> dict[str, int | bool]:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise ValueError("PostgreSQL URL required")
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            # This tool must remain read-only, including if called on production.
            conn.exec_driver_sql("SET TRANSACTION READ ONLY")
            tables = set(inspect(conn).get_table_names())
            expected = {
                "demo_web_accounts", "demo_guests", "demo_verified_emails",
                "demo_google_identities", "demo_telegram_identities",
                "users",
            }
            if expected - tables:
                raise RuntimeError("missing_required_identity_tables")
            result: dict[str, int | bool] = {}
            def count(key: str, query: str) -> None:
                result[key] = int(conn.execute(text(query)).scalar_one())

            count("normalized_email_collision_groups", """
                SELECT count(*) FROM (
                  SELECT lower(btrim(email)) FROM demo_web_accounts
                  WHERE email IS NOT NULL
                  GROUP BY lower(btrim(email)) HAVING count(*) > 1
                ) duplicates
            """)
            count("orphan_web_guests", """
                SELECT count(*) FROM demo_web_accounts a
                LEFT JOIN demo_guests g ON g.id=a.guest_id WHERE g.id IS NULL
            """)
            count("orphan_telegram_guest_links", """
                SELECT count(*) FROM demo_telegram_identities ti
                LEFT JOIN demo_guests g ON g.id=ti.guest_id WHERE g.id IS NULL
            """)
            count("telegram_guests_without_web_account", """
                SELECT count(*) FROM demo_telegram_identities ti
                LEFT JOIN demo_web_accounts a ON a.guest_id=ti.guest_id
                WHERE a.id IS NULL
            """)
            count("legacy_bot_users_without_verified_mapping", """
                SELECT count(*) FROM users u LEFT JOIN demo_telegram_identities ti
                ON ti.telegram_id=u.telegram_id WHERE ti.telegram_id IS NULL
            """)
            count("unverified_email_reservations", """
                SELECT count(*) FROM demo_web_accounts a
                LEFT JOIN demo_verified_emails v ON v.account_id=a.id
                WHERE a.email IS NOT NULL AND v.account_id IS NULL
            """)
            count("verified_identity_candidates", CANDIDATES + """
                SELECT count(*) FROM candidates
            """)
            count("subject_collision_groups", CANDIDATES + """
                SELECT count(*) FROM (
                  SELECT provider, provider_subject FROM candidates
                  GROUP BY provider, provider_subject HAVING count(DISTINCT account_id)>1
                ) conflicting
            """)
            count("account_provider_collision_groups", CANDIDATES + """
                SELECT count(*) FROM (
                  SELECT account_id, provider FROM candidates
                  GROUP BY account_id, provider HAVING count(DISTINCT provider_subject)>1
                ) conflicting
            """)
            count("empty_provider_subjects", CANDIDATES + """
                SELECT count(*) FROM candidates
                WHERE provider_subject IS NULL OR length(btrim(provider_subject))=0
            """)
            has_registry = "auth_identities" in tables
            result["registry_present"] = has_registry
            if has_registry:
                # A safe backfill and a safe enforcement cutover require
                # different gates. Enforcement additionally requires that
                # EVERY independently verified legacy provider claim already
                # exists in the canonical ledger with the same account owner.
                count("registry_missing_verified_candidates", CANDIDATES + """
                    SELECT count(*) FROM candidates c
                    LEFT JOIN auth_identities ai ON ai.provider=c.provider
                        AND ai.provider_subject=c.provider_subject
                        AND ai.account_id=c.account_id
                    WHERE ai.id IS NULL
                """)
                count("registry_binding_conflicts", CANDIDATES + """
                    SELECT count(DISTINCT ai.id)
                    FROM auth_identities ai JOIN candidates c ON ai.provider=c.provider
                    AND (ai.provider_subject=c.provider_subject OR ai.account_id=c.account_id)
                    WHERE ai.account_id <> c.account_id
                       OR ai.provider_subject <> c.provider_subject
                """)
                count("registry_orphan_bindings", CANDIDATES + """
                    SELECT count(*) FROM auth_identities ai
                    LEFT JOIN candidates c ON c.provider=ai.provider
                      AND c.provider_subject=ai.provider_subject
                      AND c.account_id=ai.account_id
                    WHERE c.account_id IS NULL
                """)
            else:
                result["registry_binding_conflicts"] = 0
                result["registry_orphan_bindings"] = 0
                result["registry_missing_verified_candidates"] = 0

            blockers = (
                "normalized_email_collision_groups", "orphan_web_guests",
                "orphan_telegram_guest_links", "subject_collision_groups",
                "account_provider_collision_groups", "empty_provider_subjects",
                "registry_binding_conflicts", "registry_orphan_bindings",
            )
            result["safe_to_backfill"] = has_registry and all(result[k] == 0 for k in blockers)
            # Existing legitimate unverified email accounts are NOT upgraded
            # implicitly and do not block cutover for verified identities.
            result["safe_to_enforce"] = (
                result["safe_to_backfill"]
                and result["telegram_guests_without_web_account"] == 0
                and result["registry_missing_verified_candidates"] == 0
            )
            return result
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        result = audit(os.getenv("DATABASE_URL", ""))
        print(json.dumps(result, sort_keys=True))
        if not result["safe_to_backfill"]:
            raise SystemExit(2)
    except (ValueError, RuntimeError):
        print("Identity audit blocked: invalid database or missing table", file=sys.stderr)
        raise SystemExit(1)
    except Exception as exc:
        print("Identity audit failed: " + type(exc).__name__, file=sys.stderr)
        raise SystemExit(1) from None
