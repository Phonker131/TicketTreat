"""Production duplicate merge feasibility read-only preflight.

No personal contact strings, Telegram IDs, Google subjects, tokens, dates of
birth or QR codes appear in stdout. All reads in a READ ONLY PostgreSQL TX.
Target account IDs are the user-authorized short list; specifically exclude
Timur's primary and secondary (1,10), and Zakhar's inaccessible web #3.
"""
import json,os,sys
import psycopg2
from psycopg2.extras import RealDictCursor
WEB_IDS=(3,4,9,11,13,15,16,21,1,10)
BOT_IDS=(4,6)
GUEST_IDS=(2,3)
def safe_query(cur,q,params=()):
    cur.execute(q,params);return [dict(x) for x in cur.fetchall()]
def main():
    url=os.getenv("DATABASE_URL","")
    if not url.startswith(("postgres://","postgresql://","postgresql+psycopg2://")):raise ValueError("pg required")
    url=url.replace("postgresql+psycopg2://","postgresql://",1)
    conn=psycopg2.connect(url,connect_timeout=10)
    try:
        conn.set_session(readonly=True,autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            a=safe_query(cur,"SELECT id,guest_id,first_name,last_name,email,created_at FROM demo_web_accounts WHERE id=ANY(%s)",(list(WEB_IDS),))
            v={x["account_id"] for x in safe_query(cur,"SELECT account_id FROM demo_verified_emails WHERE account_id=ANY(%s)",(list(WEB_IDS),))}
            ids=safe_query(cur,"SELECT account_id,provider FROM auth_identities WHERE account_id=ANY(%s)",(list(WEB_IDS),))
            byid={}
            for x in ids:byid.setdefault(x["account_id"],[]).append(x["provider"])
            roles={x["account_id"]:x["role"] for x in safe_query(cur,"SELECT account_id,role FROM demo_web_account_roles WHERE account_id=ANY(%s)",(list(WEB_IDS),))}
            admin={x["account_id"] for x in safe_query(cur,"SELECT account_id FROM demo_global_admin_bindings WHERE account_id=ANY(%s)",(list(WEB_IDS),))}
            owners={x["owner_account_id"] for x in safe_query(cur,"SELECT owner_account_id FROM demo_event_ownership WHERE owner_account_id=ANY(%s)",(list(WEB_IDS),))}
            g_all={x["id"]:x for x in safe_query(cur,"SELECT id,email,first_name,last_name,created_at FROM demo_guests WHERE id=ANY(%s)",(list(set(GUEST_IDS+[x["guest_id"] for x in a])),))}
            tg=safe_query(cur,"SELECT guest_id FROM demo_telegram_identities WHERE guest_id=ANY(%s)",(list(g_all),))
            verified_tg={x["guest_id"] for x in tg}
            def refs(gid):
                out={}
                for name,table in [("tickets","demo_tickets"),("waitlist","demo_waitlist"),("paid_reservations","demo_paid_reservations")]:
                    out[name]=int(safe_query(cur,"SELECT count(*)::int AS n FROM "+table+" WHERE guest_id=%s",(gid,))[0]["n"])
                out["ticket_types"]=safe_query(cur,"SELECT ticket_status,payment_provider,count(*)::int AS count,bool_or(checked_in_at IS NOT NULL) AS checked_in FROM demo_tickets WHERE guest_id=%s GROUP BY ticket_status,payment_provider",(gid,))
                return out
            accounts=[]
            for x in a:
                accounts.append({"id":x["id"],"guest_id":x["guest_id"],
                    "name":str(x["first_name"])+" "+str(x["last_name"]),
                    "email_verified":x["id"] in v,
                    "provider_types":sorted(byid.get(x["id"],[])),
                    "role":roles.get(x["id"],"unknown"),
                    "global_admin":x["id"] in admin,
                    "organizer_event_owner":x["id"] in owners,
                    "telegram_verified":x["guest_id"] in verified_tg,
                    "email_key":"spare" if (x["email"] or "").casefold()=="shapiktimur@gmail.com" else "other",
                    "activity":refs(x["guest_id"])})
            bot_users=safe_query(cur,"SELECT id,telegram_id,first_name,last_name FROM users WHERE id=ANY(%s)",(list(BOT_IDS),))
            bots=[]
            for b in bot_users:
                cur.execute("""SELECT ti.guest_id,a.id AS account_id FROM demo_telegram_identities ti
                               LEFT JOIN demo_web_accounts a ON a.guest_id=ti.guest_id
                               WHERE ti.telegram_id=%s""",(b["telegram_id"],))
                linked=cur.fetchone()
                regs=safe_query(cur,"SELECT r.id,r.event_id FROM registrations r WHERE r.user_id=%s",(b["id"],))
                bots.append({"id":b["id"],"name":str(b["first_name"])+" "+str(b["last_name"]),
                    "verified_telegram_mapping":bool(linked),
                    "mapped_account_id":linked["account_id"] if linked else None,
                    "legacy_registrations":len(regs)})
            guests=[]
            for gid in GUEST_IDS:
                g=g_all.get(gid)
                if g is None:continue
                acct=next((x["id"] for x in a if x["guest_id"]==gid),None)
                guests.append({"id":gid,"name":str(g["first_name"])+" "+str(g["last_name"]),
                    "has_web_account":bool(acct),"telegram_verified":gid in verified_tg,
                    "activity":refs(gid)})
            print(json.dumps({"web_accounts":sorted(accounts,key=lambda x:x["id"]),
                "legacy_bot":bots,"orphan_guests":guests,"read_only":True},default=str,ensure_ascii=False),flush=True)
        conn.rollback()
    finally:conn.close()
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("Merge preflight blocked: "+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1) from None
