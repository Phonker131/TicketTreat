"use client";
import {useState} from "react";
import Link from "next/link";
import type {LanguageCode} from "@/lib/types";
const labels={
 ru:{how:"От ссылки до входа: три шага",howSub:"Без лишней переписки. Ваш билет хранится в TicketTreat.",ticket:"Билет, который хочется показать",ticketSub:"Нажмите на настоящий билет в «Моих билетах», чтобы увидеть QR.",levels:"Чаще приходите: больше открывается",levelsSub:"Визит засчитывается после подтверждённого check-in.",steps:["Выберите ивент","Запишитесь","Покажите QR"],details:["Найдите событие в свайпе, ленте или на карте.","Бесплатно: билет сразу. Платно: дождитесь подтверждения организатора.","Откройте билет и покажите QR на входе."],sample:"Пример",open:"Открыть мои билеты",passport:"Посмотреть награды",names:["Новичок","Свой","Инсайдер","VIP"],notReal:"Демонстрационный вид, не действительный билет"},
 cs:{how:"Od odkazu ke vstupu: tři kroky",howSub:"Bez zbytečných zpráv. Vaše vstupenka je v TicketTreat.",ticket:"Vstupenka, kterou chcete ukázat",ticketSub:"Otevřete skutečnou vstupenku v Moje vstupenky a zobrazte QR.",levels:"Více návštěv, další možnosti",levelsSub:"Návštěva se započítá až po skutečném odbavení.",steps:["Vyberte akci","Zarezervujte si místo","Ukažte QR"],details:["Najděte akci mezi kartami, v seznamu nebo na mapě.","Zdarma: vstupenka ihned. Placené: čekejte na potvrzení pořadatele.","Otevřete vstupenku a u vstupu ukažte QR."],sample:"Příklad",open:"Moje vstupenky",passport:"Otevřít odměny",names:["Nováček","Stálý host","Insider","VIP"],notReal:"Ukázka, neplatná vstupenka"},
 uk:{how:"Від посилання до входу: три кроки",howSub:"Без зайвих повідомлень. Квиток зберігається в TicketTreat.",ticket:"Квиток, який хочеться показати",ticketSub:"Відкрийте справжній квиток у «Моїх квитках», щоб побачити QR.",levels:"Більше відвідувань, більше можливостей",levelsSub:"Візит зараховується після справжнього check-in.",steps:["Оберіть подію","Забронюйте місце","Покажіть QR"],details:["Знайдіть подію у свайпі, стрічці або на мапі.","Безкоштовно: квиток одразу. Платно: дочекайтесь підтвердження організатора.","Відкрийте квиток і покажіть QR на вході."],sample:"Приклад",open:"Мої квитки",passport:"Переглянути нагороди",names:["Новачок","Свій","Інсайдер","VIP"],notReal:"Лише приклад, не дійсний квиток"},
 en:{how:"From link to entry in three steps",howSub:"No long message threads. Your ticket stays in TicketTreat.",ticket:"A ticket worth showing",ticketSub:"Open an actual ticket in My tickets to display its QR.",levels:"More visits, more possibilities",levelsSub:"A visit counts only after a real check-in.",steps:["Choose an event","Reserve a spot","Show your QR"],details:["Find an event in the swipe deck, feed or map.","Free: instant ticket. Paid: wait for organizer confirmation.","Open your ticket and show its QR at the door."],sample:"Example",open:"Open my tickets",passport:"Explore rewards",names:["Newcomer","Regular","Insider","VIP"],notReal:"Illustration only, not a valid ticket"}
} as const;
export function GuidedSections({language}:{language:LanguageCode}){
 const t=labels[language], [showBack,setShowBack]=useState(false);
 return <>
  <section className="tt-v12-screen tt-v12-how" id="how" aria-labelledby="tt-how-title">
    <div className="tt-v12-screen-content">
      <div className="tt-v12-intro"><span>02 / HOW</span><h2 id="tt-how-title">{t.how}</h2><p>{t.howSub}</p></div>
      <div className="tt-v12-phones">
       {t.steps.map((step,i)=><div className="tt-v12-phone-card" key={step}>
          <div className="tt-v12-phone" aria-hidden="true">
           <i className="tt-v12-camera"/>
           <div className="tt-v12-phone-display">
             <small>TICKETTREAT / {String(i+1).padStart(2,"0")}</small>
             <span className="tt-v12-device-number">{i+1}</span>
             <img src={i===0?"/brand/glyph-burst.svg":i===1?"/brand/glyph-plus.svg":"/brand/glyph-asterisk.svg"} alt=""/>
             <b>{step}</b>
           </div>
          </div>
          <h3>{step}</h3><p>{t.details[i]}</p>
        </div>)}
      </div>
    </div>
  </section>
  <section className="tt-v12-screen tt-v12-ticket" id="ticket-preview" aria-labelledby="tt-ticket-preview-title">
   <div className="tt-v12-screen-content tt-v12-ticket-grid">
    <div className="tt-v12-intro"><span>03 / TICKET</span><h2 id="tt-ticket-preview-title">{t.ticket}</h2><p>{t.ticketSub}</p><Link href="/tickets" className="button button-primary">{t.open} ↗</Link></div>
    <div className="tt-v12-sample-ticket" role="group" aria-label={t.notReal}>
     <span className="tt-v12-sample-sticker">{t.sample}</span>
     {!showBack?<><small>TICKETTREAT / SAMPLE</small><strong>{t.ticket}</strong><p>{t.notReal}</p></>:
       <><small>TICKETTREAT / SAMPLE</small><div className="tt-v12-sample-qr" aria-hidden="true"><img src="/brand/glyph-ticket.svg" alt=""/></div><p>{t.notReal}</p></>}
     <button type="button" className="tt-v12-sample-action" aria-pressed={showBack} onClick={()=>setShowBack(v=>!v)}>
       {showBack?t.steps[1]:t.steps[2]} ↗
     </button>
    </div>
   </div>
  </section>
  <section className="tt-v12-screen tt-v12-levels" id="levels-preview" aria-labelledby="tt-levels-title">
   <div className="tt-v12-screen-content">
    <div className="tt-v12-intro"><span>04 / REWARDS</span><h2 id="tt-levels-title">{t.levels}</h2><p>{t.levelsSub}</p></div>
    <div className="tt-v12-level-list">
     {t.names.map((name,i)=><div key={i} className={"tt-v12-level tt-v12-level-"+i} aria-label={name}>
       <small>{t.sample} / LV.{i+1}</small><img src={i===0?"/brand/glyph-plus.svg":i===1?"/brand/glyph-asterisk.svg":i===2?"/brand/glyph-burst.svg":"/brand/glyph-wave.svg"} alt=""/>
       <strong>{name}</strong>
     </div>)}
    </div>
    <Link href="/loyalty" className="button button-primary">{t.passport} ↗</Link>
   </div>
  </section>
 </>;
}
