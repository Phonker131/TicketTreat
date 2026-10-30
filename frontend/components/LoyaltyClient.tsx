"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getMyLoyalty,type LoyaltyPassport,type LoyaltyStudio} from "@/lib/api";
import {restoreGuest} from "@/lib/session";
import type {LanguageCode} from "@/lib/types";

const copy = {
 ru:{title:"Паспорт гостя",subtitle:"Посещай ивенты, собирай штампы и открывай награды",total:"Всего посещений",season:"Сезон",until:"До нового уровня",top:"Высший уровень",perks:"Твои бонусы",ready:"Доступно",planned:"Скоро",priority:"Приоритет в листе ожидания",early:"Ранняя запись на 24 часа",companion:"VIP: +1 гость",empty:"Паспорт появится после записи к организатору",signin:"Войди на сайте или открой Telegram Mini App",detail:"Штампы начисляются после подтверждённого check-in, а не за запись. Пока уровни считаются отдельно для каждого организатора в пределах календарного квартала."},
 en:{title:"Guest passport",subtitle:"Attend events, earn stamps and unlock benefits",total:"Lifetime visits",season:"Season",until:"To next tier",top:"Top tier unlocked",perks:"Your benefits",ready:"Active",planned:"Coming soon",priority:"Priority on the waitlist",early:"Booking 24 hours earlier",companion:"VIP: extra guest",empty:"Your passport will appear when you book an organizer's event",signin:"Sign in or open the Telegram Mini App",detail:"Stamps are awarded only after confirmed check-in, not booking. Each organizer has a separate quarterly loyalty passport."},
 cs:{title:"Pas hosta",subtitle:"Navštěvuj akce, sbírej razítka a získej výhody",total:"Celkem návštěv",season:"Sezóna",until:"Do další úrovně",top:"Nejvyšší úroveň",perks:"Tvoje výhody",ready:"Aktivní",planned:"Připravuje se",priority:"Přednost na čekací listině",early:"Registrace o 24 hodin dříve",companion:"VIP: další host",empty:"Pas se objeví po registraci na akci pořadatele",signin:"Přihlas se nebo otevři Telegram Mini App",detail:"Razítka se počítají pouze po check-inu, nikoli za rezervaci. Každý pořadatel má samostatný čtvrtletní program."},
 uk:{title:"Паспорт гостя",subtitle:"Відвідуй події, збирай штампи та отримуй переваги",total:"Усього відвідувань",season:"Сезон",until:"До наступного рівня",top:"Найвищий рівень",perks:"Твої бонуси",ready:"Доступно",planned:"Незабаром",priority:"Пріоритет у списку очікування",early:"Ранній запис за 24 години",companion:"VIP: додатковий гість",empty:"Паспорт з'явиться після запису на подію",signin:"Увійди або відкрий Telegram Mini App",detail:"Штампи нараховуються лише після check-in, а не за запис. Програма діє окремо для кожного організатора в межах кварталу."}
};
const names:Record<LanguageCode,Record<string,string>>={
 ru:{newcomer:"Новичок",regular:"Свой",insider:"Инсайдер",vip:"VIP"},
 en:{newcomer:"Newcomer",regular:"Regular",insider:"Insider",vip:"VIP"},
 cs:{newcomer:"Nováček",regular:"Stálý host",insider:"Insider",vip:"VIP"},
 uk:{newcomer:"Новачок",regular:"Свій",insider:"Інсайдер",vip:"VIP"}
};
const levels=[["newcomer",0],["regular",3],["insider",6],["vip",12]] as const;

