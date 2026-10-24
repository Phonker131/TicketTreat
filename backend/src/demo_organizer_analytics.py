"""Owner-scoped organizer overview. Only aggregate operational data, no PII.

QR analytics cover TicketTreat tickets only; legacy Telegram registrations
contribute to capacity but have no attributable source or QR check-in data.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import Depends, Header
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from demo_roles import EventOwnership, account_lookup, ensure_manage, role_for
from demo_publication import state as publication_state
from demo_legacy import LegacyTicketClaim
from demo_paid_reservations import PaidReservation
from demo_waitlist_offers import offer_count


def percentage(num: int, denom: int | None) -> float | None:
    if not denom or denom <= 0:
        return None
    return round(num * 100 / denom, 1)


def aggregate_organizer(db: Session, main, account) -> dict:
    role=ensure_manage(db,account)
    # Read ONLY events in the organizer's tenancy. Admin has a separate
    # cross-tenant operational role; cap its overview for bounded queries.
    query=db.query(main.Event)
    if role!="global_admin":
        query=query.join(EventOwnership, EventOwnership.event_id==main.Event.id).filter(
            EventOwnership.owner_account_id==account.id)
    rows=query.order_by(main.Event.id.desc()).limit(201).all()
    truncated=len(rows)>200
    events=rows[:200]
    ids=[e.id for e in events]
    if not ids:
        return {"events":[],"summary":{"events":0,"upcoming":0,"completed":0,
                "capacity":0,"reserved_places":0,"active_qr":0,"checked_in_qr":0,
                "waitlist":0,"pending_payment":0,"pending_payment_24h":0,
                "cancelled_tickets":0,"occupancy_percent":None,
                "qr_checkin_percent":None},
                "channels":[],"daily_bookings":[],"truncated":False,
                "limitations":["Only selected owned events are included; ticket and check-in figures exclude legacy Telegram attendees."]}

    # Grouped aggregates run in Postgres; never load participant rows or tokens.
    tickets=db.query(
        main.DemoTicket.event_id,
        func.count(main.DemoTicket.id).filter(main.DemoTicket.ticket_status=="active"),
        func.count(main.DemoTicket.id).filter(
            main.DemoTicket.ticket_status=="active",
            main.DemoTicket.checked_in_at.is_not(None)),
        func.count(main.DemoTicket.id).filter(main.DemoTicket.ticket_status=="cancelled"),
    ).filter(main.DemoTicket.event_id.in_(ids)).group_by(main.DemoTicket.event_id).all()
    tickets_by={eid:(int(active),int(checked),int(cancelled))
                for eid,active,checked,cancelled in tickets}

    legacy=db.query(main.Registration.event_id,func.count(main.Registration.id)).filter(
        main.Registration.event_id.in_(ids),
        ~main.Registration.id.in_(db.query(LegacyTicketClaim.registration_id))
    ).group_by(main.Registration.event_id).all()
    legacy_by={eid:int(count) for eid,count in legacy}

    wait=db.query(main.DemoWaitlist.event_id,func.count(main.DemoWaitlist.id)).filter(
        main.DemoWaitlist.event_id.in_(ids),
        main.DemoWaitlist.status=="waiting"
    ).group_by(main.DemoWaitlist.event_id).all()
    wait_by={eid:int(count) for eid,count in wait}

    now=datetime.now(timezone.utc)
    soon=now+timedelta(hours=24)
    pending=db.query(
        PaidReservation.event_id,
        func.count(PaidReservation.id),
        func.count(PaidReservation.id).filter(PaidReservation.expires_at<=soon),
    ).filter(PaidReservation.event_id.in_(ids),
             PaidReservation.status=="pending",
             PaidReservation.expires_at>now).group_by(PaidReservation.event_id).all()
    pending_by={eid:(int(count),int(expiring)) for eid,count,expiring in pending}

    source_rows=db.query(main.DemoTicket.acquisition_source,func.count(main.DemoTicket.id)).filter(
        main.DemoTicket.event_id.in_(ids),
        main.DemoTicket.ticket_status=="active").group_by(main.DemoTicket.acquisition_source).all()
    sources=sorted(({"source":source or "direct","registrations":int(count)}
                   for source,count in source_rows),key=lambda x:-x["registrations"])

    recent_day=func.date(main.DemoTicket.created_at)
    cutoff=now-timedelta(days=29)
    days=db.query(recent_day,func.count(main.DemoTicket.id)).filter(
        main.DemoTicket.event_id.in_(ids),
        main.DemoTicket.ticket_status=="active",
        main.DemoTicket.created_at>=cutoff).group_by(recent_day).order_by(recent_day.asc()).all()

    counters=defaultdict(int)
    result=[]
    for event in events:
        active,checked,cancelled=tickets_by.get(event.id,(0,0,0))
        legacy_count=legacy_by.get(event.id,0)
        waiting=wait_by.get(event.id,0)
        holds,expiring=pending_by.get(event.id,(0,0))
        reserved=active+legacy_count+holds
        end_time=None
        if event.starts_at:
            from demo_pilot_ops import effective_settings
            end_time=main.normalize_event_datetime(event.starts_at)+timedelta(
                minutes=effective_settings(db,event.id)["event_duration_minutes"])
        finished=bool(end_time and end_time.astimezone(timezone.utc)<=now)
        upcoming=bool(event.starts_at and
                      main.normalize_event_datetime(event.starts_at).astimezone(timezone.utc)>now
                      and not event.is_cancelled)
        entry={
            "event_id":event.id,"title":event.title,"starts_at":event.starts_at.isoformat() if event.starts_at else None,
            "capacity":event.max_participants,"reserved_places":reserved,
            "occupancy_percent":percentage(reserved,event.max_participants),
            "available_places":max(0,event.max_participants-reserved) if event.max_participants is not None else None,
            "active_qr":active,"checked_in_qr":checked,
            "qr_checkin_percent":percentage(checked,active) if finished else None,
            "legacy_registrations":legacy_count,"waitlist":waiting,
            "pending_payment":holds,"pending_payment_24h":expiring,
            "cancelled_tickets":cancelled,"event_finished":finished,
            "upcoming":upcoming,"is_cancelled":bool(event.is_cancelled),
            "publication":publication_state(db,event.id)["status"],
        }
        result.append(entry)
        counters["reserved_places"]+=reserved
        counters["active_qr"]+=active
        counters["checked_in_qr"]+=checked
        counters["waitlist"]+=waiting
        counters["pending_payment"]+=holds
        counters["pending_payment_24h"]+=expiring
        counters["cancelled_tickets"]+=cancelled
        counters["legacy_registrations"]+=legacy_count
        counters["events"]+=1
        if upcoming:
            counters["upcoming"]+=1
        if finished:
            counters["completed"]+=1
        if event.max_participants is not None and not event.is_cancelled:
            counters["capacity"]+=event.max_participants
            counters["reserved_known_capacity"]+=reserved
    summary={key:int(counters[key]) for key in (
        "events","upcoming","completed","capacity","reserved_places",
        "active_qr","checked_in_qr","waitlist","pending_payment",
        "pending_payment_24h","cancelled_tickets","legacy_registrations")}
    summary["occupancy_percent"]=percentage(counters["reserved_known_capacity"],counters["capacity"])
    summary["qr_checkin_percent"]=percentage(counters["checked_in_qr"],counters["active_qr"])
    return {
        "summary":summary,"events":result,"truncated":truncated,
        "channels":sources,
        "daily_bookings":[{"date":str(day),"count":int(count)} for day,count in days],
        "limitations":[
            "Reserved places include active TicketTreat tickets, unclaimed legacy Telegram registrations and unexpired manual-payment holds.",
            "QR check-ins, channels and daily trends cover active TicketTreat tickets only.",
            "An organizer-admin view can be limited to the most recent 200 events; no raw attendee details are included.",
            "Amounts are not revenue: TicketTreat does not process organizer-direct payments."
        ]
    }


def install_organizer_analytics(app,get_db,main):
    @app.get("/demo/manage/analytics/overview")
    def overview(authorization:str|None=Header(default=None),
                 db:Session=Depends(get_db)):
        return aggregate_organizer(db,main,account_lookup(db,authorization))
