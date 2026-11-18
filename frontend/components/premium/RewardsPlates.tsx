"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import type {LanguageCode} from "@/lib/types";
import {getOrganizerRewards,type OrganizerRewardsDashboard,type OrganizerTierBenefit} from "@/lib/api";
import {LEVELS,RewardsTrack,configuredLevels,levelIndex,levelName,progressLine,rewardsCopy,visitsLabel} from "@/components/premium/RewardsTrack";
import {studioFor,useMyLoyalty} from "@/components/premium/useMyLoyalty";

const P:Record<LanguageCode,{at:string;guest:string;fresh:string;signin:string;how:string;hint:string;card:string}>={
 ru:{at:"Награды у {name}",guest:"Войдите, и визиты к этому организатору пойдут в зачёт. Сколько визитов нужно на каждый уровень, решает организатор.",fresh:"Сколько визитов нужно на каждый уровень, решает организатор. После первого визита здесь появится ваша шкала.",signin:"Войти",how:"Как это работает",hint:"Визит засчитается, когда на входе отсканируют ваш QR.",card:"Награды за визиты"},
 en:{at:"Rewards with {name}",guest:"Sign in and your visits to this organizer will count. The organizer decides how many visits each level needs.",fresh:"The organizer decides how many visits each level needs. Your own scale appears here after your first visit.",signin:"Sign in",how:"How it works",hint:"The visit counts when your QR is scanned at the door.",card:"Rewards for visits"},
 cs:{at:"Odměny u pořadatele {name}",guest:"Přihlaste se a návštěvy u tohoto pořadatele se vám začnou počítat. Kolik návštěv potřebuje každá úroveň, určuje pořadatel.",fresh:"Kolik návštěv potřebuje každá úroveň, určuje pořadatel. Po první návštěvě se tu objeví vaše škála.",signin:"Přihlásit se",how:"Jak to funguje",hint:"Návštěva se započítá po naskenování QR u vstupu.",card:"Odměny za návštěvy"},
 uk:{at:"Нагороди в {name}",guest:"Увійдіть, і візити до цього організатора підуть у залік. Скільки візитів потрібно на кожен рівень, вирішує організатор.",fresh:"Скільки візитів потрібно на кожен рівень, вирішує організатор. Після першого візиту тут з'явиться ваша шкала.",signin:"Увійти",how:"Як це працює",hint:"Візит зарахується, коли на вході відсканують ваш QR.",card:"Нагороди за візити"},
};

/** Event page and organizer page: your level with this organizer and every perk on one scale.
 *  The steps are the organizer's own (tier_rewards); without a visit there yet they are not known, so no numbers. */
export function RewardsPlate({organizer,title,language}:{organizer:string|null|undefined;title?:string;language:LanguageCode}){
 const {passport,state}=useMyLoyalty(),p=P[language];
 if(!organizer)return null;
 const studio=studioFor(passport,organizer),visits=studio?.season_visits??0,rewards=studio?.tier_rewards,signed=state==="ready";
 const heading=p.at.replace("{name}",title||organizer);
 return <section className="tt-rw-plate" aria-label={heading}>
  <div className="tt-rw-plate-head">
   <div>
    <h2>{heading}</h2>
    <p className="tt-rw-progress">{state==="loading"?" ":studio?progressLine(language,visits,rewards):signed?p.fresh:p.guest}</p>
   </div>
   {studio&&<strong className={"tt-rw-plate-level is-"+LEVELS[levelIndex(visits,rewards)].key}>{levelName(language,visits,rewards)}</strong>}
  </div>
  <RewardsTrack language={language} visits={visits} tierRewards={rewards} variant="small" here={!!studio} unknown={!studio}/>
  <div className="tt-rw-plate-foot">
   <span>{signed?p.hint:""}</span>
   {state==="guest"&&<Link href="/login" className="button button-primary">{p.signin}</Link>}
   <Link href="/loyalty" className="tt-rw-plate-link">{p.how}</Link>
  </div>
 </section>;
}

