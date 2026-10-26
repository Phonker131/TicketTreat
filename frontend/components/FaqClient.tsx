"use client";
import Link from "next/link";
import {useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import type {LanguageCode} from "@/lib/types";

type Item={q:string;a:string};
type Section={title:string;items:Item[]};
type Copy={title:string;intro:string;search:string;empty:string;supportTitle:string;supportIntro:string;supportLink:string;ticketLink:string;profileLink:string;privacyLink:string;sections:Section[]};
const copy:Record<LanguageCode,Copy>={
  en:{
    title:"Frequently asked questions",
    intro:"Everything you need to know before booking your first event with TicketTreat.",
    search:"Search questions",empty:"No answers found. Try another keyword.",
    supportTitle:"Still need help?",supportIntro:"Our team can help with account or ticket issues. Sign in to open a support ticket. For privacy requests, email privacy@tickettreat.eu.",
    supportLink:"Contact support",ticketLink:"My tickets",profileLink:"My profile",privacyLink:"Privacy policy",
    sections:[
      {title:"Registration and account",items:[
        {q:"How do I register for an event?",a:"Open an event, select its registration option and follow the instructions. For free tickets, you can sign in or use quick signup with a name, email and one-time verification code."},
        {q:"I haven't received my email verification code. What should I do?",a:"Check your spam or promotions folder and confirm that your email address is correct. Use the option to request a new code if available. If the problem continues, contact support."},
        {q:"Do I need Telegram to use TicketTreat?",a:"No. You can register and view tickets on the website. Telegram is optional; you can link your Telegram identity to your existing account."}
      ]},
      {title:"Tickets and admission",items:[
        {q:"Where can I find my ticket?",a:"Open My tickets using the same account or verified identity you used for registration. An email confirmation may also be sent."},
        {q:"How do I enter an event with a QR ticket?",a:"Open the ticket's QR code and show it to staff at the entrance. Each ticket is valid only for its event, and a successful check-in cannot be repeated with the same QR."},
        {q:"Can I cancel my ticket?",a:"Open the ticket details and use the cancellation option when available. A cancelled QR ticket is no longer valid. For event changes or refunds, see the organizer's conditions."},
        {q:"What if an event is full?",a:"If the event offers a waiting list, you can join it. If a place becomes available, follow the instructions and any claim deadline shown in the notification. Joining does not guarantee a ticket."}
      ]},
      {title:"Payments and event changes",items:[
        {q:"Does TicketTreat accept card payments?",a:"Not during the current pilot. For priced events, any payment is made directly to the organizer, not through TicketTreat. Never enter payment-card details into a TicketTreat support message."},
        {q:"When will I receive a ticket for a paid event?",a:"An organizer-direct payment request can hold a place for up to 24 hours. The organizer must confirm payment before the QR ticket becomes active. If payment is not confirmed in time, the reservation can expire."},
        {q:"What happens if an event is cancelled or I need a refund?",a:"Check the event notice and contact the organizer or contractual seller about an event cancellation, payment or refund. TicketTreat support can help with platform or account issues, but cannot refund money paid directly to an organizer."}
      ]},
      {title:"Support and privacy",items:[
        {q:"How do I contact TicketTreat support?",a:"Use the Support page and sign in to create a ticket. Replies appear in your support conversation and are also emailed to your verified account address."},
        {q:"How can I ask about or manage my personal data?",a:"Read the Privacy Policy or write to privacy@tickettreat.eu. You do not need to disclose passwords, payment-card details or other sensitive information in a request."}
      ]}
    ]
  },
  ru:{
    title:"Частые вопросы",intro:"Всё, что нужно знать перед регистрацией на первое мероприятие через TicketTreat.",
    search:"Поиск по вопросам",empty:"Ничего не найдено. Попробуй другой запрос.",
    supportTitle:"Остались вопросы?",supportIntro:"Поможем с аккаунтом или билетами. Чтобы создать обращение, войди в аккаунт. По вопросам персональных данных: privacy@tickettreat.eu.",
    supportLink:"Связаться с поддержкой",ticketLink:"Мои билеты",profileLink:"Мой профиль",privacyLink:"Конфиденциальность",
    sections:[
      {title:"Регистрация и аккаунт",items:[
        {q:"Как зарегистрироваться на мероприятие?",a:"Открой страницу мероприятия и выбери регистрацию. Бесплатный билет можно получить после входа в аккаунт или быстрой регистрации по имени, email и одноразовому коду."},
        {q:"Что делать, если код подтверждения не пришёл?",a:"Проверь папку «Спам», правильность email и попробуй запросить новый код, если такая кнопка доступна. Если письмо всё равно не приходит, обратись в поддержку."},
        {q:"Нужен ли Telegram для TicketTreat?",a:"Нет. Регистрироваться и просматривать билеты можно на сайте. Telegram необязателен; при желании его можно привязать к существующему аккаунту."}
      ]},
      {title:"Билеты и вход",items:[
        {q:"Где найти мой билет?",a:"Открой «Мои билеты» в том же аккаунте, через который регистрировался. Подтверждение также может прийти на email."},
        {q:"Как пройти на мероприятие с QR-билетом?",a:"Открой QR-код билета и покажи сотруднику на входе. Билет действует только для указанного мероприятия; после успешного сканирования повторно пройти по тому же QR нельзя."},
        {q:"Могу ли я отменить билет?",a:"Открой билет и воспользуйся отменой, если она доступна. Отменённый QR больше не действует. Условия переноса и возврата по мероприятию уточняй у организатора."},
        {q:"Что делать, если все места заняты?",a:"Если доступен лист ожидания, запишись в него. При появлении места следуй уведомлению и указанному сроку подтверждения. Запись в очередь не гарантирует билет."}
      ]},
      {title:"Оплата и отмены",items:[
        {q:"Можно ли оплатить билет картой через TicketTreat?",a:"Пока нет. В пробной версии платные мероприятия оплачиваются напрямую организатору, не через TicketTreat. Не отправляй реквизиты банковской карты в поддержку."},
        {q:"Когда выдаётся билет на платное мероприятие?",a:"Заявка с оплатой организатору может удерживать место до 24 часов. QR становится активным после подтверждения оплаты организатором. Без подтверждения бронь может истечь."},
        {q:"Что делать, если мероприятие отменили или нужен возврат?",a:"Смотри информацию о мероприятии и обратись к организатору или продавцу по вопросам оплаты и возврата. Поддержка TicketTreat помогает с работой платформы, но не возвращает деньги, полученные организатором."}
      ]},
      {title:"Поддержка и данные",items:[
        {q:"Как связаться со службой поддержки?",a:"Открой раздел «Поддержка» и войди в аккаунт, чтобы создать обращение. Ответ появится в переписке и придёт на подтверждённый email."},
        {q:"Как запросить информацию о моих персональных данных?",a:"Ознакомься с Политикой конфиденциальности или напиши на privacy@tickettreat.eu. Не отправляй пароли, банковские данные и другие секреты."}
      ]}
    ]
  },
  cs:{
    title:"Často kladené otázky",intro:"Vše důležité před registrací na první akci přes TicketTreat.",
    search:"Hledat v otázkách",empty:"Nic jsme nenašli. Zkuste jiný výraz.",
    supportTitle:"Potřebujete další pomoc?",supportIntro:"Pomůžeme s účtem nebo vstupenkou. Pro vytvoření požadavku se přihlaste. K ochraně osobních údajů pište na privacy@tickettreat.eu.",
    supportLink:"Kontaktovat podporu",ticketLink:"Moje vstupenky",profileLink:"Můj profil",privacyLink:"Ochrana osobních údajů",
    sections:[
      {title:"Registrace a účet",items:[
        {q:"Jak se přihlásit na akci?",a:"Otevřete stránku akce a vyberte registraci. Pro bezplatnou vstupenku se můžete přihlásit ke svému účtu nebo využít rychlou registraci se jménem, e-mailem a jednorázovým kódem."},
        {q:"Co když mi nedorazil ověřovací kód?",a:"Zkontrolujte složku Spam, správnost e-mailové adresy a případně požádejte o nový kód. Pokud zpráva stále nedorazí, kontaktujte podporu."},
        {q:"Musím mít Telegram?",a:"Ne. Registrace a vstupenky jsou dostupné také na webu. Telegram je volitelný a lze ho propojit s existujícím účtem."}
      ]},
      {title:"Vstupenky a vstup",items:[
        {q:"Kde najdu svou vstupenku?",a:"Přejděte do sekce Moje vstupenky a použijte stejný účet nebo ověřenou identitu jako při registraci. Potvrzení může přijít také e-mailem."},
        {q:"Jak použít QR vstupenku u vstupu?",a:"Otevřete QR kód své vstupenky a ukažte ho personálu u vstupu. Kód platí pouze pro příslušnou akci a po úspěšném odbavení ho nelze použít znovu."},
        {q:"Mohu vstupenku zrušit?",a:"Otevřete detail vstupenky a použijte možnost zrušení, pokud je dostupná. Zrušený QR kód už neplatí. Podmínky změn a vrácení peněz stanoví pořadatel."},
        {q:"Co když je akce obsazená?",a:"Pokud je k dispozici čekací listina, můžete se přidat. Při uvolnění místa postupujte podle oznámení a uvedené lhůty. Místo na čekací listině nezaručuje vstupenku."}
      ]},
      {title:"Platby a zrušení akce",items:[
        {q:"Lze platit kartou přes TicketTreat?",a:"Zatím ne. Během pilotního provozu se případné platby za placené akce řeší přímo s pořadatelem, nikoli přes TicketTreat. Platební údaje neposílejte do podpory."},
        {q:"Kdy dostanu vstupenku na placenou akci?",a:"Žádost o místo s platbou pořadateli může držet rezervaci až 24 hodin. QR vstupenka se aktivuje až po potvrzení platby pořadatelem. Bez potvrzení rezervace může vypršet."},
        {q:"Co když se akce zruší nebo chci vrátit peníze?",a:"Informace o změnách a vrácení peněz vám poskytne pořadatel či smluvní prodávající. Podpora TicketTreat řeší technické problémy platformy, nevrací ale platby zaslané přímo pořadateli."}
      ]},
      {title:"Podpora a soukromí",items:[
        {q:"Jak mohu kontaktovat podporu?",a:"Otevřete stránku Podpora a přihlaste se, abyste mohli vytvořit požadavek. Odpověď najdete v konverzaci a obdržíte ji také na ověřený e-mail."},
        {q:"Jak mohu požádat o informace o svých osobních údajích?",a:"Přečtěte si zásady ochrany osobních údajů nebo napište na privacy@tickettreat.eu. Nesdělujte hesla, údaje o kartě ani jiné důvěrné informace."}
      ]}
    ]
  },
  uk:{
    title:"Поширені запитання",intro:"Усе важливе перед реєстрацією на першу подію через TicketTreat.",
    search:"Пошук запитань",empty:"Нічого не знайдено. Спробуй інший запит.",
    supportTitle:"Потрібна допомога?",supportIntro:"Допоможемо з акаунтом і квитками. Щоб створити звернення, увійди до акаунта. З питань персональних даних: privacy@tickettreat.eu.",
    supportLink:"Звернутися до підтримки",ticketLink:"Мої квитки",profileLink:"Мій профіль",privacyLink:"Конфіденційність",
    sections:[
      {title:"Реєстрація та акаунт",items:[
        {q:"Як зареєструватися на подію?",a:"Відкрий сторінку події та обери реєстрацію. Безкоштовний квиток доступний після входу до акаунта або швидкої реєстрації з ім'ям, email та одноразовим кодом."},
        {q:"Що робити, якщо код підтвердження не надійшов?",a:"Перевір папку «Спам», правильність email і за можливості запитай новий код. Якщо листа немає, звернися до підтримки."},
        {q:"Чи потрібен Telegram?",a:"Ні. Реєструватися та переглядати квитки можна на сайті. Telegram необов'язковий — за бажанням його можна прив'язати до свого акаунта."}
      ]},
      {title:"Квитки та вхід",items:[
        {q:"Де знайти мій квиток?",a:"Відкрий «Мої квитки» у тому самому акаунті чи з тією самою підтвердженою ідентифікацією, що під час реєстрації. Підтвердження також може прийти на email."},
        {q:"Як пройти на подію з QR-квитком?",a:"Відкрий QR-код квитка та покажи його персоналу на вході. Квиток дійсний лише для вказаної події; після успішного сканування повторно використати QR не можна."},
        {q:"Чи можу я скасувати квиток?",a:"Відкрий квиток і скористайся скасуванням, якщо воно доступне. Скасований QR більше не дійсний. Умови перенесення й повернення коштів уточнюй в організатора."},
        {q:"Що робити, якщо місць більше немає?",a:"Якщо доступний список очікування, приєднайся. Коли з'явиться місце, дотримуйся інструкцій і терміну в повідомленні. Список очікування не гарантує квиток."}
      ]},
      {title:"Оплата та скасування",items:[
        {q:"Чи можна оплатити карткою через TicketTreat?",a:"Поки ні. Під час пілоту оплату за платні події здійснюють напряму організатору, а не через TicketTreat. Не надсилай дані банківської картки в підтримку."},
        {q:"Коли я отримаю квиток на платну подію?",a:"Запит із оплатою організатору може утримувати місце до 24 годин. QR-квиток активується після підтвердження оплати організатором. Без підтвердження бронювання може завершитися."},
        {q:"Що робити, якщо подію скасовано або потрібне повернення коштів?",a:"З питаннями оплати й повернення звертайся до організатора або продавця за договором. Підтримка TicketTreat допомагає з платформою, але не повертає гроші, перераховані організатору."}
      ]},
      {title:"Підтримка і дані",items:[
        {q:"Як звернутися до підтримки TicketTreat?",a:"Відкрий сторінку підтримки й увійди до акаунта, щоб створити звернення. Відповідь буде в переписці та на підтвердженому email."},
        {q:"Як отримати інформацію про мої персональні дані?",a:"Прочитай Політику конфіденційності або напиши на privacy@tickettreat.eu. Не надсилай паролі, банківські дані чи іншу конфіденційну інформацію."}
      ]}
    ]
  }
};
export function FaqClient(){
  const {language}=useLanguage();
  const t=copy[language];
  const [search,setSearch]=useState("");
  const needle=search.trim().toLocaleLowerCase(language);
  const sections=t.sections.map(section=>({...section,items:section.items.filter(item=>
    !needle || (item.q+" "+item.a).toLocaleLowerCase(language).includes(needle))})).filter(section=>section.items.length>0);
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-faq-page">
      <Link href="/" className="back-link">← TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / FAQ</p>
      <h1>{t.title}</h1>
      <p className="tt-faq-intro">{t.intro}</p>
      <div className="tt-faq-search">
        <label htmlFor="tt-faq-search">{t.search}</label>
        <input id="tt-faq-search" type="search" value={search} onChange={event=>setSearch(event.target.value)}
          placeholder={t.search} autoComplete="off"/>
      </div>
      {sections.length===0?<p className="state-card" role="status">{t.empty}</p>:
        <div className="tt-faq-groups">
          {sections.map((section,i)=><section className="tt-faq-group" key={section.title} aria-labelledby={`faq-group-${i}`}>
            <h2 id={`faq-group-${i}`}>{section.title}</h2>
            <div className="tt-faq-items">{section.items.map(item=><details className="tt-faq-item" key={item.q}>
              <summary>{item.q}<span className="tt-faq-toggle" aria-hidden="true">+</span></summary>
              <p>{item.a}</p>
            </details>)}</div>
          </section>)}
        </div>}
      <section className="tt-faq-help" aria-labelledby="faq-help-title">
        <div><h2 id="faq-help-title">{t.supportTitle}</h2><p>{t.supportIntro}</p></div>
        <Link className="button button-primary" href="/support">{t.supportLink}</Link>
      </section>
      <nav className="tt-faq-quicklinks" aria-label="TicketTreat">
        <Link href="/tickets">{t.ticketLink}</Link>
        <Link href="/profile">{t.profileLink}</Link>
        <Link href="/privacy-policy">{t.privacyLink}</Link>
      </nav>
    </main>
  </div>;
}
