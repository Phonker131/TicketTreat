"""Read-only account #20 profile and transliteration duplicate candidates."""
import os,json,re,sys
from unidecode import unidecode
from rapidfuzz.fuzz import ratio
import psycopg2
from psycopg2.extras import RealDictCursor

def norm(x):return re.sub(r"[^a-z0-9]", "", unidecode(str(x or "")).lower())
def mask(x):
 if not x:return None
 s=x.strip()
 if "@" in s:
  a,b=s.split("@",1)
  return (a[:2] if len(a)>2 else a[:1])+"***"+(a[-2:] if len(a)>4 else "")+"@"+b
 d=re.sub(r"\D","",s)
 return "***"+d[-3:] if d else None
def query(c,s,*p):c.execute(s,p);return [dict(x) for x in c.fetchall()]
def main():
 url=os.environ["DATABASE_URL"].replace("postgresql+psycopg2://","postgresql://",1)
 conn=psycopg2.connect(url,connect_timeout=15);conn.set_session(readonly=True,autocommit=False)
 try:
  with conn.cursor(cursor_factory=RealDictCursor) as c:
   c.execute("SET TRANSACTION READ ONLY")
   account=query(c,"SELECT id,guest_id,first_name,last_name,email,phone,instagram,contact_preference,created_at FROM demo_web_accounts WHERE id=20")
   if not account:
    print(json.dumps({"exists":False,"id":20}));return
   a=account[0];gid=a["guest_id"]
   guests=query(c,"SELECT id,first_name,last_name,email,username,created_at FROM demo_guests WHERE id=%s",gid)
   verified=query(c,"SELECT verified_at FROM demo_verified_emails WHERE account_id=20")
   providers=query(c,"SELECT provider,verified_at FROM auth_identities WHERE account_id=20 ORDER BY provider")
   roles=query(c,"SELECT role FROM demo_web_account_roles WHERE account_id=20")
   global_admin=query(c,"SELECT count(*) AS n FROM demo_global_admin_bindings WHERE account_id=20")
   ownership=query(c,"SELECT event_id FROM demo_event_ownership WHERE owner_account_id=20")
   tickets=query(c,"SELECT id,event_id,ticket_status,payment_status,checked_in_at FROM demo_tickets WHERE guest_id=%s ORDER BY id",gid)
   wait=query(c,"SELECT count(*) AS n FROM demo_waitlist WHERE guest_id=%s",gid)
   paid=query(c,"SELECT count(*) AS n FROM demo_paid_reservations WHERE guest_id=%s",gid)
   all_other=query(c,"SELECT id,guest_id,first_name,last_name,email,phone,instagram FROM demo_web_accounts WHERE id!=20")
   all_guest=query(c,"SELECT id,first_name,last_name,email FROM demo_guests WHERE id!=%s",gid)
   bot_users=query(c,"SELECT id,first_name,last_name,phone,instagram FROM users")
   session_count=query(c,"SELECT count(*) AS n FROM demo_web_sessions WHERE account_id=20")
  conn.rollback()
 finally:conn.close()
 names=[(a["first_name"],a["last_name"])]
 if guests:names.append((guests[0]["first_name"],guests[0]["last_name"]))
 def similarity(first,last):
  vals=[]
  for f,l in names:
   if not f or not l or not first or not last:continue
   x,y,z,w=map(norm,[f,l,first,last])
   if not all([x,y,z,w]):continue
   vals.append(round((ratio(x,z)+ratio(y,w))/2,1))
  return max(vals) if vals else 0
 matches=[]
 for row in all_other:
  sim=similarity(row["first_name"],row["last_name"])
  sig=[]
  if a["email"] and row["email"] and a["email"].lower()==row["email"].lower():sig.append("same_contact_email")
  if a["phone"] and row["phone"] and re.sub(r"\D","",a["phone"])[-9:]==re.sub(r"\D","",row["phone"])[-9:]:sig.append("same_phone")
  if sim>=76 or sig:matches.append({"type":"web","id":row["id"],"name":" ".join(filter(None,[row["first_name"],row["last_name"]])),"name_similarity":sim,"signals":sig})
 for row in all_guest:
  sim=similarity(row["first_name"],row["last_name"])
  if sim>=88:matches.append({"type":"guest","id":row["id"],"name":" ".join([row["first_name"],row["last_name"]]),"name_similarity":sim,"signals":[]})
 for row in bot_users:
  sim=similarity(row["first_name"],row["last_name"])
  if sim>=88:matches.append({"type":"bot","id":row["id"],"name":" ".join([row["first_name"],row["last_name"]]),"name_similarity":sim,"signals":[]})
 matches.sort(key=lambda x:(-len(x["signals"]),-x["name_similarity"]))
 print(json.dumps({"exists":True,"id":20,"guest_id":gid,
   "name":" ".join(filter(None,[a["first_name"],a["last_name"]])),
   "guest_name":" ".join(filter(None,[guests[0]["first_name"],guests[0]["last_name"]])) if guests else None,
   "email_masked":mask(a["email"]),"email_verified":bool(verified),
   "phone_masked":mask(a["phone"]),"instagram_present":bool(a["instagram"]),
   "contact_preference":a["contact_preference"],
   "registered":a["created_at"].date().isoformat(),
   "provider_types":[r["provider"] for r in providers],
   "role":roles[0]["role"] if roles else "participant",
   "global_admin_binding":bool(global_admin[0]["n"]),
   "owned_event_count":len(ownership),"tickets":[{"id":t["id"],"event_id":t["event_id"],"status":t["ticket_status"],"payment":t["payment_status"],"checked_in":bool(t["checked_in_at"])} for t in tickets],
   "waitlist_entries":wait[0]["n"],"paid_reservations":paid[0]["n"],
   "sessions":session_count[0]["n"],"similar_accounts":matches[:10],
   "readonly":True},ensure_ascii=False,default=str))
if __name__=="__main__":
 try:main()
 except Exception as exc:
  import traceback
  where=traceback.extract_tb(exc.__traceback__)[-1]
  print("Account 20 audit failed:"+type(exc).__name__+" line="+str(where.lineno),file=sys.stderr)
  raise SystemExit(1)
