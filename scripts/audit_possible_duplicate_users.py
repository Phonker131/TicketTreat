"""READ-ONLY operator audit of potentially duplicated TicketTreat participants.

Compares independent web accounts, guest-only profiles, and unlinked legacy
bot users. Cyrillic and Latin transliterations are scored with Unidecode and
RapidFuzz. Names are *signals only*, never evidence sufficient to merge.
No secrets, full emails, phone numbers, Telegram IDs or provider subjects
are emitted. NO write queries and NO application startup/imports.
"""
from __future__ import annotations
import itertools
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

import psycopg2
from psycopg2.extras import RealDictCursor
from rapidfuzz.fuzz import ratio
from unidecode import unidecode


def norm_name(value):
    s = unidecode(unicodedata.normalize("NFKC", str(value or ""))).casefold()
    return re.sub(r"[^a-z0-9]", "", s)


def norm_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[-9:] if len(digits) >= 9 else ""


def norm_instagram(value):
    value = (value or "").strip().lower()
    value = re.sub(r"^https?://(www\.)?instagram\.com/", "", value)
    value = value.lstrip("@").split("?")[0].strip("/")
    return value if re.fullmatch(r"[a-z0-9_.]{3,40}", value) else ""


def name_pair(first, last):
    f, l = (first or "").strip(), (last or "").strip()
    if not f or not l or (f.casefold(), l.casefold()) in {
        ("telegram", "user"), ("telegram", "only"), ("unknown", "user")
    }:
        return None
    return (f, l)


def create_node(kind, ident, *names):
    node = {"kind": kind, "id": int(ident), "names": [], "email": set(),
            "phones": set(), "instagrams": set(), "verified_provider": set(),
            "unverified_telegram_ids": set(), "events": set(), "ticket_count": 0}
    for p in names:
        if p is not None:
            node["names"].append(p)
    return node


def add_fields(node, row):
    p = name_pair(row.get("first_name"), row.get("last_name"))
    if p and p not in node["names"]:
        node["names"].append(p)
    if row.get("email"):
        node["email"].add(str(row["email"]).strip().lower())
    if phone := norm_phone(row.get("phone")):
        node["phones"].add(phone)
    if instagram := norm_instagram(row.get("instagram")):
        node["instagrams"].add(instagram)


def read_table(cur, query):
    cur.execute(query)
    return [dict(r) for r in cur.fetchall()]


