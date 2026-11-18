"use client";
import type {CSSProperties} from "react";
import type {LanguageCode} from "@/lib/types";
import type {OrganizerTierBenefit} from "@/lib/api";
import {benefitStatus} from "@/lib/loyalty-status";

/** The loyalty levels as the server counts them (backend demo_loyalty.TIERS).
 * Only the waitlist priority works today; the other perks are marked "soon". */
export const LEVELS=[
 {key:"newcomer",at:0,live:true},
 {key:"regular",at:3,live:true},
 {key:"insider",at:6,live:false},
 {key:"vip",at:12,live:false},
] as const;

export const rewardsCopy:Record<LanguageCode,{
 title:string;lead:string;names:[string,string,string,string];at:[string,string,string,string];
 perks:[string,string,string,string];live:string;soon:string;here:string;example:string;
 progress:string;top:string;rules:[string,string,string];rulesTitle:string;signin:string;find:string;
}>={
 ru:{title:"Награды",lead:"Чем чаще вы ходите к одному организатору, тем больше у вас преимуществ.",
  names:["Новичок","Свой","Инсайдер","VIP"],at:["Старт","3 визита","6 визитов","12 визитов"],
  perks:["Билеты и напоминания","Первым в листе ожидания","Запись на 24 часа раньше","+1 гость на ивент"],
  live:"Работает",soon:"Скоро",here:"Вы здесь",example:"Пример",
  progress:"{n} из {next} визитов до уровня «{name}»",top:"Максимальный уровень",
  rulesTitle:"Как считаются визиты",
  rules:["Визит засчитывается, когда на входе сканируют ваш QR. Просто запись не считается.","У каждого организатора свой счёт и свои пороги уровней.","Счёт начинается заново каждый квартал: 1 января, 1 апреля, 1 июля и 1 октября."],
  signin:"Войти",find:"Смотреть ивенты"},
 en:{title:"Rewards",lead:"The more often you go to one organizer's events, the more you get.",
  names:["Newcomer","Regular","Insider","VIP"],at:["Start","3 visits","6 visits","12 visits"],
  perks:["Tickets and reminders","First in line on the waitlist","Book 24 hours earlier","+1 guest per event"],
  live:"Active",soon:"Soon",here:"You are here",example:"Example",
  progress:"{n} of {next} visits to {name}",top:"Top level reached",
  rulesTitle:"How visits count",
  rules:["A visit counts when your QR is scanned at the door. Booking alone does not count.","Each organizer keeps a separate count and sets its own steps.","Counts start over every quarter: 1 January, 1 April, 1 July and 1 October."],
  signin:"Sign in",find:"Explore events"},
 cs:{title:"Odměny",lead:"Čím častěji chodíte na akce jednoho pořadatele, tím víc výhod máte.",
  names:["Nováček","Stálý host","Insider","VIP"],at:["Start","3 návštěvy","6 návštěv","12 návštěv"],
  perks:["Vstupenky a připomínky","Přednost na čekací listině","Registrace o 24 hodin dříve","+1 host na akci"],
  live:"Aktivní",soon:"Brzy",here:"Jste tady",example:"Příklad",
  progress:"{n} z {next} návštěv do úrovně {name}",top:"Nejvyšší úroveň",
  rulesTitle:"Jak se návštěvy počítají",
  rules:["Návštěva se počítá, když vám u vstupu naskenují QR. Samotná registrace se nepočítá.","Každý pořadatel počítá zvlášť a určuje si vlastní hranice úrovní.","Počítání začíná znovu každé čtvrtletí: 1. ledna, 1. dubna, 1. července a 1. října."],
  signin:"Přihlásit se",find:"Zobrazit akce"},
 uk:{title:"Нагороди",lead:"Що частіше ви ходите до одного організатора, то більше у вас переваг.",
  names:["Новачок","Свій","Інсайдер","VIP"],at:["Старт","3 візити","6 візитів","12 візитів"],
  perks:["Квитки й нагадування","Першим у списку очікування","Запис на 24 години раніше","+1 гість на подію"],
  live:"Працює",soon:"Незабаром",here:"Ви тут",example:"Приклад",
  progress:"{n} з {next} візитів до рівня «{name}»",top:"Максимальний рівень",
  rulesTitle:"Як рахуються візити",
  rules:["Візит зараховується, коли на вході сканують ваш QR. Просто запис не рахується.","У кожного організатора свій рахунок і свої пороги рівнів.","Рахунок починається знову щокварталу: 1 січня, 1 квітня, 1 липня і 1 жовтня."],
  signin:"Увійти",find:"Переглянути події"},
};