function PassportCard({studio,language}:{studio:LoyaltyStudio;language:LanguageCode}){
 const tr=copy[language];
 const reached=levels.findIndex(([name])=>name===studio.tier);
 const perks=[
  {key:"priority_waitlist",label:tr.priority},
  {key:"early_access",label:tr.early},
  {key:"vip_companion",label:tr.companion}
 ];
 return <section className="panel loyalty-card">
  <div className="loyalty-card-head"><div><h2>{studio.organizer_name}</h2><p className="form-note">{tr.total}: {studio.lifetime_visits}</p></div>
   <strong className={"loyalty-badge loyalty-"+studio.tier}>{names[language][studio.tier]}</strong></div>
  <div className="tt-tier-gallery" role="list" aria-label={tr.title}>
    {levels.map(([name,amount],idx)=><div key={name} className={"tt-tier-print tt-tier-"+name+(idx<=reached?" is-earned":"")} role="listitem" aria-current={idx===reached?"step":undefined}>
      <div className="tt-tier-print-head"><span>LV.{idx+1}</span><span className="tt-tier-signal" aria-hidden="true">{[1,2,3,4].map((signal)=><i key={signal} style={{height:(8+signal*6)+"px",opacity:signal<=idx+1?1:.3}}/>)}</span></div>
      <div className="tt-tier-stamp"><img src="/brand/glyph-burst.svg" alt=""/></div>
      <div className="tt-tier-print-foot"><strong>{names[language][name]}</strong><span className="tt-tier-barcode" aria-hidden="true"/><small>{amount===0?"START":amount+" CHECK-INS"}</small></div>
    </div>)}
  </div>
  <div className="loyalty-levels" role="list">{levels.map(([name,amount],idx)=>
   <div role="listitem" className={"loyalty-level "+(idx<=reached?"earned":"")} key={name}>
    <strong>{amount||"•"}</strong><span>{names[language][name]}</span>
   </div>)}</div>
  <div className="loyalty-progress">
   <div><strong>{studio.season_visits} / {studio.next_threshold??12}</strong><span>{studio.next_threshold===null?tr.top:tr.until+": "+studio.remaining}</span></div>
   <progress value={studio.progress_percent} max={100} aria-label={tr.until}/>
  </div>
  <h3>{tr.perks}</h3>
  {perks.map(item=>{
    const entry=studio.perks.find(x=>x.key===item.key);
    const active=entry?.operational===true&&entry?.available===true;
    return <div className="loyalty-benefit" key={item.key}>
      <span>{item.label}</span>
      <span className={"status "+(active?"status-success":"status-demo")}>{active?tr.ready:tr.planned}</span>
    </div>;
  })}
 </section>;
}
export function LoyaltyClient(){
 const {language}=useLanguage(), tr=copy[language];
 const [passport,setPassport]=useState<LoyaltyPassport|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{
   try{const guest=await restoreGuest();if(guest){const result=await getMyLoyalty();if(live)setPassport(result);}}
   catch(e){if(live)setError(e instanceof Error?e.message:"Could not load loyalty passport");}
   finally{if(live)setLoading(false);}
 })();return()=>{live=false};},[]);
 return <div className="app-shell"><AppHeader/><main className="page">
  <Link href="/" className="back-link">← {language==="ru"?"Ивенты":language==="cs"?"Události":language==="uk"?"Події":"Events"}</Link>
  <div className="section-heading"><div><h1>{tr.title}</h1><p>{tr.subtitle}</p></div></div>
  {loading?<div className="state-card" role="status">…</div>:error?<div className="state-card state-error" role="alert">{error}</div>:
  !passport?<div className="state-card">{tr.signin} <Link href="/profile">→</Link></div>:
  <>
   <div className="panel loyalty-overview"><strong>{tr.season}: {passport.season}</strong><span>{tr.total}: {passport.total_lifetime_visits}</span></div>
   {passport.studios.length===0?<section className="tt-loyalty-empty">
     <span className="tt-example-stamp">{language==="ru"?"Пример":language==="cs"?"Příklad":language==="uk"?"Приклад":"Example"}</span>
     <div className="tt-loyalty-empty-main"><h2>{names[language].newcomer}</h2>
       <p>{language==="ru"?"Уровень и награды появятся после участия у организатора. Визиты считаются только по отметкам на входе.":
          language==="cs"?"Úroveň a odměny se zobrazí po účasti u pořadatele. Počítají se jen skutečná odbavení.":
          language==="uk"?"Рівень і нагороди з'являться після участі в організатора. Враховуються лише справжні відмітки на вході.":
          "Your level and rewards appear after joining an organizer's events. Only actual check-ins count."}</p>
       <div className="tt-loyalty-example-progress"><span/><span/><span/></div>
       <strong>{language==="ru"?"Начните с первого визита":language==="cs"?"Začněte první návštěvou":language==="uk"?"Почніть із першого візиту":"Start with your first visit"}</strong>
     </div>
     <div className="tt-loyalty-empty-how">
      <h3>{language==="ru"?"Как получить визит":language==="cs"?"Jak získat návštěvu":language==="uk"?"Як зарахувати візит":"How to earn a visit"}</h3>
      <ol>
       <li>{language==="ru"?"Выбери событие":language==="cs"?"Vyberte akci":language==="uk"?"Оберіть подію":"Choose an event"}</li>
       <li>{language==="ru"?"Получите действительный билет":language==="cs"?"Získejte platnou vstupenku":language==="uk"?"Отримайте дійсний квиток":"Get a valid ticket"}</li>
       <li>{language==="ru"?"Покажите QR на входе":language==="cs"?"Ukažte QR u vstupu":language==="uk"?"Покажіть QR на вході":"Show your QR at check-in"}</li>
      </ol>
      <div className="tt-loyalty-empty-future">
        <h4>{language==="ru"?"Что вас ждёт":language==="uk"?"Що на вас чекає":language==="cs"?"Co vás čeká":"What comes next"}</h4>
        <div className="tt-loyalty-empty-future-grid">{levels.map(([name,amount],i)=><article key={name} className={"tt-loyalty-future-tier"+(i===0?" is-current":"")}>
           <span>{i===0?(language==="ru"?"Ваш уровень":language==="uk"?"Ваш рівень":language==="cs"?"Vaše úroveň":"Your tier"):"🔒 "+amount+" CHECK-INS"}</span>
           <img src={i===0?"/brand/glyph-plus.svg":i===1?"/brand/glyph-asterisk.svg":i===2?"/brand/glyph-burst.svg":"/brand/glyph-wave.svg"} alt="" loading="lazy"/>
           <strong>{names[language][name]}</strong>
           <span>{i===0?"0 / 3":(language==="ru"?"Ещё "+amount+" визитов":language==="uk"?"Ще "+amount+" відвідувань":language==="cs"?"Zbývá "+amount+" návštěv":amount+" more visits")}</span>
        </article>)}</div>
      </div>
      <div className="tt-loyalty-stamp-grid">{Array.from({length:6},(_,i)=><div key={i} className={i===0?"is-sample":""}>
       {i===0?<><img src="/brand/glyph-burst.svg" alt=""/><small>{language==="ru"?"Пример":language==="cs"?"Příklad":language==="uk"?"Приклад":"Example"}</small></>:<span aria-hidden="true">+</span>}
      </div>)}</div>
      <Link href="/" className="button button-primary">{language==="ru"?"Смотреть ивенты":language==="cs"?"Zobrazit akce":language==="uk"?"Переглянути події":"Explore events"} ↗</Link>
     </div>
    </section>:
   <div className="loyalty-grid">{passport.studios.map(s=><PassportCard key={s.organizer_id} studio={s} language={language}/>)}</div>}
   <p className="form-note loyalty-explanation">{tr.detail}</p>
  </>}
 </main></div>;
}
