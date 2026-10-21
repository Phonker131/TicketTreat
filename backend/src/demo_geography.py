"""Country/city metadata for registered users and organizer events."""
import re
import unicodedata
from fastapi import HTTPException
from sqlalchemy import Column, Integer, String
from db.base import Base

class DemoAccountPlace(Base):
    __tablename__="demo_account_places"
    account_id=Column(Integer,primary_key=True)
    country_code=Column(String(2),nullable=False,index=True)
    city=Column(String(100),nullable=False)

class DemoEventPlace(Base):
    __tablename__="demo_event_places"
    event_id=Column(Integer,primary_key=True)
    country_code=Column(String(2),nullable=False,index=True)
    city=Column(String(100),nullable=False,index=True)

def clean_location(country,city):
    code=(country or "").strip().upper()
    if not re.fullmatch("[A-Z]{2}",code):
        raise HTTPException(status_code=422,detail="country_code_required")
    name=" ".join(unicodedata.normalize("NFKC",city or "").strip().split())
    if not 1<=len(name)<=100 or any(unicodedata.category(c).startswith("C") for c in name):
        raise HTTPException(status_code=422,detail="city_required")
    return code,name

def place_dict(db,model,field,identifier):
    row=db.query(model).filter(getattr(model,field)==identifier).first()
    return {"country_code":row.country_code if row else None,"city":row.city if row else None}

def save_place(db,model,field,identifier,country,city):
    country,city=clean_location(country,city)
    row=db.query(model).filter(getattr(model,field)==identifier).first()
    if row is None:
        row=model(**{field:identifier,"country_code":country,"city":city})
        db.add(row)
    else:
        row.country_code,row.city=country,city