def audit():
    url = os.getenv("DATABASE_URL", "")
    if not url.startswith(("postgresql://", "postgres://", "postgresql+psycopg2://")):
        raise ValueError("PostgreSQL connection required")
    if url.startswith("postgresql+psycopg2://"):
        url = "postgresql://" + url.split("://", 1)[1]
    conn = psycopg2.connect(url, connect_timeout=15)
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            accounts = read_table(cur, """SELECT id, guest_id, first_name, last_name,
                email, phone, instagram, created_at FROM demo_web_accounts""")
            guests = read_table(cur, """SELECT id, telegram_id, first_name, last_name,
                email, username, created_at FROM demo_guests""")
            bot_users = read_table(cur, """SELECT id, telegram_id, first_name, last_name,
                phone, instagram, username FROM users""")
            tg_links = read_table(cur,
                "SELECT telegram_id, guest_id FROM demo_telegram_identities")
            verified = read_table(cur,
                "SELECT account_id FROM demo_verified_emails")
            registry = read_table(cur,
                "SELECT account_id, provider, provider_subject FROM auth_identities")
            tickets = read_table(cur,
                "SELECT guest_id, event_id, ticket_status FROM demo_tickets")
            bot_regs = read_table(cur,
                "SELECT r.user_id, r.event_id FROM registrations r")
            waitlists = read_table(cur,
                "SELECT guest_id, event_id FROM demo_waitlist")
        conn.rollback()
    finally:
        conn.close()

    guest_by_id = {int(g["id"]): g for g in guests}
    tg_to_guest = {int(x["telegram_id"]): int(x["guest_id"]) for x in tg_links}
    nodes = {}
    guest_to_node = {}
    linked_bot_ids = set()
    for a in accounts:
        key = ("web", int(a["id"]))
        node = create_node("web", a["id"])
        add_fields(node, a)
        nodes[key] = node
        guest_to_node[int(a["guest_id"])] = key
        if int(a["guest_id"]) in guest_by_id:
            add_fields(node, guest_by_id[int(a["guest_id"])])

    for g in guests:
        gid = int(g["id"])
        if gid not in guest_to_node:
            key = ("guest", gid)
            node = create_node("guest_without_web", gid)
            add_fields(node, g)
            nodes[key] = node
            guest_to_node[gid] = key
        if g.get("telegram_id"):
            nodes[guest_to_node[gid]]["unverified_telegram_ids"].add(str(g["telegram_id"]))

    tg_to_node = {}
    for tid, gid in tg_to_guest.items():
        key = guest_to_node.get(gid)
        if key is not None:
            tg_to_node[tid] = key
            nodes[key]["verified_provider"].add(("telegram", str(tid)))
    for u in bot_users:
        uid, tid = int(u["id"]), int(u["telegram_id"])
        if tid in tg_to_node:
            add_fields(nodes[tg_to_node[tid]], u)
            linked_bot_ids.add(uid)
            continue
        key = ("bot", uid)
        node = create_node("legacy_bot_unlinked", uid)
        add_fields(node, u)
        node["unverified_telegram_ids"].add(str(tid))
        nodes[key] = node

    verified_accounts = {int(r["account_id"]) for r in verified}
    for r in registry:
        key = ("web", int(r["account_id"]))
        if key in nodes:
            nodes[key]["verified_provider"].add((r["provider"], str(r["provider_subject"])))
    for a in accounts:
        key = ("web", int(a["id"]))
        if int(a["id"]) not in verified_accounts:
            continue
        # Email verification is a strong ownership signal but equality
        # of unverified contact fields is not evidence of ownership.
        email = str(a["email"] or "").lower().strip()
        if email:
            nodes[key]["verified_provider"].add(("email", email))

    user_to_node = {}
    for u in bot_users:
        uid, tid = int(u["id"]), int(u["telegram_id"])
        user_to_node[uid] = tg_to_node.get(tid) or ("bot", uid)
    for t in tickets:
        key = guest_to_node.get(int(t["guest_id"]))
        if key is not None:
            nodes[key]["events"].add(int(t["event_id"]))
            nodes[key]["ticket_count"] += 1
    for w in waitlists:
        key = guest_to_node.get(int(w["guest_id"]))
        if key is not None:
            nodes[key]["events"].add(int(w["event_id"]))
    for r in bot_regs:
        key = user_to_node.get(int(r["user_id"]))
        if key in nodes:
            nodes[key]["events"].add(int(r["event_id"]))

    def best_name(a, b):
        best = None
        for (af, al), (bf, bl) in itertools.product(a["names"], b["names"]):
            nf, nl, mf, ml = map(norm_name, (af, al, bf, bl))
            if not all((nf,nl,mf,ml)):
                continue
            standard = (ratio(nf, mf), ratio(nl, ml), False)
            swapped = (ratio(nf, ml), ratio(nl, mf), True)
            for first, last, inverted in (standard, swapped):
                quality = min(first, last) * .65 + max(first, last) * .35
                if best is None or quality > best[0]:
                    best = (quality, first, last, inverted, (af,al), (bf,bl))
        return best

    def display(node, chosen):
        preferred = chosen or (node["names"][0] if node["names"] else None)
        return {"type":node["kind"], "id":node["id"],
                "name": " ".join(preferred) if preferred else "(имя/фамилия неполные)",
                "tickets":node["ticket_count"]}

    candidates = []
    exact_name_pairs = 0
    transliterated_pairs = 0
    strong_signal_pairs = 0
    for a, b in itertools.combinations(nodes.values(), 2):
        shared_phone = bool(a["phones"] & b["phones"])
        shared_insta = bool(a["instagrams"] & b["instagrams"])
        shared_email = bool(a["email"] & b["email"])
        shared_tg_unverified = bool(a["unverified_telegram_ids"] & b["unverified_telegram_ids"])
        shared_verified = bool(a["verified_provider"] & b["verified_provider"])
        common_events = len(a["events"] & b["events"])
        match = best_name(a,b)
        score, signals = 0, []
        if shared_verified:
            score += 100
            signals.append("один проверенный провайдер в двух отдельных профилях (критично)")
        if shared_phone:
            score += 85
            signals.append("одинаковый телефон")
        if shared_insta:
            score += 75
            signals.append("одинаковый Instagram")
        if shared_email:
            score += 70
            signals.append("одинаковый контактный email (не обязательно проверенный)")
        if shared_tg_unverified:
            score += 65
            signals.append("одинаковый Telegram ID в незаверенной записи")
        if match:
            quality, first, last, inverted, names_a, names_b = match
            if min(first,last) >= 98:
                exact_name_pairs += 1
                score += 58
                signals.append("имя и фамилия совпадают после нормализации/транслитерации")
                if (names_a[0], names_a[1]) != (names_b[0], names_b[1]):
                    transliterated_pairs += 1
            elif min(first,last) >= 87 and quality >= 90:
                score += 37
                signals.append("очень похожие имя и фамилия, возможна транслитерация")
            elif min(first,last) >= 77 and quality >= 82:
                score += 22
                signals.append("похожее имя и фамилия, требуется ручная проверка")
            else:
                match = None
            if match and inverted:
                signals.append("возможна перестановка имени и фамилии")
        if common_events and score >= 22:
            score += min(common_events,2)*5
            signals.append("совпадает событие в истории: "+str(common_events))
        if any((shared_phone,shared_insta,shared_email,shared_tg_unverified,shared_verified)):
            strong_signal_pairs += 1
        if score < 22:
            continue
        if shared_verified:
            verdict = "КРИТИЧНО: проверенная связь конфликтует"
        elif score >= 90:
            verdict = "Высокая вероятность — проверка владельца"
        elif score >= 45:
            verdict = "Вероятное совпадение — проверить"
        else:
            verdict = "Слабое совпадение — только гипотеза"
        candidates.append({
            "a":display(a, match[4] if match else None),
            "b":display(b, match[5] if match else None),
            "score":round(score),
            "category":verdict,
            "evidence":signals,
            "warning":"Не объединять автоматически; имя и контактные поля не подтверждают личность."
        })
    candidates.sort(key=lambda c: -c["score"])
    summary = {
        "web_accounts":len(accounts),
        "guest_rows":len(guests),
        "guest_only_profiles":sum(n["kind"]=="guest_without_web" for n in nodes.values()),
        "legacy_bot_users":len(bot_users),
        "unlinked_legacy_bot_users":len(bot_users)-len(linked_bot_ids),
        "verified_telegram_mappings":len(tg_links),
        "canonical_people_or_unlinked_profiles":len(nodes),
        "verified_identity_rows":len(registry),
        "exact_normalized_full_name_pairs":exact_name_pairs,
        "different_spelling_exact_name_pairs":transliterated_pairs,
        "pairs_sharing_contact_or_telegram_signal":strong_signal_pairs,
        "candidate_pairs":len(candidates),
        "candidate_pairs_truncated":max(0,len(candidates)-60),
        "candidates":candidates[:60],
        "read_only":True,
    }
    return summary


if __name__=="__main__":
    try:
        print(json.dumps(audit(),ensure_ascii=False,sort_keys=True,default=str),flush=True)
    except Exception as exc:
        print("Duplicate-name audit failed: "+type(exc).__name__,file=sys.stderr,flush=True)
        raise SystemExit(1) from None
