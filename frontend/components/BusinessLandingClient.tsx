"use client";
import {useEffect,useState,type FormEvent} from "react";
import {createSupportTicket} from "@/lib/api";
import {getWebToken} from "@/lib/session";
import Link from "next/link";
import {BrandPhone,BrandLaptop} from "@/components/BrandScreens";
import {BusinessHeader} from "@/components/BusinessHeader";
import {useLanguage} from "@/components/LanguageProvider";

const words={
 ru:{eyebrow:"TICKETTREAT / ORGANIZERS",hero:"Список гостей без таблиц",intro:"Создавайте ивенты, принимайте регистрации, проверяйте QR и общайтесь с гостями из одного кабинета.",open:"Открыть кабинет",apply:"Оставить заявку",how:"Три шага для организатора",steps:["Создайте ивент","Гости записываются сами","Принимайте на входе"],stepText:["Добавьте название, время, описание, афишу и вместимость.","Смотрите регистрации, очередь ожидания и подтверждайте прямые оплаты.","Сканируйте QR или отметьте гостя по коду билета."],two:"Одна запись, две стороны",side:["Гость выбирает событие и получает билет.","Вы управляете списком, подтверждениями и входом.","Посещение фиксируется только после check-in."],features:"Шесть вещей, которые перестают быть ручными",feature:["Список регистраций и мест","Очередь ожидания","Платные заявки с ручным подтверждением","Напоминания гостям","Проверка билета по QR или коду","Уровни посещений по организаторам"],timing:"До, во время и после",period:["До ивента","На входе","После мероприятия"],details:["Опубликуйте афишу, следите за заявками и местами.","Проверяйте действительность билетов и отмечайте гостей.","Смотрите посещаемость, историю и доставку уведомлений."],questions:"Частые вопросы",qs:["Как начать работать?","Нужна ли компания?","Кто получает деньги за платный ивент?","Сколько стоит сервис?","Можно ли менять список гостей?","Работает ли Telegram?"],as:["Войдите с подтверждённым email и подайте заявку организатора. После одобрения потребуется двухфакторная защита.","Юридический статус организатора определяется его собственными обязательствами. Уточняйте требования для своей деятельности.","Сейчас платёж проходит напрямую организатору. Он подтверждает получение; TicketTreat не принимает деньги.","Условия подключения сообщим индивидуально, подтверждённых публичных тарифов пока нет.","Да, в кабинете доступны регистрации, отмены, очередь ожидания и журнал отметок.","Зарегистрированные в боте гости могут получать доступные служебные уведомления."],connect:"Подключить организацию",connectText:"Подайте заявку через действующий аккаунт. После проверки и включения MFA появится доступ к функциям организатора.",note:"Примеры экранов иллюстрируют интерфейс, а не настоящие данные."},
 cs:{eyebrow:"TICKETTREAT / POŘADATELÉ",hero:"Seznam hostů bez tabulek",intro:"Vytvářejte akce, spravujte registrace, kontrolujte QR a komunikujte s hosty v jednom kabinetu.",open:"Otevřít kabinet",apply:"Požádat o přístup",how:"Tři kroky pro pořadatele",steps:["Vytvořte akci","Hosté se přihlásí sami","Odbavujte u vstupu"],stepText:["Přidejte název, čas, popis, plakát a kapacitu.","Sledujte přihlášky, čekací listinu a potvrzujte přímé platby.","Naskenujte QR nebo označte hosta pomocí kódu."],two:"Jedna registrace, dva pohledy",side:["Host si vybere akci a dostane vstupenku.","Vy spravujete seznam, potvrzení a odbavení.","Návštěva se započítá až po skutečném odbavení."],features:"Šest věcí, které nemusíte dělat ručně",feature:["Seznam registrací a kapacity","Čekací listina","Placené žádosti s ručním potvrzením","Připomínky pro hosty","Ověření vstupenky pomocí QR nebo kódu","Úrovně návštěv podle pořadatele"],timing:"Před akcí, u vstupu a potom",period:["Před akcí","U vstupu","Po akci"],details:["Zveřejněte plakát a spravujte přihlášky.","Ověřte vstupenky a odbavujte hosty.","Sledujte účast a historii oznámení."],questions:"Časté otázky",qs:["Jak začít?","Potřebuji firmu?","Kdo přijímá platby za placenou akci?","Kolik služba stojí?","Mohu upravit seznam hostů?","Funguje Telegram?"],as:["Přihlaste se s ověřeným e-mailem a pošlete žádost. Po schválení zapněte dvoufaktorové ověření.","Právní povinnosti pořadatele závisí na konkrétní činnosti. Ověřte si své požadavky.","Platby aktuálně probíhají přímo pořadateli. Ten potvrdí přijetí; TicketTreat peníze nepřijímá.","Podmínky upřesníme při připojení, veřejný ceník zatím nemáme.","Ano, v kabinetu jsou přihlášky, zrušení, čekací listina a odbavení.","Hosté registrovaní v botu mohou dostávat dostupná servisní oznámení."],connect:"Připojit organizaci",connectText:"Odešlete žádost ze svého účtu. Po schválení a zapnutí MFA získáte přístup k funkcím pořadatele.",note:"Ukázky obrazovek jsou ilustrativní, ne skutečná data."},
 en:{eyebrow:"TICKETTREAT / BUSINESS",hero:"Your guest list without spreadsheets",intro:"Create events, handle registrations, verify QR tickets and contact guests from one dashboard.",open:"Open dashboard",apply:"Apply as organizer",how:"Three steps for organizers",steps:["Create an event","Guests register themselves","Check in at the door"],stepText:["Add the name, time, description, poster and capacity.","Track registrations, the waitlist and confirm direct payments.","Scan a QR or check in a guest using their ticket code."],two:"One registration, two views",side:["Guests choose an event and receive a ticket.","You manage guests, confirmations and admission.","Only a real check-in counts as a visit."],features:"Six things you no longer handle manually",feature:["Registration list and capacity","Waitlist","Paid reservations with manual confirmation","Guest reminders","QR and printed code verification","Organizer-specific visit levels"],timing:"Before, during and after",period:["Before the event","At the door","After the event"],details:["Publish a poster and track applications.","Verify tickets and mark arrivals.","Review attendance and notification history."],questions:"Frequently asked questions",qs:["How do I start?","Do I need a registered business?","Who receives paid-event payments?","What does TicketTreat cost?","Can I manage the guest list?","Does Telegram work?"],as:["Sign in with a verified email and apply. After approval you must enable two-factor authentication.","Your obligations depend on your activity. Check your own legal requirements.","Payments currently go directly to the organizer. The organizer confirms receipt; TicketTreat does not collect funds.","We will explain terms during onboarding. There is no confirmed public price list.","Yes. The dashboard includes registrations, cancellations, waitlists and check-in logs.","Guests who started the bot may receive supported service notifications."],connect:"Join as an organizer",connectText:"Apply from your existing account. Once approved and MFA is enabled, organizer tools become available.",note:"Device illustrations are examples, not live guest data."},
 uk:{eyebrow:"TICKETTREAT / ОРГАНІЗАТОРИ",hero:"Список гостей без таблиць",intro:"Створюйте події, керуйте реєстраціями, перевіряйте QR і спілкуйтеся з гостями в одному кабінеті.",open:"Відкрити кабінет",apply:"Подати заявку",how:"Три кроки для організатора",steps:["Створіть подію","Гості реєструються самі","Приймайте на вході"],stepText:["Додайте назву, час, опис, афішу та місткість.","Переглядайте заявки, чергу й підтверджуйте прямі оплати.","Скануйте QR або відмічайте гостя за кодом квитка."],two:"Одна реєстрація, два погляди",side:["Гість обирає подію й отримує квиток.","Ви керуєте списком, підтвердженнями та входом.","Візит зараховується тільки після check-in."],features:"Шість речей без ручної роботи",feature:["Список реєстрацій і місць","Черга очікування","Платні заявки з ручним підтвердженням","Нагадування гостям","Перевірка за QR або кодом","Рівні відвідувань за організаторами"],timing:"До, під час і після",period:["До події","На вході","Після події"],details:["Опублікуйте афішу та стежте за заявками.","Перевіряйте квитки й відмічайте гостей.","Аналізуйте відвідуваність та повідомлення."],questions:"Поширені запитання",qs:["Як почати?","Чи потрібна компанія?","Хто отримує оплату?","Скільки коштує сервіс?","Чи можна змінювати список?","Чи працює Telegram?"],as:["Увійдіть із підтвердженою поштою й подайте заявку. Після схвалення увімкніть двофакторну автентифікацію.","Обов'язки залежать від вашої діяльності. Уточнюйте свої правові вимоги.","Наразі оплата йде безпосередньо організатору. Він підтверджує її, а TicketTreat не приймає коштів.","Умови повідомимо під час підключення. Публічного затвердженого тарифу немає.","Так, у кабінеті є реєстрації, скасування, черга і журнал входів.","Гості, що відкрили бота, можуть отримувати службові сповіщення."],connect:"Підключити організацію",connectText:"Подайте заявку зі свого акаунта. Після схвалення та увімкнення MFA отримаєте доступ до інструментів.",note:"Зразки екранів ілюстративні, не справжні дані."}
};
export function BusinessLandingClient(){
 const {language}=useLanguage(),t=words[language];
 const [step,setStep]=useState(0);
 const [tabsReady,setTabsReady]=useState(false);
 useEffect(()=>setTabsReady(true),[]);
 const [organization,setOrganization]=useState(""),[contact,setContact]=useState(""),[email,setEmail]=useState(""),[eventTypes,setEventTypes]=useState("");
 const [formState,setFormState]=useState<"idle"|"sending"|"sent">("idle"),[formError,setFormError]=useState("");
 async function sendRequest(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setFormError("");
   if(!getWebToken()){setFormError(language==="ru"?"Войдите в профиль TicketTreat, затем отправьте заявку.":language==="uk"?"Увійдіть у профіль TicketTreat, потім надішліть заявку.":language==="cs"?"Nejprve se přihlaste do TicketTreat a pak žádost odešlete.":"Sign in to TicketTreat before submitting your application.");return;}
   setFormState("sending");
   try{
     await createSupportTicket("other","Organizer application: "+organization.trim(),
       ["Organization: "+organization.trim(),"Contact: "+contact.trim(),"Email: "+email.trim(),"Events: "+eventTypes.trim()].join("\n"));
     setFormState("sent");
   }catch(err){setFormError(err instanceof Error?err.message:String(err));setFormState("idle");}
 }
 return <div className="app-shell tt-business-landing"><BusinessHeader/>
 <main id="main-content" className="tt-business-main">
  <section className="tt-v12-screen tt-business-hero" id="business-top">
   <div className="tt-v12-screen-content tt-business-hero-grid">
    <div className="tt-v12-intro"><span>{t.eyebrow}</span><h1>{t.hero}</h1><p>{t.intro}</p>
     <div className="tt-business-actions"><Link className="button button-primary" href="/admin">{t.open} ↗</Link>
      <Link className="button button-secondary" href="/organizer/apply">{t.apply}</Link></div>
    </div>
    <div className="tt-business-preview-stack">
      <BrandLaptop language={language} kind="overview"/>
      <BrandPhone language={language} kind="ticket" compact/>
    </div>
   </div>
  </section>
  <section id="business-how" className="tt-v12-screen tt-business-how"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>02 / HOW</span><h2>{t.how}</h2></div>
   <div className="tt-business-tabs" role="tablist" aria-label={t.how}>
    {t.steps.map((name,i)=><button key={i} id={"tt-business-tab-"+i} role="tab" type="button" disabled={!tabsReady} aria-controls="tt-business-panel"
      aria-selected={step===i} tabIndex={step===i?0:-1} onClick={()=>setStep(i)}
      onKeyDown={e=>{let next=step;if(e.key==="ArrowRight")next=(step+1)%3;else if(e.key==="ArrowLeft")next=(step+2)%3;else if(e.key==="Home")next=0;else if(e.key==="End")next=2;else return;e.preventDefault();setStep(next);document.getElementById("tt-business-tab-"+next)?.focus()}}>
      <span>{i+1}</span>{name}</button>)}
   </div>
   <div id="tt-business-panel" role="tabpanel" aria-labelledby={"tt-business-tab-"+step} className="tt-business-tab-panel">
    <div><h3>{t.steps[step]}</h3><p>{t.stepText[step]}</p><Link href="/admin" className="button button-secondary">{t.open} ↗</Link></div>
    <BrandLaptop language={language} kind={step===0?"create":step===1?"guests":"checkin"}/>
   </div>
  </div></section>
  <section id="business-sides" className="tt-v12-screen tt-business-sides"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>03 / GUEST + ORGANIZER</span><h2>{t.two}</h2></div>
   <div className="tt-business-triptych tt-business-side-devices">{t.side.map((txt,i)=><article key={i}><span>0{i+1}</span><div>{i===1?<BrandLaptop language={language} kind="guests"/>:<BrandPhone kind={i===0?"reserve":"passport"} language={language} compact/>}</div><p>{txt}</p></article>)}</div>
  </div></section>
  <section id="business-features" className="tt-v12-screen tt-business-features"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>04 / FEATURES</span><h2>{t.features}</h2></div>
   <ol className="tt-business-feature-grid">{t.feature.map((v,i)=><li key={i}><span>{String(i+1).padStart(2,"0")}</span><strong>{v}</strong></li>)}</ol>
  </div></section>
  <section id="business-timeline" className="tt-v12-screen tt-business-timeline"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>05 / TIMELINE</span><h2>{t.timing}</h2></div>
   <div className="tt-business-triptych">{t.period.map((v,i)=><article key={i}><span>0{i+1}</span><h3>{v}</h3><p>{t.details[i]}</p></article>)}</div>
  </div></section>
  <section id="business-faq" className="tt-v12-screen tt-business-faq"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>06 / FAQ</span><h2>{t.questions}</h2></div>
   <div className="tt-business-faq-list">{t.qs.map((q,i)=><details key={i}><summary>{q}</summary><p>{t.as[i]}</p></details>)}</div>
  </div></section>
  <section id="business-connect" className="tt-v12-screen tt-business-connect"><div className="tt-v12-screen-content">
   <div className="tt-v12-intro"><span>07 / START</span><h2>{t.connect}</h2><p>{t.connectText}</p></div>
   <form className="tt-business-apply-form" onSubmit={sendRequest}>
      <label>{language==="ru"?"Организация":language==="uk"?"Організація":language==="cs"?"Organizace":"Organization"}<input required minLength={2} maxLength={100} autoComplete="organization" value={organization} onChange={e=>setOrganization(e.target.value)}/></label>
      <label>{language==="ru"?"Контактное лицо":language==="uk"?"Контактна особа":language==="cs"?"Kontaktní osoba":"Contact person"}<input required minLength={2} maxLength={100} autoComplete="name" value={contact} onChange={e=>setContact(e.target.value)}/></label>
      <label>Email<input required type="email" autoComplete="email" maxLength={160} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>{language==="ru"?"Какие мероприятия планируете?":language==="uk"?"Які події плануєте?":language==="cs"?"Jaké akce plánujete?":"What kind of events?"}<textarea required minLength={10} maxLength={1000} rows={3} value={eventTypes} onChange={e=>setEventTypes(e.target.value)}/></label>
      {formError&&<p className="tt-business-form-error" role="alert">{formError} <Link href="/profile">{language==="ru"?"Войти":language==="uk"?"Увійти":language==="cs"?"Přihlásit se":"Sign in"} ↗</Link></p>}
      {formState==="sent"&&<p className="tt-business-form-success" role="status">{language==="ru"?"Заявка отправлена в службу поддержки TicketTreat. Мы ответим через тикет и email аккаунта.":language==="uk"?"Заявку надіслано до підтримки TicketTreat. Відповімо в зверненні та на email.":language==="cs"?"Žádost byla odeslána podpoře TicketTreat. Odpovíme v požadavku a e-mailem.":"Application received by TicketTreat support. We will reply in the ticket and by account email."}</p>}
      <button type="submit" className="button button-primary" disabled={formState==="sending"||formState==="sent"}>{formState==="sending"?"…":t.apply} ↗</button>
      <p className="tt-business-apply-note">{language==="ru"?"Для отправки нужен аккаунт с подтверждённым email. Данные заявки доступны администраторам через службу поддержки.":language==="uk"?"Для надсилання потрібен акаунт з підтвердженим email. Заявку отримають адміністратори підтримки.":language==="cs"?"K odeslání potřebujete účet s ověřeným e-mailem. Žádost obdrží administrátoři podpory.":"A verified TicketTreat account is required. The application is delivered to the support admins."}</p>
    </form>
  </div></section>
 </main></div>;
}
