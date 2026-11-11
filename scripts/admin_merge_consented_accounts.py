"""One-shot, operator-authorized pilot identity reconciliation.

Five exact groups, no fuzzy matching or user discovery:
  web 13 <- telegram-only web 21 (ticket/checkin preserved)
  web 15 <- telegram-only web 16 (ticket/checkin preserved)
  web 11 <- historical Bot User 6 (web 3 is EXCLUDED)
  web  9 <- historical Bot User 4
  web  4 <- unused guest 3 (no login, tickets or reservations)

NEVER update web accounts 3 and 10 (the latter is user's spare email).
Only run on production after verified independent encrypted S3 backup.
All writes are one atomic transaction and insert into durable admin audit
table. This script is deliberately NOT called by the live API.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime, timezone

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

SHADOWS=((21,13,"Svyatoslav"),(16,15,"Yevhenii"))
LEGACY_BOTS=((6,11,"Zakhar"),(4,9,"Aleksei"))
ORPHAN=(3,4,"Amber Events")
EXCLUDED_ACCOUNTS={3,10}
ACTOR_ACCOUNT_ID=1

class MergeBlocked(RuntimeError):
    pass

def require(condition, message):
    if not condition:
        raise MergeBlocked(message)

def one(cur, query, params=()):
    cur.execute(query, params)
    return cur.fetchone()

def rows(cur, query, params=()):
    cur.execute(query, params)
    return cur.fetchall()

def audit(cur, dest_account, action):
    require(len(action)<=48, "audit_action_too_long")
    cur.execute(
        "INSERT INTO demo_account_admin_audit"
        "(actor_account_id,target_account_id,action,created_at)"
        " VALUES (%s,%s,%s,now())",
        (ACTOR_ACCOUNT_ID,dest_account,action),
    )

def subject_lock(cur, telegram_id):
    value=int(telegram_id)
    raw=hashlib.sha256(
        ("tickettreat:telegram-principal:v1:"+str(value)).encode()
    ).digest()
    key=int.from_bytes(raw[:8],byteorder="big",signed=True)
    cur.execute("SELECT pg_advisory_xact_lock(%s)",(key,))

def get_account(cur,account_id,lock=False):
    suffix=" FOR UPDATE" if lock else ""
    return one(cur,
       "SELECT id,guest_id,first_name,last_name,email,password_hash"
       " FROM demo_web_accounts WHERE id=%s"+suffix,(account_id,))

def tg_mapping(cur,guest_id):
    return one(cur,"SELECT telegram_id,guest_id FROM demo_telegram_identities WHERE guest_id=%s",(guest_id,))

def id_claims(cur,account_id):
    return rows(cur,"SELECT id,provider,account_id FROM auth_identities WHERE account_id=%s ORDER BY provider",(account_id,))

def ticket_rows(cur,guest_id):
    return rows(cur, """SELECT id,event_id,ticket_status,payment_status,
        payment_provider,checked_in_at,qr_token FROM demo_tickets
        WHERE guest_id=%s ORDER BY event_id,id""",(guest_id,))

def event_overlap(cur,table,src,dst):
    t=sql.Identifier(table)
    query=sql.SQL("SELECT count(*) AS n FROM {} s JOIN {} d ON s.event_id=d.event_id WHERE s.guest_id=%s AND d.guest_id=%s").format(t,t)
    return int(one(cur,query,(src,dst))["n"])

def count_guest(cur,table,guest_id):
    query=sql.SQL("SELECT count(*) AS n FROM {} WHERE guest_id=%s").format(sql.Identifier(table))
    return int(one(cur,query,(guest_id,))["n"])

def total_tickets(cur):
    return int(one(cur,"SELECT count(*) AS n FROM demo_tickets")["n"])

def check_protected(cur):
    # These two rows must remain untouched, whatever the operation's result.
    result={}
    for account_id in sorted(EXCLUDED_ACCOUNTS):
        acct=get_account(cur,account_id)
        require(acct is not None,"protected_account_missing")
        require(account_id!=10 or str(acct["email"] or "").lower()=="shapiktimur@gmail.com",
                "protected_spare_email_changed")
        result[account_id]={
            "guest_id":acct["guest_id"],"email":acct["email"],
            "password_hash":acct["password_hash"],
            "roles":tuple((x["role"] for x in rows(cur,
                "SELECT role FROM demo_web_account_roles WHERE account_id=%s",
                (account_id,)))),
            "claims":tuple((x["id"],x["provider"]) for x in id_claims(cur,account_id)),
            "tickets":tuple(x["id"] for x in ticket_rows(cur,acct["guest_id"])),
        }
    return result

def ensure_target(cur, dest_id, lock):
    require(dest_id not in EXCLUDED_ACCOUNTS,"excluded_destination")
    account=get_account(cur,dest_id,lock=lock)
    require(account is not None,"destination_missing_"+str(dest_id))
    require(account["email"] is not None,"destination_needs_email_"+str(dest_id))
    require(not one(cur,
        "SELECT 1 FROM demo_global_admin_bindings WHERE account_id=%s",
        (dest_id,)),
        "destination_admin_restriction")
    return account

def shadow_group(cur,source_id,dest_id,name,apply):
    source=get_account(cur,source_id,lock=apply)
    target=ensure_target(cur,dest_id,lock=apply)
    require(source is not None and source_id!=dest_id,"shadow_source_missing")
    require(source["guest_id"]!=target["guest_id"],"same_guest_in_shadow")
    require(source["email"] is None and source["password_hash"]=="!telegram-only",
            "source_not_telegram_only_"+str(source_id))
    role=one(cur,"SELECT role FROM demo_web_account_roles WHERE account_id=%s",(source_id,))
    require(role is not None and role["role"]=="participant","shadow_role_not_participant")
    require(not one(cur,"SELECT 1 FROM demo_global_admin_bindings WHERE account_id=%s",(source_id,)),"shadow_admin_binding")
    require(not one(cur,"SELECT 1 FROM demo_event_ownership WHERE owner_account_id=%s",(source_id,)),"shadow_organizer_owner")
    require(not one(cur,"SELECT 1 FROM demo_google_identities WHERE account_id=%s",(source_id,)),"shadow_google_identity")
    require(not one(cur,"SELECT 1 FROM demo_verified_emails WHERE account_id=%s",(source_id,)),"shadow_verified_email")
    require(not one(cur,"SELECT 1 FROM demo_organizer_applications WHERE account_id=%s",(source_id,)),"shadow_organizer_application")
    src_map=tg_mapping(cur,source["guest_id"])
    dst_map=tg_mapping(cur,target["guest_id"])
    src_claims=id_claims(cur,source_id)
    dst_claims=id_claims(cur,dest_id)
    # Supports an idempotent retry without making a second transfer.
    if src_map is None and dst_map is not None and not any(c["provider"]=="telegram" for c in src_claims):
        require(any(c["provider"]=="telegram" for c in dst_claims),"shadow_already_linked_ledger_missing")
        require(count_guest(cur,"demo_tickets",source["guest_id"])==0,"linked_shadow_still_has_tickets")
        return {"label":name,"source":"web_"+str(source_id),"target":"web_"+str(dest_id),"status":"already_linked"}
    require(src_map is not None and dst_map is None,"telegram_shadow_mapping_conflict")
    require([c["provider"] for c in src_claims]==["telegram"],"shadow_other_provider_claims")
    require(not any(c["provider"]=="telegram" for c in dst_claims),"destination_has_telegram_claim")
    tid=src_map["telegram_id"]
    claim=src_claims[0]
    require(one(cur,"SELECT account_id FROM auth_identities WHERE id=%s",(claim["id"],))["account_id"]==source_id,
            "telegram_claim_wrong_owner")
    require(one(cur,"SELECT telegram_id FROM demo_guests WHERE id=%s",(target["guest_id"],))["telegram_id"] is None,
            "target_guest_has_telegram_id")
    require(one(cur,"SELECT telegram_id FROM demo_guests WHERE id=%s",(source["guest_id"],))["telegram_id"]==tid,
            "source_guest_telegram_inconsistent")
    src_tickets=ticket_rows(cur,source["guest_id"])
    dst_tickets=ticket_rows(cur,target["guest_id"])
    for table in ("demo_tickets","demo_waitlist","demo_paid_reservations"):
        require(event_overlap(cur,table,source["guest_id"],target["guest_id"])==0,
                "duplicate_event_"+table+"_"+str(source_id))
    require(count_guest(cur,"demo_paid_reservations",source["guest_id"])==0,
            "paid_hold_requires_separate_review")
    require(count_guest(cur,"demo_waitlist",source["guest_id"])==0,
            "waitlist_requires_separate_review")
    # QR ids, paid statuses and check-in stamps must remain EXACTLY unchanged.
    fingerprint=[
        (x["id"],x["event_id"],x["ticket_status"],x["payment_status"],
         x["payment_provider"],x["checked_in_at"],x["qr_token"])
        for x in src_tickets
    ]
    if apply:
        subject_lock(cur,tid)
        event_ids=sorted({t["event_id"] for t in src_tickets+dst_tickets})
        if event_ids:
            cur.execute("SELECT id FROM events WHERE id=ANY(%s) ORDER BY id FOR UPDATE",(event_ids,))
            require(len(cur.fetchall())==len(event_ids),"event_disappeared")
        # Serialize QR movement with scanning/cancellation of either guest.
        cur.execute("SELECT id FROM demo_tickets WHERE guest_id=ANY(%s) ORDER BY id FOR UPDATE",
                    ([source["guest_id"],target["guest_id"]],))
        cur.fetchall()
        cur.execute("UPDATE demo_tickets SET guest_id=%s WHERE guest_id=%s",
                    (target["guest_id"],source["guest_id"]))
        require(cur.rowcount==len(src_tickets),"ticket_transfer_count_mismatch")
        cur.execute("UPDATE demo_telegram_identities SET guest_id=%s WHERE telegram_id=%s AND guest_id=%s",
                    (target["guest_id"],tid,source["guest_id"]))
        require(cur.rowcount==1,"telegram_link_transfer_count_mismatch")
        cur.execute("UPDATE auth_identities SET account_id=%s WHERE id=%s AND account_id=%s",
                    (dest_id,claim["id"],source_id))
        require(cur.rowcount==1,"provider_claim_transfer_count_mismatch")
        cur.execute("UPDATE demo_guests SET telegram_id=NULL,access_token=%s WHERE id=%s",
                    (secrets.token_urlsafe(36),source["guest_id"]))
        require(cur.rowcount==1,"old_guest_invalidation_failed")
        cur.execute("UPDATE demo_guests SET telegram_id=%s WHERE id=%s",
                    (tid,target["guest_id"]))
        require(cur.rowcount==1,"new_guest_telegram_link_failed")
        cur.execute("DELETE FROM demo_web_sessions WHERE account_id=%s",(source_id,))
        cur.execute("UPDATE demo_telegram_link_challenges SET status='expired' WHERE account_id=%s AND status='pending'",(source_id,))
        audit(cur,dest_id,f"manual_tg_shadow_{source_id}_to_{dest_id}")
        final=ticket_rows(cur,target["guest_id"])
        all_ids={x["id"] for x in src_tickets+dst_tickets}
        require(all_ids=={x["id"] for x in final},"post_transfer_ticket_ids_differ")
        byid={x["id"]:x for x in final}
        require(all((x["id"],x["event_id"],x["ticket_status"],x["payment_status"],
                     x["payment_provider"],x["checked_in_at"],x["qr_token"]) ==
                    (byid[x["id"]]["id"],byid[x["id"]]["event_id"],
                     byid[x["id"]]["ticket_status"],byid[x["id"]]["payment_status"],
                     byid[x["id"]]["payment_provider"],byid[x["id"]]["checked_in_at"],
                     byid[x["id"]]["qr_token"]) for x in src_tickets),
                "ticket_state_or_checkin_changed")
        require(tg_mapping(cur,target["guest_id"]) is not None,"post_transfer_missing_telegram")
        require(tg_mapping(cur,source["guest_id"]) is None,"post_transfer_shadow_has_telegram")
    return {"label":name,"source":"web_"+str(source_id),"target":"web_"+str(dest_id),
            "status":"merged" if apply else "ready",
            "telegram_credential_moved":1,"tickets_moved":len(src_tickets),
            "checked_in_preserved":sum(bool(x["checked_in_at"]) for x in src_tickets),
            "prior_source_sessions_revoked":"yes" if apply else "pending",
            "email_verification_needed":not bool(one(cur,
                "SELECT 1 FROM demo_verified_emails WHERE account_id=%s",(dest_id,)))}

def bot_group(cur,bot_id,dest_id,name,apply):
    target=ensure_target(cur,dest_id,lock=apply)
    u=one(cur,"SELECT id,telegram_id,first_name,last_name,phone FROM users WHERE id=%s",(bot_id,))
    require(u is not None and u["telegram_id"] and int(u["telegram_id"])>0,
            "legacy_bot_missing_"+str(bot_id))
    tid=int(u["telegram_id"])
    mapping=one(cur,"SELECT guest_id FROM demo_telegram_identities WHERE telegram_id=%s",(tid,))
    dest_link=tg_mapping(cur,target["guest_id"])
    dest_claims=id_claims(cur,dest_id)
    if mapping is not None and mapping["guest_id"]==target["guest_id"] and dest_link is not None:
        require(any(x["provider"]=="telegram" for x in dest_claims),"bot_already_linked_ledger_missing")
        return {"label":name,"source":"bot_"+str(bot_id),"target":"web_"+str(dest_id),"status":"already_linked"}
    require(mapping is None and dest_link is None,"legacy_bot_already_linked_elsewhere")
    require(not any(x["provider"]=="telegram" for x in dest_claims),"target_has_telegram_claim")
    require(one(cur,"SELECT telegram_id FROM demo_guests WHERE id=%s",(target["guest_id"],))["telegram_id"] is None,
            "target_guest_already_has_telegram")
    require(not one(cur,"SELECT id FROM demo_guests WHERE telegram_id=%s AND id!=%s",
                    (tid,target["guest_id"])),"legacy_telegram_appears_in_another_guest")
    require(not one(cur,
        "SELECT account_id FROM auth_identities WHERE provider='telegram' AND provider_subject=%s",
        (str(tid),)),"legacy_telegram_credential_taken")
    count=int(one(cur,"SELECT count(*) AS n FROM registrations WHERE user_id=%s",(bot_id,))["n"])
    require(count==0,"legacy_registrations_need_ticket_reconciliation")
    if apply:
        subject_lock(cur,tid)
        cur.execute("INSERT INTO demo_telegram_identities (telegram_id,guest_id) VALUES (%s,%s)",
                    (tid,target["guest_id"]))
        cur.execute("INSERT INTO auth_identities (account_id,provider,provider_subject,verified_at)"
                    " VALUES (%s,'telegram',%s,now())",(dest_id,str(tid)))
        cur.execute("UPDATE demo_guests SET telegram_id=%s WHERE id=%s",
                    (tid,target["guest_id"]))
        require(cur.rowcount==1,"bot_target_guest_update_failed")
        audit(cur,dest_id,f"manual_bot_{bot_id}_to_web_{dest_id}")
    return {"label":name,"source":"bot_"+str(bot_id),"target":"web_"+str(dest_id),
            "status":"merged" if apply else "ready","telegram_credential_connected":1,
            "legacy_registrations":0,
            "email_verification_needed":not bool(one(cur,
                "SELECT 1 FROM demo_verified_emails WHERE account_id=%s",(dest_id,)))}

def orphan_guest(cur,guest_id,dest_id,label,apply):
    target=ensure_target(cur,dest_id,lock=apply)
    source=one(cur,"SELECT id,first_name,last_name,telegram_id FROM demo_guests WHERE id=%s",(guest_id,))
    if source is None:
        return {"label":label,"source":"guest_"+str(guest_id),"target":"web_"+str(dest_id),"status":"already_archived"}
    require(guest_id!=target["guest_id"],"orphan_already_target")
    require(str(source["first_name"] or "").casefold()=="amber events",
            "orphan_guest_is_not_amber")
    require(source["telegram_id"] is None,"guest_has_telegram_unverified")
    require(not one(cur,"SELECT 1 FROM demo_web_accounts WHERE guest_id=%s",(guest_id,)),
            "guest_has_web_account")
    # Check ALL tables with a guest_id column, not just ticket/paid tables.
    refs=[]
    metadata=rows(cur,"SELECT table_schema,table_name FROM information_schema.columns"
         " WHERE column_name='guest_id' AND table_schema='public'"
         " AND table_name!='demo_guests' ORDER BY table_name")
    for m in metadata:
        table=sql.Identifier(m["table_schema"],m["table_name"])
        q=sql.SQL("SELECT count(*) AS n FROM {} WHERE guest_id=%s").format(table)
        n=int(one(cur,q,(guest_id,))["n"])
        if n:refs.append({"table":m["table_name"],"count":n})
    require(not refs,"orphan_has_references_cannot_delete")
    if apply:
        cur.execute("DELETE FROM demo_guests WHERE id=%s",(guest_id,))
        require(cur.rowcount==1,"orphan_delete_mismatch")
        audit(cur,dest_id,f"manual_empty_guest_{guest_id}_to_{dest_id}")
    return {"label":label,"source":"guest_"+str(guest_id),"target":"web_"+str(dest_id),
            "status":"archived_empty" if apply else "ready_for_archival",
            "tickets":0,"registrations":0}

def run(apply):
    uri=os.getenv("DATABASE_URL","")
    require(uri.startswith(("postgresql://","postgres://","postgresql+psycopg2://")),
            "requires_postgresql")
    if uri.startswith("postgresql+psycopg2://"):
        uri="postgresql://"+uri.split("://",1)[1]
    if apply:
        require(os.environ.get("TICKETTREAT_MANUAL_MERGE_APPROVED")=="YES",
                "write_approval_missing")
        backup=os.environ.get("TICKETTREAT_MERGE_BACKUP_REFERENCE","")
        require(backup.startswith("s3://") and
                "tickettreat-20261111T140349Z-4b7b1e.dump.ttbk" in backup,
                "fresh_verified_backup_reference_required")
    conn=psycopg2.connect(uri,connect_timeout=15)
    try:
        conn.set_session(readonly=not apply,autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL lock_timeout='12s'")
            cur.execute("SET LOCAL statement_timeout='120s'")
            if apply:
                # One migration at a time; also lock target+shadow rows below.
                cur.execute("SELECT pg_advisory_xact_lock(%s)",(18712251120,))
            require(bool(one(cur,
                "SELECT 1 FROM demo_global_admin_bindings WHERE account_id=%s",
                (ACTOR_ACCOUNT_ID,))),"operator_is_not_global_admin")
            protected_before=check_protected(cur)
            total_before=total_tickets(cur)
            results=[]
            for source,dest,label in SHADOWS:
                results.append(shadow_group(cur,source,dest,label,apply))
            for source,dest,label in LEGACY_BOTS:
                results.append(bot_group(cur,source,dest,label,apply))
            results.append(orphan_guest(cur,*ORPHAN,apply))
            require(check_protected(cur)==protected_before,
                    "excluded_account_would_be_modified")
            require(total_tickets(cur)==total_before,
                    "total_ticket_count_changed")
            require(not one(cur,"SELECT 1 FROM auth_identities"
                " GROUP BY provider,provider_subject HAVING count(*)>1 LIMIT 1"),
                "duplicate_verified_provider_subjects")
            require(not one(cur,"SELECT 1 FROM auth_identities"
                " GROUP BY account_id,provider HAVING count(*)>1 LIMIT 1"),
                "same_provider_multiple_claims")
            # Cross-check checked-in tickets remain checked in after transfer.
            out={"mode":"apply" if apply else "dry_run","status":"committed" if apply else "ready",
                 "groups":results,"tickets_total_before":total_before,
                 "tickets_total_after":total_tickets(cur),
                 "protected_web_accounts_untouched":[3,10],
                 "source_branch":"ops/consented-canonical-merge-20261111"}
            if apply:
                conn.commit()
            else:
                conn.rollback()
        print(json.dumps(out,ensure_ascii=False,sort_keys=True),flush=True)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--apply",action="store_true")
    args=parser.parse_args()
    try:
        run(args.apply)
    except Exception as exc:
        # Fail closed. No secrets or personally identifying subjects in logs.
        print("Identity reconciliation blocked: "+type(exc).__name__+
              (": "+str(exc) if isinstance(exc,MergeBlocked) else ""),
              file=sys.stderr,flush=True)
        raise SystemExit(1) from None