export function configuredLevels(rewards?:OrganizerTierBenefit[]){return LEVELS.map(l=>({...l,at:rewards?.find(r=>r.tier===l.key)?.required_visits??l.at}));}
export function levelIndex(visits:number,rewards?:OrganizerTierBenefit[]){
 let i=0;configuredLevels(rewards).forEach((l,k)=>{if(visits>=l.at)i=k;});return i;
}
export function progressLine(language:LanguageCode,visits:number,rewards?:OrganizerTierBenefit[]){
 const c=rewardsCopy[language],i=levelIndex(visits,rewards);
 if(i===LEVELS.length-1)return c.top;
 return c.progress.replace("{n}",String(visits)).replace("{next}",String(configuredLevels(rewards)[i+1].at)).replace("{name}",c.names[i+1]);
}
export function levelName(language:LanguageCode,visits:number,rewards?:OrganizerTierBenefit[]){return rewardsCopy[language].names[levelIndex(visits,rewards)];}

/** "3 visits" in the page language. */
export function visitsLabel(n:number,language:LanguageCode){
 const one=n%10===1&&n%100!==11,few=n%10>=2&&n%10<=4&&(n%100<10||n%100>=20);
 if(language==="ru")return n+" "+(one?"визит":few?"визита":"визитов");
 if(language==="uk")return n+" "+(one?"візит":few?"візити":"візитів");
 if(language==="cs")return n+" "+(n===1?"návštěva":n>=2&&n<=4?"návštěvy":"návštěv");
 return n+" "+(n===1?"visit":"visits");
}

/** Four stops on one line: where you are, what each level gives and whether it works yet.
 *  "stack" lays the stops out top to bottom (narrow cards), "small" is the same line in smaller type.
 *  "unknown": the organizer's own visit counts are not known here (guest), so no numbers are shown. */
export function RewardsTrack({language,visits,tierRewards,variant,here=true,unknown=false}:{language:LanguageCode;visits:number;tierRewards?:OrganizerTierBenefit[];variant?:"stack"|"small";here?:boolean;unknown?:boolean}){
 const c=rewardsCopy[language],current=levelIndex(visits,tierRewards),levels=configuredLevels(tierRewards);
 return <ol className={"tt-rt"+(variant?" is-"+variant:"")} aria-label={progressLine(language,visits,tierRewards)}>
  {levels.map((level,i)=>{
   const benefit=tierRewards?.find(item=>item.tier===level.key);
   const status=benefitStatus(benefit,language,level.live);
   const next=levels[i+1];
   const fill=next?Math.max(0,Math.min(1,(visits-level.at)/(next.at-level.at))):0;
   return <li key={level.key} className={"tt-rt-stop"+(i<=current?" is-reached":"")+(i===current?" is-current":"")}
     style={{"--fill":fill} as CSSProperties} aria-current={i===current?"step":undefined}>
    <span className="tt-rt-dot" data-at={unknown?(i===0?"0":""):level.at} aria-hidden="true"/>
    {here&&i===current&&<span className="tt-rt-here">{c.here}</span>}
    <div className="tt-rt-body">
     <small>{i===0?c.at[0]:unknown?" ":visitsLabel(level.at,language)}</small>
     <strong>{c.names[i]}</strong>
     <span>{benefit?(language==="cs"?benefit.label_cs:benefit.label_en):c.perks[i]}</span>
     {benefit&&(language==="cs"?benefit.description_cs:benefit.description_en)&&
       <span className="tt-rt-description">{language==="cs"?benefit.description_cs:benefit.description_en}</span>}
     {i>0&&<em className={["live","manual"].includes(status.kind)?"is-live":"is-soon"}>{status.text}</em>}
    </div>
   </li>;
  })}
 </ol>;
}

export function RewardsRules({language}:{language:LanguageCode}){
 const c=rewardsCopy[language];
 return <div className="tt-rw-rules">
  <h3>{c.rulesTitle}</h3>
  <ol>{c.rules.map((rule,i)=><li key={i}><b aria-hidden="true">{i+1}</b><span>{rule}</span></li>)}</ol>
 </div>;
}
