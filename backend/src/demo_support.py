"""Account-bound support tickets with global-admin inbox and Resend replies.

The browser never chooses the ticket owner, reply recipient or sender role.
All email is queued in the existing transactional outbox and retried by the
existing single Demo API mail worker.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func, and_, or_
from sqlalchemy.orm import Session
from db.base import Base

CATEGORIES={"account","tickets","event","technical","complaint","other"}

def now():
    return datetime.now(timezone.utc)

def utc(dt):
    if dt is None:return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

class SupportTicket(Base):
    __tablename__="demo_support_tickets"
    id=Column(Integer,primary_key=True)
    account_id=Column(Integer,ForeignKey("demo_web_accounts.id"),nullable=False,index=True)
    category=Column(String(24),nullable=False)
    subject=Column(String(160),nullable=False)
    status=Column(String(20),nullable=False,default="open",index=True)
    created_at=Column(DateTime(timezone=True),nullable=False,default=now)
    updated_at=Column(DateTime(timezone=True),nullable=False,default=now)
    last_customer_at=Column(DateTime(timezone=True),nullable=False,default=now)

class SupportMessage(Base):
    __tablename__="demo_support_messages"
    id=Column(Integer,primary_key=True)
    ticket_id=Column(Integer,ForeignKey("demo_support_tickets.id"),nullable=False,index=True)
    author_account_id=Column(Integer,nullable=False)
    author_role=Column(String(12),nullable=False)
    body=Column(Text,nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,default=now)

class SupportAdminRead(Base):
    __tablename__="demo_support_admin_reads"
    ticket_id=Column(Integer,ForeignKey("demo_support_tickets.id"),primary_key=True)
    admin_account_id=Column(Integer,primary_key=True)
    last_seen_at=Column(DateTime(timezone=True),nullable=False)

class SupportNew(BaseModel):
    category:str=Field(default="other",max_length=24)
    subject:str=Field(min_length=4,max_length=160)
    body:str=Field(min_length=15,max_length=5000)

class SupportReply(BaseModel):
    body:str=Field(min_length=2,max_length=5000)

def serialized_message(db,row):
    value={"id":row.id,"role":row.author_role,"body":row.body,
           "created_at":utc(row.created_at).isoformat()}
    if row.author_role=="admin":
        from demo_email import EmailOutbox
        delivery=db.query(EmailOutbox.state).filter(
            EmailOutbox.kind=="support_reply",EmailOutbox.notice_id==row.id).first()
        value["email_status"]=delivery[0] if delivery else "not_queued"
    return value

def serialized_ticket(db,t,admin=False,read=None):
    result={"id":t.id,"subject":t.subject,"category":t.category,
            "status":t.status,"created_at":utc(t.created_at).isoformat(),
            "updated_at":utc(t.updated_at).isoformat(),
            "last_customer_at":utc(t.last_customer_at).isoformat()}
    if admin:
        from demo_accounts import WebAccount
        acc=db.get(WebAccount,t.account_id)
        result["customer"]={"name":f"{acc.first_name} {acc.last_name}".strip(),
                            "email":acc.email} if acc else {"name":"Deleted account","email":None}
        result["unread"]=read is None or utc(read.last_seen_at)<utc(t.last_customer_at)
    return result

def rate_limit(db,account_id,for_new):
    # Rate limiting is enforced by durable, server-owned history (no IP headers).
    current=now()
    if for_new:
        count=db.query(func.count(SupportTicket.id)).filter(
            SupportTicket.account_id==account_id,
            SupportTicket.created_at>=current-timedelta(days=1)).scalar() or 0
        latest=db.query(SupportTicket.created_at).filter(
            SupportTicket.account_id==account_id).order_by(SupportTicket.created_at.desc()).first()
        if count>=5 or (latest and utc(latest[0])>current-timedelta(seconds=60)):
            raise HTTPException(429,"support_rate_limit")
    else:
        count=db.query(func.count(SupportMessage.id)).filter(
            SupportMessage.author_account_id==account_id,
            SupportMessage.author_role=="customer",
            SupportMessage.created_at>=current-timedelta(days=1)).scalar() or 0
        latest=db.query(SupportMessage.created_at).filter(
            SupportMessage.author_account_id==account_id,
            SupportMessage.author_role=="customer").order_by(SupportMessage.created_at.desc()).first()
        if count>=30 or (latest and utc(latest[0])>current-timedelta(seconds=20)):
            raise HTTPException(429,"support_rate_limit")

def global_admin(db,account,session):
    from demo_roles import role_for
    from demo_mfa import require_privileged_mfa
    if role_for(db,account)!="global_admin":
        raise HTTPException(403,"global_admin_only")
    require_privileged_mfa(db,account,session)
    return account

def unread_query(db,admin_id):
    return (db.query(func.count(SupportTicket.id))
        .outerjoin(SupportAdminRead,and_(
            SupportAdminRead.ticket_id==SupportTicket.id,
            SupportAdminRead.admin_account_id==admin_id))
        .filter(or_(SupportAdminRead.ticket_id.is_(None),
                    SupportAdminRead.last_seen_at<SupportTicket.last_customer_at)))

def install_support_api(app,get_db):
    from demo_mfa import session_for
    from demo_account_recovery import email_is_verified
    from demo_roles import role_for
    from demo_accounts import WebAccount
    from demo_email import configured, queue_email

    def signed_in(authorization:str|None=Header(default=None),db:Session=Depends(get_db)):
        account,session=session_for(db,authorization)
        return account,session

    def support_user(identity=Depends(signed_in),db:Session=Depends(get_db)):
        account,_=identity
        if not email_is_verified(db,account.id):
            raise HTTPException(403,"email_verification_required")
        return account

    def staff(identity=Depends(signed_in),db:Session=Depends(get_db)):
        account,session=identity
        return global_admin(db,account,session)

    def owned(db,id,account):
        ticket=db.query(SupportTicket).filter(
            SupportTicket.id==id,SupportTicket.account_id==account.id).first()
        if ticket is None:raise HTTPException(404,"support_ticket_not_found")
        return ticket

    def customer_detail(db,t):
        rows=db.query(SupportMessage).filter(
            SupportMessage.ticket_id==t.id).order_by(SupportMessage.id).all()
        return {"ticket":serialized_ticket(db,t),
                "messages":[serialized_message(db,m) for m in rows]}

    @app.post("/demo/support/tickets",status_code=201)
    def create_ticket(payload:SupportNew,account=Depends(support_user),db:Session=Depends(get_db)):
        subject=payload.subject.strip()
        body=payload.body.strip()
        if payload.category not in CATEGORIES or len(subject)<4 or len(body)<15:
            raise HTTPException(422,"support_invalid_content")
        rate_limit(db,account.id,True)
        ticket=SupportTicket(account_id=account.id,category=payload.category,subject=subject,
                             status="open",created_at=now(),updated_at=now(),last_customer_at=now())
        db.add(ticket);db.flush()
        db.add(SupportMessage(ticket_id=ticket.id,author_account_id=account.id,
                              author_role="customer",body=body,created_at=now()))
        db.commit()
        return {"id":ticket.id,"status":"open"}

    @app.get("/demo/support/tickets")
    def my_tickets(account=Depends(support_user),db:Session=Depends(get_db)):
        tickets=db.query(SupportTicket).filter(SupportTicket.account_id==account.id).order_by(
            SupportTicket.updated_at.desc()).limit(100).all()
        return {"tickets":[serialized_ticket(db,t) for t in tickets]}

    @app.get("/demo/support/tickets/{ticket_id}")
    def my_ticket(ticket_id:int,account=Depends(support_user),db:Session=Depends(get_db)):
        return customer_detail(db,owned(db,ticket_id,account))

    @app.post("/demo/support/tickets/{ticket_id}/messages",status_code=201)
    def customer_reply(ticket_id:int,payload:SupportReply,account=Depends(support_user),
                       db:Session=Depends(get_db)):
        t=owned(db,ticket_id,account)
        if t.status=="closed":raise HTTPException(409,"support_ticket_closed")
        body=payload.body.strip()
        if len(body)<2:raise HTTPException(422,"support_invalid_content")
        rate_limit(db,account.id,False)
        t.status="open"
        t.updated_at=t.last_customer_at=now()
        msg=SupportMessage(ticket_id=t.id,author_account_id=account.id,
                           author_role="customer",body=body,created_at=now())
        db.add(msg);db.commit()
        return {"status":"open"}

    @app.get("/demo/manage/support/summary")
    def support_summary(admin=Depends(staff),db:Session=Depends(get_db)):
        return {"unread":int(unread_query(db,admin.id).scalar() or 0),
                "open":int(db.query(func.count(SupportTicket.id)).filter(SupportTicket.status=="open").scalar() or 0),
                "answered":int(db.query(func.count(SupportTicket.id)).filter(SupportTicket.status=="answered").scalar() or 0)}

    @app.get("/demo/manage/support/tickets")
    def staff_tickets(status:str="all",admin=Depends(staff),db:Session=Depends(get_db)):
        if status not in {"all","open","answered","closed"}:
            raise HTTPException(422,"invalid_support_filter")
        q=db.query(SupportTicket)
        if status!="all":q=q.filter(SupportTicket.status==status)
        rows=q.order_by(SupportTicket.updated_at.desc()).limit(200).all()
        reads={r.ticket_id:r for r in db.query(SupportAdminRead).filter(
            SupportAdminRead.admin_account_id==admin.id,
            SupportAdminRead.ticket_id.in_([t.id for t in rows])).all()} if rows else {}
        return {"tickets":[serialized_ticket(db,t,admin=True,read=reads.get(t.id)) for t in rows]}

    @app.get("/demo/manage/support/tickets/{ticket_id}")
    def staff_ticket(ticket_id:int,admin=Depends(staff),db:Session=Depends(get_db)):
        t=db.get(SupportTicket,ticket_id)
        if t is None:raise HTTPException(404,"support_ticket_not_found")
        record=db.get(SupportAdminRead,(t.id,admin.id))
        result={"ticket":serialized_ticket(db,t,admin=True,read=record),
                "messages":[serialized_message(db,m) for m in db.query(SupportMessage).filter(
                    SupportMessage.ticket_id==t.id).order_by(SupportMessage.id).all()]}
        return result

    @app.post("/demo/manage/support/tickets/{ticket_id}/read")
    def staff_mark_read(ticket_id:int,admin=Depends(staff),db:Session=Depends(get_db)):
        t=db.get(SupportTicket,ticket_id)
        if t is None:raise HTTPException(404,"support_ticket_not_found")
        read=db.get(SupportAdminRead,(t.id,admin.id))
        if read is None:
            read=SupportAdminRead(ticket_id=t.id,admin_account_id=admin.id,
                                  last_seen_at=utc(t.last_customer_at))
            db.add(read)
        else:
            read.last_seen_at=utc(t.last_customer_at)
        db.commit()
        return {"status":"read"}

    @app.post("/demo/manage/support/tickets/{ticket_id}/reply",status_code=201)
    def staff_reply(ticket_id:int,payload:SupportReply,admin=Depends(staff),
                    db:Session=Depends(get_db)):
        body=payload.body.strip()
        if len(body)<2:raise HTTPException(422,"support_invalid_content")
        if not configured():
            raise HTTPException(503,"support_email_not_configured")
        t=db.query(SupportTicket).filter(SupportTicket.id==ticket_id).with_for_update().first()
        if t is None:raise HTTPException(404,"support_ticket_not_found")
        if t.status=="closed":raise HTTPException(409,"support_ticket_closed")
        owner=db.get(WebAccount,t.account_id)
        if owner is None or not email_is_verified(db,owner.id):
            raise HTTPException(409,"support_recipient_unverified")
        msg=SupportMessage(ticket_id=t.id,author_account_id=admin.id,
                           author_role="admin",body=body,created_at=now())
        db.add(msg);db.flush()
        queue_email(db,kind="support_reply",event_key=f"support:reply:{msg.id}",
                    recipient=owner.email,notice_id=msg.id)
        t.status="answered";t.updated_at=now()
        db.commit()
        return {"id":msg.id,"status":"answered","email_status":"queued"}

    @app.post("/demo/manage/support/tickets/{ticket_id}/close")
    def staff_close(ticket_id:int,admin=Depends(staff),db:Session=Depends(get_db)):
        t=db.query(SupportTicket).filter(SupportTicket.id==ticket_id).with_for_update().first()
        if t is None:raise HTTPException(404,"support_ticket_not_found")
        t.status="closed";t.updated_at=now();db.commit()
        return {"status":"closed"}
