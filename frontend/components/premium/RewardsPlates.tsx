"use client";
import Link from "next/link";
import type {LanguageCode} from "@/lib/types";
import type {OrganizerRewardsDashboard} from "@/lib/api";
import {LEVELS,RewardsTrack,levelIndex,levelName,progressLine,rewardsCopy} from "@/components/premium/RewardsTrack";
import {studioFor,useMyLoyalty} from "@/components/premium/useMyLoyalty";

const P:Record<LanguageCode,{at:string;guest:string;signin:string;how:string;hint:string;card:string}>={
 ru:{at:"Награды у {name}",guest:"Войдите, и визиты к этому организатору пойдут в зачёт.",signin:"Войти",how:"Как это работает",hint:"Визит засчитается, когда на входе отсканируют ваш QR.",card:"Награды за визиты"},
 en:{at:"Rewards with {name}",guest:"Sign in and your visits to this organizer will count.",signin:"Sign in",how:"How it works",hint:"The visit counts when your QR is scanned at the door.",card:"Rewards for visits"},
 cs:{at:"Odměny u pořadatele {name}",guest:"Přihlaste se a návštěvy u tohoto pořadatele se vám začnou počítat.",signin:"Přihlásit se",how:"Jak to funguje",hint:"Návštěva se započítá po naskenování QR u vstupu.",card:"Odměny za návštěvy"},
 uk:{at:"Нагороди в {name}",guest:"Увійдіть, і візити до цього організатора підуть у залік.",signin:"Увійти",how:"Як це працює",hint:"Візит зарахується, коли на вході відсканують ваш QR.",card:"Нагороди за візити"},
};

/** Event page and organizer page: your level with this organizer, every perk on one scale. */
export function RewardsPlate({organizer,title,language}:{organizer:string|null|undefined;title?:string;language:LanguageCode}){
 const {passport,state}=useMyLoyalty(),p=P[language];
 if(!organizer)return null;
 const studio=studioFor(passport,organizer),visits=studio?.season_visits??0,signed=state==="ready";
 const heading=p.at.replace("{name}",title||organizer);
 return <section className="tt-rw-plate" aria-label={heading}>
  <div className="tt-rw-plate-head">
   <div>
    <h2>{heading}</h2>
    <p className="tt-rw-progress">{state==="loading"?" ":signed?progressLine(language,visits):p.guest}</p>
   </div>
   {signed&&<strong className={"tt-rw-plate-level is-"+LEVELS[levelIndex(visits)].key}>{levelName(language,visits)}</strong>}
  </div>
  <RewardsTrack language={language} visits={visits} variant="small" here={signed}/>
  <div className="tt-rw-plate-foot">
   <span>{signed?p.hint:""}</span>
   {state==="guest"&&<Link href="/login" className="button button-primary">{p.signin}</Link>}
   <Link href="/loyalty" className="tt-rw-plate-link">{p.how}</Link>
  </div>
 </section>;
}

/** Inside an organizer card on /organizers: the same four levels, top to bottom, plus your progress there. */
export function OrganizerRewardsNote({name,language}:{name:string;language:LanguageCode}){
 const {passport}=useMyLoyalty(),studio=studioFor(passport,name);
 return <div className="tt-rw-note">
  <p className="tt-rw-note-h">{P[language].card}</p>
  {studio&&<p className="tt-rw-note-progress">{progressLine(language,studio.season_visits)}</p>}
  <RewardsTrack language={language} visits={studio?.season_visits??0} variant="stack" here={!!studio}/>
 </div>;
}

const G:Record<LanguageCode,{title:string;lead:string;guests:string}>={
 ru:{title:"Уровни ваших гостей",lead:"Пороги одинаковые у всех организаторов: 3, 6 и 12 визитов за квартал. Визит засчитывается только по скану QR на входе.",guests:"гостей"},
 en:{title:"Your guests by level",lead:"The steps are the same for every organizer: 3, 6 and 12 visits per quarter. A visit counts only when the QR is scanned at the door.",guests:"guests"},
 cs:{title:"Vaši hosté podle úrovní",lead:"Hranice jsou stejné u všech pořadatelů: 3, 6 a 12 návštěv za čtvrtletí. Návštěva se počítá jen po naskenování QR u vstupu.",guests:"hostů"},
 uk:{title:"Рівні ваших гостей",lead:"Пороги однакові в усіх організаторів: 3, 6 і 12 візитів за квартал. Візит зараховується лише після скану QR на вході.",guests:"гостей"},
};

/** Organizer dashboard: how many of your guests sit on each level this quarter (from verified check-ins). */
export function GuestLevels({attendees,language}:{attendees:OrganizerRewardsDashboard["attendees"];language:LanguageCode}){
 const g=G[language],c=rewardsCopy[language];
 const now=new Date(),start=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).getTime();
 const visits=new Map<string,Set<number>>();
 for(const a of attendees){
  if(new Date(a.checked_in_at).getTime()<start)continue;
  const key=a.owner_account_id+":"+a.guest_id;
  if(!visits.has(key))visits.set(key,new Set());
  visits.get(key)!.add(a.event_id);
 }
 const counts=[0,0,0,0];
 visits.forEach(events=>{counts[levelIndex(events.size)]++;});
 return <section className="panel tt-guest-levels">
  <h2>{g.title}</h2>
  <p className="form-note">{g.lead}</p>
  <ol>{LEVELS.map((level,i)=><li key={level.key} className={"is-"+level.key}>
   <small>{c.at[i]}</small>
   <strong>{c.names[i]}</strong>
   <span>{c.perks[i]}</span>
   {i>0&&<em className={level.live?"is-live":"is-soon"}>{level.live?c.live:c.soon}</em>}
   <b>{counts[i]}<i>{g.guests}</i></b>
  </li>)}</ol>
 </section>;
}
