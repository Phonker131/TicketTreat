"""Device uploads persist and enforce organizer ownership; disposable DB only."""
import os
import secrets
import unittest
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
if not os.getenv('DATABASE_URL','').endswith('/tickettreat_ci'):
    raise RuntimeError('Disposable database required')
import main
from db.session import SessionLocal
from demo_roles import EventOwnership
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
from demo_broadcast import BroadcastImage

IMAGE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII='

class DeviceImages(unittest.TestCase):
    def test_stored_broadcast_image_and_standalone_poster(self):
        with SessionLocal() as db:
            owner,_,pw,auth=account_with_session(db,'organizer')
            other,_,other_pw,other_auth=account_with_session(db,'organizer')
            _,_,_,guest_auth=account_with_session(db)
            ev=main.Event(title='Image regression '+secrets.token_hex(4),starts_at=datetime.now()+timedelta(days=9),price=Decimal('0'),currency='CZK',max_participants=10,is_cancelled=False)
            db.add(ev);db.flush();eid=ev.id
            db.add(EventOwnership(event_id=eid,owner_account_id=owner.id));db.commit()
        with TestClient(main.app) as client:
            enroll_mfa(client,auth,pw);enroll_mfa(client,other_auth,other_pw)
            path='/api/v1/manage/broadcast-images'
            payload={'scope':'event','event_id':eid,'data_url':IMAGE}
            self.assertEqual(client.post(path,json=payload).status_code,401)
            self.assertEqual(client.post(path,headers=guest_auth,json=payload).status_code,403)
            self.assertEqual(client.post(path,headers=other_auth,json=payload).status_code,403)
            self.assertEqual(client.post(path,headers=auth,json={**payload,'data_url':'data:text/html;base64,YQ=='}).status_code,422)
            response=client.post(path,headers=auth,json=payload)
            self.assertEqual(response.status_code,201,response.text)
            token=response.json()['url'].rsplit('/',1)[1]
            image=client.get('/api/v1/public/broadcast-images/'+token)
            self.assertEqual(image.status_code,200)
            self.assertEqual(image.headers['content-type'],'image/png')
            with SessionLocal() as db:
                self.assertEqual(db.get(BroadcastImage,token).image_bytes,image.content)
            # Poster-only changes do not require unrelated event fields.
            edit=client.patch(f'/api/v1/manage/events/{eid}',headers=auth,json={'poster_data_url':IMAGE})
            self.assertEqual(edit.status_code,200,edit.text)
            saved=client.get(f'/api/v1/manage/events/{eid}',headers=auth)
            self.assertEqual(saved.status_code,200,saved.text)
            self.assertEqual(saved.json()['image_url'],edit.json()['image_url'])
            self.assertIn('?v=',saved.json()['image_url'])
            poster=client.get(f'/api/v1/events/{eid}/poster',headers=auth)
            self.assertEqual(poster.status_code,200,poster.text)
            self.assertEqual(poster.content,image.content)