/** Inside an organizer card on /organizers: the four levels top to bottom, plus your progress there. */
export function OrganizerRewardsNote({name,language}:{name:string;language:LanguageCode}){
 const {passport}=useMyLoyalty(),studio=studioFor(passport,name);
 return <div className="tt-rw-note">
  <p className="tt-rw-note-h">{P[language].card}</p>
  {studio&&<p className="tt-rw-note-progress">{progressLine(language,studio.season_visits,studio.tier_rewards)}</p>}
  <RewardsTrack language={language} visits={studio?.season_visits??0} tierRewards={studio?.tier_rewards} variant="stack" here={!!studio} unknown={!studio}/>
 </div>;
}

const G:Record<LanguageCode,{title:string;lead:string;guests:string}>={
 ru:{title:"Уровни ваших гостей",lead:"Сколько гостей сейчас на каждом уровне при ваших порогах. Считаются визиты этого квартала, подтверждённые сканом QR на входе.",guests:"гостей"},
 en:{title:"Your guests by level",lead:"How many guests sit on each level with your current steps. Only this quarter's visits confirmed by a QR scan at the door count.",guests:"guests"},
 cs:{title:"Vaši hosté podle úrovní",lead:"Kolik hostů je teď na každé úrovni podle vašich hranic. Počítají se návštěvy tohoto čtvrtletí potvrzené QR u vstupu.",guests:"hostů"},
 uk:{title:"Рівні ваших гостей",lead:"Скільки гостей зараз на кожному рівні за вашими порогами. Рахуються візити цього кварталу, підтверджені скануванням QR на вході.",guests:"гостей"},
};

function perkLabel(language:LanguageCode,i:number,tiers?:OrganizerTierBenefit[]){
 const b=tiers?.find(t=>t.tier===LEVELS[i].key);
 return b?(language==="cs"?b.label_cs:b.label_en):rewardsCopy[language].perks[i];
}

/** Organizer loyalty page: how many guests are on each level this quarter, with this organizer's steps. */
export function GuestLevels({ownerId,tiers,language}:{ownerId:number;tiers?:OrganizerTierBenefit[];language:LanguageCode}){
 const g=G[language],c=rewardsCopy[language],levels=configuredLevels(tiers);
 const [attendees,setAttendees]=useState<OrganizerRewardsDashboard["attendees"]|null>(null);
 useEffect(()=>{let live=true;getOrganizerRewards().then(d=>{if(live)setAttendees(d.attendees)}).catch(()=>{if(live)setAttendees([])});return()=>{live=false};},[]);
 const now=new Date(),start=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).getTime();
 const visits=new Map<number,Set<number>>();
 for(const a of attendees||[]){
  if(a.owner_account_id!==ownerId||new Date(a.checked_in_at).getTime()<start)continue;
  if(!visits.has(a.guest_id))visits.set(a.guest_id,new Set());
  visits.get(a.guest_id)!.add(a.event_id);
 }
 const counts=[0,0,0,0];
 visits.forEach(events=>{counts[levelIndex(events.size,tiers)]++;});
 return <section className="panel tt-guest-levels">
  <h2>{g.title}</h2>
  <p className="form-note">{g.lead}</p>
  <ol>{levels.map((level,i)=>{
   const b=tiers?.find(t=>t.tier===level.key),live=b?b.enabled&&b.operational:level.live;
   return <li key={level.key} className={"is-"+level.key}>
    <small>{i===0?c.at[0]:visitsLabel(level.at,language)}</small>
    <strong>{c.names[i]}</strong>
    <span>{perkLabel(language,i,tiers)}</span>
    {i>0&&<em className={live?"is-live":"is-soon"}>{live?c.live:c.soon}</em>}
    <b>{attendees===null?"…":counts[i]}<i>{g.guests}</i></b>
   </li>;})}</ol>
 </section>;
}
