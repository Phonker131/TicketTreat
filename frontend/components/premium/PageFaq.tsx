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
   {q:"Who sets the levels and perks?",a:"Each organizer sets their own levels and perks, so they can differ between organizers."},
   {q:"Where do I see my visits?",a:"Sign in and open Rewards. Your passport shows your visits and the next level."}],
  cs:[{q:"Kdy se návštěva započítá?",a:"Až po skutečném odbavení u vstupu, když obsluha naskenuje vaši QR vstupenku."},
   {q:"Kdo určuje úrovně a výhody?",a:"Každý pořadatel si nastavuje vlastní úrovně a výhody, proto se mohou mezi pořadateli lišit."},
   {q:"Kde uvidím své návštěvy?",a:"Přihlaste se a otevřete Odměny. Pas ukazuje vaše návštěvy a další úroveň."}],
  ru:[{q:"Когда засчитывается визит?",a:"Только после настоящего check-in на входе, когда сотрудник сканирует ваш QR-билет."},
   {q:"Кто задаёт уровни и бонусы?",a:"Каждый организатор задаёт свои уровни и бонусы, поэтому у разных организаторов они могут отличаться."},
   {q:"Где посмотреть мои визиты?",a:"Войдите в аккаунт и откройте «Награды». Паспорт показывает ваши визиты и следующий уровень."}],
  uk:[{q:"Коли зараховується візит?",a:"Лише після справжнього check-in на вході, коли працівник сканує ваш QR-квиток."},
   {q:"Хто встановлює рівні та бонуси?",a:"Кожен організатор встановлює власні рівні та бонуси, тож у різних організаторів вони можуть відрізнятися."},
   {q:"Де подивитися мої візити?",a:"Увійдіть в акаунт і відкрийте «Нагороди». Паспорт показує ваші візити та наступний рівень."}]
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
  <Link href={language==="ru"?"/faq":"/"+language+"/faq"} className="button button-secondary">{more[language]}</Link>
 </section>;
}
