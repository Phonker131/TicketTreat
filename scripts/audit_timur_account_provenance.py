"""Read-only private review of the three previously found Timur-profile records.

Print masked contact emails, account IDs, guest relationships, provider TYPES,
ticket counts, and privileged flags. No provider subjects or secrets printed.
Never changes records, sessions, roles or tickets.
"""
from __future__ import annotations
import json, os, re, sys
import psycopg2
from psycopg2.extras import RealDictCursor

def masked(value):
    if not value or "@" not in value:
        return None
    local,domain=value.strip().lower().split("@",1)
    if len(local)<=4:
        return local[:1]+"***@"+domain
    return local[:3]+"***"+local[-2:]+"@"+domain

def run():
    url=os.environ.get("DATABASE_URL","")
    if not url.startswith(("postgresql://","postgres://","postgresql+psycopg2://")):
        raise ValueError("only PostgreSQL supported")
    url=url.replace("postgresql+psycopg2://","postgresql://",1)
    conn=psycopg2.connect(url,connect_timeout=15)
    try:
        conn.set_session(readonly=True,autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute("""SELECT id,guest_id,first_name,last_name,email,created_at
                           FROM demo_web_accounts WHERE id IN (1,10) ORDER BY id""")
            accounts=[dict(r) for r in cur.fetchall()]
            guest_ids=sorted(set([2]+[int(a["guest_id"]) for a in accounts]))
            cur.execute("""SELECT id,first_name,last_name,email,created_at
                           FROM demo_guests WHERE id=ANY(%s) ORDER BY id""",(guest_ids,))
            guests=[dict(r) for r in cur.fetchall()]
            cur.execute("""SELECT a.id,a.guest_id,COUNT(DISTINCT t.id) AS tickets,
                           COUNT(DISTINCT w.id) AS waiting
                           FROM demo_web_accounts a
                           LEFT JOIN demo_tickets t ON t.guest_id=a.guest_id
                           LEFT JOIN demo_waitlist w ON w.guest_id=a.guest_id
                           WHERE a.id IN (1,10)
                           GROUP BY a.id,a.guest_id ORDER BY a.id""")
            usage={int(r["id"]):dict(r) for r in cur.fetchall()}
            cur.execute("""SELECT guest_id,COUNT(*) AS tickets FROM demo_tickets
                           WHERE guest_id=2 GROUP BY guest_id""")
            guest2_tickets=int((cur.fetchone() or {}).get("tickets",0))
            cur.execute("""SELECT account_id,provider FROM auth_identities
                           WHERE account_id IN (1,10) ORDER BY account_id,provider""")
            providers={}
            for r in cur.fetchall(): providers.setdefault(int(r["account_id"]),[]).append(r["provider"])
            cur.execute("""SELECT account_id,role FROM demo_web_account_roles
                           WHERE account_id IN (1,10)""")
            roles={int(r["account_id"]):r["role"] for r in cur.fetchall()}
            cur.execute("""SELECT account_id FROM demo_verified_emails
                           WHERE account_id IN (1,10)""")
            verified={int(r["account_id"]) for r in cur.fetchall()}
            cur.execute("""SELECT account_id FROM demo_global_admin_bindings
                           WHERE account_id IN (1,10)""")
            admin={int(r["account_id"]) for r in cur.fetchall()}
            cur.execute("""SELECT account_id,COUNT(*) AS count FROM demo_web_sessions
                           WHERE account_id IN (1,10) GROUP BY account_id""")
            sessions={int(r["account_id"]):int(r["count"]) for r in cur.fetchall()}
            cur.execute("""SELECT g.id AS guest_id, EXISTS(SELECT 1
                FROM demo_telegram_identities ti WHERE ti.guest_id=g.id)
                AS telegram_identity_verified
                FROM demo_guests g WHERE g.id=ANY(%s) ORDER BY g.id""",(guest_ids,))
            telegram={int(r["guest_id"]):r["telegram_identity_verified"] for r in cur.fetchall()}
            # Check for provider subjects colliding across these accounts,
            # without disclosing the identity values themselves.
            cur.execute("""SELECT provider, COUNT(DISTINCT account_id) AS owners
                           FROM auth_identities WHERE account_id IN (1,10)
                           GROUP BY provider,provider_subject HAVING COUNT(DISTINCT account_id)>1""")
            overlapping_provider_subjects=len(cur.fetchall())
        conn.rollback()
    finally:
        conn.close()
    out={"web_accounts":[],"guests":[],"guest_2_ticket_count":guest2_tickets,
         "provider_subject_conflicts":overlapping_provider_subjects,
         "readonly":True}
    for a in accounts:
        ident=int(a["id"])
        out["web_accounts"].append({
            "id":ident,"guest_id":a["guest_id"],
            "name":" ".join(filter(None,[a["first_name"],a["last_name"]])),
            "email_masked":masked(a["email"]),
            "email_verified":ident in verified,"provider_types":providers.get(ident,[]),
            "role":roles.get(ident),"global_admin_binding":ident in admin,
            "ticket_count":int(usage[ident]["tickets"]),
            "waiting_count":int(usage[ident]["waiting"]),
            "active_sessions":sessions.get(ident,0),
            "created":str(a["created_at"].date()) if a["created_at"] else None,
        })
    for g in guests:
        out["guests"].append({
            "id":g["id"],"name":" ".join(filter(None,[g["first_name"],g["last_name"]])),
            "contact_email_masked":masked(g["email"]),
            "telegram_verified":telegram.get(int(g["id"]),False),
            "has_web_account":any(a["guest_id"]==g["id"] for a in accounts),
            "created":str(g["created_at"].date()) if g["created_at"] else None,
        })
    return out

if __name__=="__main__":
    try: print(json.dumps(run(),ensure_ascii=False),flush=True)
    except Exception as exc:
        print("Profile provenance audit failed: "+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1) from None
