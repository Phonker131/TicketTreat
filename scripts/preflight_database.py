"""Read-only release preflight for an existing TicketTreat PostgreSQL database.

No personal identifiers, credentials, emails or row contents are printed.
Exit nonzero on migration-blocking duplicates, inconsistent ticket lineage
or already-overbooked events. Run against restored staging before applying
migrations; run again after migration and before production cutover.
"""
from __future__ import annotations

import json
import os
import sys
from sqlalchemy import create_engine,inspect,text


def audit(database_url:str)->dict[str,int|bool]:
    if not database_url.startswith(("postgresql://","postgresql+psycopg2://")):
        raise ValueError("Only PostgreSQL connection URLs are allowed")
    engine=create_engine(database_url,pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            tables=set(inspect(conn).get_table_names())
            required={"users","events","registrations","demo_tickets","demo_guests"}
            absent=sorted(required-tables)
            if absent:
                raise RuntimeError("Missing required tables: "+", ".join(absent))
            duplicates=conn.execute(text("""
                SELECT count(*) FROM (
                  SELECT user_id,event_id FROM registrations
                  GROUP BY user_id,event_id HAVING count(*) > 1
                ) AS duplicates
            """)).scalar_one()
            claims=0
            dangling=0
            if "demo_legacy_ticket_claims" in tables:
                claims=conn.execute(text("SELECT count(*) FROM demo_legacy_ticket_claims")).scalar_one()
                dangling=conn.execute(text("""
                    SELECT count(*) FROM demo_legacy_ticket_claims c
                    LEFT JOIN registrations r ON r.id=c.registration_id
                    LEFT JOIN demo_tickets t ON t.id=c.ticket_id
                    WHERE r.id IS NULL OR t.id IS NULL
                       OR t.event_id <> c.event_id
                       OR r.event_id <> c.event_id
                """)).scalar_one()
            overbooked=conn.execute(text("""
                SELECT COUNT(*) FROM (
                  SELECT e.id FROM events e
                  LEFT JOIN (
                    SELECT r.event_id,count(*) n FROM registrations r
                    WHERE NOT EXISTS (
                      SELECT 1 FROM demo_legacy_ticket_claims c
                      WHERE c.registration_id=r.id
                    )
                    GROUP BY r.event_id
                  ) bot ON bot.event_id=e.id
                  LEFT JOIN (
                    SELECT event_id,count(*) n FROM demo_tickets
                    WHERE ticket_status='active'
                    GROUP BY event_id
                  ) tickets ON tickets.event_id=e.id
                  WHERE e.max_participants IS NOT NULL
                  AND coalesce(bot.n,0)+coalesce(tickets.n,0)>e.max_participants
                ) overbooked
            """)).scalar_one() if "demo_legacy_ticket_claims" in tables else 0
            report={
                "migration_blocking_duplicate_pairs":int(duplicates),
                "converted_legacy_claims":int(claims),
                "invalid_legacy_ticket_claims":int(dangling),
                "overbooked_events":int(overbooked),
            }
            report["safe_to_migrate"]=all(v==0 for k,v in report.items()
                                          if k!="converted_legacy_claims")
            return report
    finally:
        engine.dispose()


if __name__=="__main__":
    try:
        report=audit(os.environ.get("DATABASE_URL",""))
        print(json.dumps(report,sort_keys=True))
        if not report["safe_to_migrate"]:
            raise SystemExit(2)
    except Exception as error:
        print("Release preflight failed:",str(error),file=sys.stderr)
        raise SystemExit(1) from error
