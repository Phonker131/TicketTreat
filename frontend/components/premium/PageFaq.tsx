"use client";
import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";
import {faqCopy,type FaqItem} from "@/lib/faq-content";
import type {LanguageCode} from "@/lib/types";

/* A short FAQ on each page, about that page's topic. Most answers come from the main FAQ (section, item);
   rewards and organizers add a few of their own, written from what those pages already state. */
export type FaqTopic="home"|"event"|"tickets"|"rewards"|"organizers";

const picks:Record<FaqTopic,[number,number][]>={
 home:[[0,0],[0,2],[1,1],[2,0]],
 event:[[0,0],[2,1],[1,3],[2,2]],
 tickets:[[1,0],[1,1],[1,2],[3,0]],
 rewards:[[1,1]],
 organizers:[[2,2],[2,0]]
};

const own:Partial<Record<FaqTopic,Record<LanguageCode,FaqItem[]>>>={
 rewards:{
  en:[{q:"When does a visit count?",a:"Only after a real check-in at the door, when staff scan your QR ticket."},
   {q:"Are the levels the same everywhere?",a:"Yes: 3, 6 and 12 visits for every organizer. Each organizer counts your visits separately, so you can be a Regular with one and a Newcomer with another."},
   {q:"Where do I see my visits?",a:"Sign in and open Rewards. You see your visits with each organizer and how many are left to the next level."}],
  cs:[{q:"Kdy se návštěva započítá?",a:"Až po skutečném odbavení u vstupu, když obsluha naskenuje vaši QR vstupenku."},
   {q:"Jsou úrovně všude stejné?",a:"Ano: 3, 6 a 12 návštěv u každého pořadatele. Každý pořadatel počítá vaše návštěvy zvlášť, takže u jednoho můžete být Stálý host a u jiného Nováček."},
   {q:"Kde uvidím své návštěvy?",a:"Přihlaste se a otevřete Odměny. Uvidíte návštěvy u každého pořadatele a kolik zbývá do další úrovně."}],
  ru:[{q:"Когда засчитывается визит?",a:"Только после настоящего check-in на входе, когда сотрудник сканирует ваш QR-билет."},
   {q:"Уровни везде одинаковые?",a:"Да: 3, 6 и 12 визитов у любого организатора. Визиты каждый организатор считает отдельно, поэтому у одного вы можете быть «Своим», а у другого «Новичком»."},
   {q:"Где посмотреть мои визиты?",a:"Войдите в аккаунт и откройте «Награды». Там видны визиты у каждого организатора и сколько осталось до следующего уровня."}],
  uk:[{q:"Коли зараховується візит?",a:"Лише після справжнього check-in на вході, коли працівник сканує ваш QR-квиток."},
   {q:"Рівні всюди однакові?",a:"Так: 3, 6 і 12 візитів у будь-якого організатора. Візити кожен організатор рахує окремо, тож в одного ви можете бути «Своїм», а в іншого «Новачком»."},
   {q:"Де подивитися мої візити?",a:"Увійдіть в акаунт і відкрийте «Нагороди». Там видно візити в кожного організатора і скільки лишилося до наступного рівня."}]
 },
 organizers:{
  en:[{q:"Who are the organizers?",a:"Venues, communities and teams that publish events on TicketTreat. Each profile shows their upcoming and past events."},
   {q:"How can I become an organizer?",a:"Apply from your TicketTreat account on the For organizers page. Once the application is approved and two-factor authentication is on, the organizer tools open."}],
  cs:[{q:"Kdo jsou pořadatelé?",a:"Podniky, komunity a týmy, které na TicketTreat zveřejňují akce. Každý profil ukazuje jejich nadcházející a minulé akce."},
   {q:"Jak se stát pořadatelem?",a:"Požádejte o přístup ze svého účtu TicketTreat na stránce Pro pořadatele. Po schválení žádosti a zapnutí dvoufázového ověření se otevřou nástroje pro pořadatele."}],
  ru:[{q:"Кто такие организаторы?",a:"Площадки, сообщества и команды, которые публикуют события в TicketTreat. В каждом профиле видны их будущие и прошедшие события."},
   {q:"Как стать организатором?",a:"Подайте заявку из своего аккаунта TicketTreat на странице «Для организаторов». После одобрения заявки и включения двухфакторной защиты откроются инструменты организатора."}],
  uk:[{q:"Хто такі організатори?",a:"Заклади, спільноти та команди, які публікують події в TicketTreat. У кожному профілі видно їхні майбутні та минулі події."},
   {q:"Як стати організатором?",a:"Подайте заявку зі свого акаунта TicketTreat на сторінці «Для організаторів». Після схвалення заявки та ввімкнення двофакторного захисту відкриються інструменти організатора."}]
 }
};

const titles:Record<FaqTopic,Record<LanguageCode,string>>={
 home:{en:"Questions before your first event",cs:"Otázky před první akcí",ru:"Вопросы перед первым ивентом",uk:"Питання перед першою подією"},
 event:{en:"Questions about booking",cs:"Otázky k rezervaci",ru:"Вопросы о бронировании",uk:"Питання про бронювання"},
 tickets:{en:"Questions about tickets",cs:"Otázky ke vstupenkám",ru:"Вопросы о билетах",uk:"Питання про квитки"},
 rewards:{en:"Questions about rewards",cs:"Otázky k odměnám",ru:"Вопросы о наградах",uk:"Питання про нагороди"},
 organizers:{en:"Questions about organizers",cs:"Otázky k pořadatelům",ru:"Вопросы об организаторах",uk:"Питання про організаторів"}
};
const more:Record<LanguageCode,string>={en:"Read FAQ",cs:"Všechny otázky",ru:"Все вопросы",uk:"Усі питання"};

export function PageFaq({topic,language:forced}:{topic:FaqTopic;language?:LanguageCode}){
 const {language:context}=useLanguage();
 const language=forced??context;
 const base=picks[topic].map(([s,i])=>faqCopy[language].sections[s]?.items[i]).filter((x):x is FaqItem=>Boolean(x));
 const items=[...(own[topic]?.[language]??[]),...base];
 return <section className="tp-faq" aria-labelledby={"tp-faq-"+topic}>
  <h2 id={"tp-faq-"+topic}>{titles[topic][language]}</h2>
  <div className="tp-faq-list">
   {items.map(it=><details key={it.q}><summary>{it.q}</summary><p>{it.a}</p></details>)}
  </div>
  <Link href={language==="cs"?"/cs/faq":"/en/faq"} className="button button-secondary">{more[language]}</Link>
 </section>;
}
