"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { createDemoGuest, demoCheckout, getEvent, joinWaitlist, getBookingConfig, getWaitlistOfferStatus,claimWaitlistOffer,declineWaitlistOffer,requestQuickSignup,confirmQuickSignup, requestPaidReservation, getOwnPaidReservation } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { getStoredGuestToken, restoreGuest, storeGuest,setWebAuth } from "@/lib/session";
import type { TicketTreatEvent, DemoGuest, } from "@/lib/types";
import type {PaidReservationStatus} from "@/lib/api";

const CHECKOUT_TEXT={"en":{"reserved":"A place has been reserved for you. Confirm it before the deadline.","codeSent":"If eligible, a sign-up code has been sent.","confirmed":"Email verified. You can now get your free ticket.","declined":"Offer declined.","declineConfirm":"Decline the available place?","quickIntro":"No password needed: enter your name and email, then confirm a one-time code.","accept":"I have reviewed the ","and":"and ","getCode":"Send sign-up code","oneTime":"One-time 8-digit code","verify":"Verify and continue","paymentUnavailable":"Paid ticket sales are not available yet. Please check back later.","quickTitle":"Quick signup","alreadyBot":"You are already registered through the Telegram bot. See your bot registration in My tickets."},"cs":{"reserved":"Místo je pro vás rezervováno. Potvrďte ho před uplynutím lhůty.","codeSent":"Pokud je účet způsobilý, byl odeslán registrační kód.","confirmed":"E-mail byl ověřen. Nyní můžete získat vstupenku zdarma.","declined":"Nabídka byla odmítnuta.","declineConfirm":"Odmítnout nabídnuté místo?","quickIntro":"Bez hesla: vyplňte jméno a e-mail a potvrďte jednorázový kód.","accept":"Seznámil/a jsem se s ","and":"a ","getCode":"Odeslat registrační kód","oneTime":"Jednorázový osmimístný kód","verify":"Ověřit e-mail a pokračovat","paymentUnavailable":"Prodej placených vstupenek zatím není dostupný. Zkuste to později.","quickTitle":"Rychlá registrace","alreadyBot":"Už jste zaregistrováni přes Telegram bota. Registraci najdete v sekci Moje vstupenky."},"ru":{"reserved":"Место зарезервировано для тебя. Подтверди его до указанного срока.","codeSent":"Если аккаунт подходит для регистрации, код отправлен.","confirmed":"Email подтверждён. Теперь можно получить бесплатный билет.","declined":"Предложение отклонено.","declineConfirm":"Отказаться от предложенного места?","quickIntro":"Без пароля: укажи имя, email и подтверди одноразовый код. Билет станет доступен после проверки почты.","accept":"Я ознакомился с ","and":"и ","getCode":"Получить код на email","oneTime":"Одноразовый код (8 цифр)","verify":"Подтвердить email","paymentUnavailable":"Продажа платных билетов пока недоступна. Попробуй позже.","quickTitle":"Быстрая регистрация","alreadyBot":"Ты уже записан на этот ивент через Telegram-бота. Запись видна в разделе «Мои билеты»."},"uk":{"reserved":"Місце зарезервовано для тебе. Підтвердь його до кінця терміну.","codeSent":"Якщо акаунт підходить для реєстрації, код надіслано.","confirmed":"Email підтверджено. Тепер можна отримати безкоштовний квиток.","declined":"Пропозицію відхилено.","declineConfirm":"Відмовитися від запропонованого місця?","quickIntro":"Без пароля: введи ім’я, email і підтвердь одноразовий код. Квиток стане доступним після перевірки пошти.","accept":"Я ознайомився з ","and":"та ","getCode":"Отримати код на email","oneTime":"Одноразовий код (8 цифр)","verify":"Підтвердити email","paymentUnavailable":"Продаж платних квитків поки недоступний. Спробуй пізніше.","quickTitle":"Швидка реєстрація","alreadyBot":"Ти вже зареєстрований через Telegram-бота. Запис доступний у розділі «Мої квитки»."}};
type PaymentMethod = "card" | "apple" | "google";

export function CheckoutClient() {
  const params = useParams<{id: string}>();
  const router = useRouter();
  const search = useSearchParams();
  const { language } = useLanguage();
  const txt=CHECKOUT_TEXT[language];
  const show=(value:string)=>value.startsWith("msg:")?txt[value.slice(4) as keyof typeof txt]||value:value;

  const eventId = Number(params?.id);
  const wantsWaitlist = search.get("waitlist") === "1";
  const rawSource=(search.get("utm_source")||search.get("ref")||"direct").toLowerCase();
  const attributionSource=/^[a-z0-9_-]{1,40}$/.test(rawSource)?rawSource:"direct";

  const [event, setEvent] = useState<TicketTreatEvent | null>(null);
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [loadingGuest, setLoadingGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offer,setOffer]=useState<{status:string;expires_at:string|null;position:number|null}|null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [bookingConfig,setBookingConfig] = useState<{demo_payment_mode:boolean;verified_accounts_required:boolean}|null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [quickCode,setQuickCode]=useState("");
  const [quickSent,setQuickSent]=useState(false);
  const [privacyAccepted,setPrivacyAccepted]=useState(false);

  useEffect(() => {
    if (!Number.isFinite(eventId)) return;
    getEvent(eventId).then(setEvent).catch(err => setMessage(userFacingError(err,language)));
  }, [eventId, language]);

  useEffect(()=>{getBookingConfig().then(setBookingConfig).catch(()=>setBookingConfig({demo_payment_mode:false,verified_accounts_required:true}));},[]);

  useEffect(() => {
    restoreGuest()
      .then(setGuest)
      .catch(err => setMessage(userFacingError(err,language)))
      .finally(() => setLoadingGuest(false));
  }, []);

  useEffect(()=>{
    if(!guest||!eventId)return;
    let active=true;
    void getWaitlistOfferStatus(eventId).then(value=>{if(active)setOffer(value)}).catch(()=>{});
    return()=>{active=false};
  },[guest,eventId]);
  const price = useMemo(() => event ? formatPrice(event, language) : "", [event, language]);
  const isFree = Boolean(event && Number(event.price || 0) <= 0);
  const freeLabel = language === "ru" ? "Бесплатно" : language === "uk" ? "Безкоштовно" :
    language === "cs" ? "Zdarma" : "Free";
  const registerLabel = language === "ru" ? "Получить бесплатный билет" :
    language === "uk" ? "Отримати безкоштовний квиток" :
    language === "cs" ? "Získat vstupenku zdarma" : "Get free ticket";

  async function submitGuest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const created = await createDemoGuest({
        first_name: firstName,
        last_name: lastName || null,
        email,
      });
      storeGuest(created);
      setGuest(created);
    } catch (err) {
      setMessage(userFacingError(err,language));
    } finally {
      setBusy(false);
    }
  }

  async function performCheckout() {
    if (!event || !guest) return;
    if (!isFree) {
      // Pilot contract: paid events are settled directly with the organizer.
      // Never call the mock payment endpoint or mark an unpaid booking as paid.
      setMessage(language==="ru"?"Оплата проводится напрямую организатору, не через TicketTreat.":language==="cs"?"Platba probíhá přímo pořadateli, nikoli přes TicketTreat.":language==="uk"?"Оплата проводиться безпосередньо організатору, а не через TicketTreat.":"Payment is handled directly by the organizer, not by TicketTreat.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if(offer?.status==="offered"){
        const result=await claimWaitlistOffer(event.id,language);
        router.push(`/tickets/${result.ticket.id}?registered=1`);
        return;
      }
      if (wantsWaitlist || event.spots_left === 0) {
        const result = await joinWaitlist(event.id, guest.access_token);
        if(result.status==="offered"){
          const next=await getWaitlistOfferStatus(event.id);setOffer(next);
          setMessage("msg:reserved");
        }else{
          setMessage(`${t(language, "waitlistJoined")}${result.position ? ` #${result.position}` : ""}`);
        }
        return;
      }

      if (!isFree) await new Promise((resolve) => setTimeout(resolve, 900));
      const result = await demoCheckout(event.id, guest.access_token, language, attributionSource);
      router.push(`/tickets/${result.ticket.id}${isFree ? "?registered=1" : "?paid=1"}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Error";
      if (text === "event_full") {
        setMessage(t(language, "soldOut"));
      } else if (text === "already_registered_via_bot") {
        setMessage("msg:alreadyBot");
      } else {
        setMessage(userFacingError(err,language));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="checkout-header">
          {bookingConfig?.demo_payment_mode && <span className="status status-demo">{t(language, "demo")}</span>}
          <h1>{t(language, "checkout")}</h1>
          {bookingConfig?.demo_payment_mode && <p>{t(language, "demoHint")}</p>}
        </div>

        {!event || (isFree && loadingGuest) ? (
          <div className="state-card">{t(language, "loading")}</div>
        ) : (
          <>
            <section className="checkout-summary">
              <div>
                <small>{event.organizer || "TicketTreat"}</small>
                <h2>{event.title}</h2>
              </div>
              <strong>{isFree ? freeLabel : price}</strong>
            </section>

            {!isFree ? (
              <PaidCheckout event={event} guest={guest} language={language} source={attributionSource}/>
            ) : !guest ? (
              <>
              <section className="panel account-signup-banner">
                <h2>{language === "en" ? "Create your TicketTreat profile" : language === "cs" ? "Vytvoř si profil TicketTreat" : language === "uk" ? "Створи профіль TicketTreat" : "Создай профиль TicketTreat"}</h2>
                <p>{language === "en" ? "Sign up or log in to save your tickets and access them from any device." : language === "cs" ? "Přihlas se nebo zaregistruj, abys měl vstupenky na všech zařízeních." : language === "uk" ? "Зареєструйся або увійди, щоб квитки були доступні з будь-якого пристрою." : "Зарегистрируйся или войди, чтобы билеты сохранялись в профиле и были доступны с любого устройства."}</p>
                <Link href="/profile" className="button button-primary">
                  {language === "en" ? "Sign up / Log in" : language === "cs" ? "Registrovat / Přihlásit se" : language === "uk" ? "Реєстрація / Вхід" : "Регистрация / Вход"}
                </Link>
              </section>
              {bookingConfig?.verified_accounts_required&&<section className="panel form-stack">
                <h3>{language==="ru"?"Быстрая регистрация":language==="cs"?"Rychlá registrace":language==="uk"?"Швидка реєстрація":"Quick signup"}</h3>
                <p className="form-note">{txt.quickIntro}</p>
                <label>{t(language,"firstName")}<input required value={firstName} maxLength={100}
                  autoComplete="given-name" onChange={e=>setFirstName(e.target.value)}/></label>
                <label>Email<input type="email" required value={email} autoComplete="email"
                  onChange={e=>{setEmail(e.target.value);setQuickSent(false);}}/></label>
                <label style={{display:"flex",alignItems:"start",gap:10}}>
                  <input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)}/>
                  <span>{txt.accept}
                    <Link href="/terms">{language==="ru"?"условиями использования":language==="cs"?"obchodními podmínkami":language==="uk"?"умовами користування":"Terms of Service"}</Link>
                    {" "}{txt.and}
                    <Link href="/privacy-policy">{language==="ru"?"политикой конфиденциальности":language==="cs"?"zásadami ochrany osobních údajů":language==="uk"?"політикою конфіденційності":"Privacy Policy"}</Link>.
                  </span>
                </label>
                <button className="button button-outline" type="button"
                  disabled={busy||!email.includes("@")||!firstName.trim()||!privacyAccepted}
                  onClick={async()=>{setBusy(true);setMessage(null);try{
                    await requestQuickSignup(email,firstName,privacyAccepted);
                    setQuickSent(true);setMessage("msg:codeSent");
                  }catch(e){setMessage(userFacingError(e,language));}finally{setBusy(false);}}}>
                  {txt.getCode}
                </button>
                {quickSent&&<form className="form-stack" onSubmit={async(e)=>{e.preventDefault();setBusy(true);setMessage(null);
                  try{const auth=await confirmQuickSignup(email,quickCode);setWebAuth(auth);
                    setGuest(auth.profile.guest);setQuickCode("");setQuickSent(false);
                    setMessage("msg:confirmed");
                  }catch(err){setMessage(userFacingError(err,language));}finally{setBusy(false);}}}>
                  <label>{txt.oneTime}
                    <input type="text" name="one-time-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8}
                      required value={quickCode} onChange={e=>setQuickCode(e.target.value)}/>
                  </label>
                  <button className="button button-primary" disabled={busy||quickCode.length!==8}>
                    {txt.verify}
                  </button>
                </form>}
              </section>}
              {!bookingConfig?.verified_accounts_required && <form className="panel form-stack" onSubmit={submitGuest}>
                <h2>{language === "en" ? "Or continue as a demo guest" : language === "cs" ? "Nebo pokračuj jako demo host" : language === "uk" ? "Або продовж як демо-гість" : "Или продолжить как демо-гость"}</h2>
                <h2>{t(language, "yourDetails")}</h2>
                <label>{t(language, "firstName")}<input required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
                <label>{t(language, "lastName")}<input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
                <label>{t(language, "email")}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                              <p className="tt-legal-at-collection">
                {language==="ru"?"Регистрация и обработка данных выполняются по ":language==="uk"?"Реєстрація та обробка даних здійснюються відповідно до ":language==="cs"?"Informace o registraci a zpracování osobních údajů: ":"Registration and data handling: "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer">{language==="ru"?"условиям использования":language==="uk"?"умов користування":language==="cs"?"Obchodní podmínky":"Terms of Service"}</Link>
                {" · "}
                <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">{language==="ru"?"политика конфиденциальности":language==="uk"?"політика конфіденційності":language==="cs"?"Ochrana osobních údajů":"Privacy Policy"}</Link>.
              </p>
                <button className="button button-primary" disabled={busy}>{busy ? t(language, "loading") : t(language, "continue")}</button>
              </form>}
              </>
            ) : (
              <section className="panel">
                <div className="guest-chip">
                  <div className="avatar">{guest.first_name.charAt(0).toUpperCase()}</div>
                  <div><strong>{guest.first_name} {guest.last_name || ""}</strong><small>{guest.email || `Telegram ${guest.telegram_id}`}</small></div>
                </div>

                {offer?.status==="offered" ? (
                  <section className="form-stack" aria-live="polite">
                    <h2>{language==="ru"?"Ваше место освободилось":language==="cs"?"Místo je pro vás připraveno":language==="uk"?"Місце для вас доступне":"Your seat is available"}</h2>
                    <p>{language==="ru"?"Место временно зарезервировано до:":language==="cs"?"Rezervace platí do:":language==="uk"?"Резервація діє до:":"Reserved until:"}{" "}
                      <strong>{offer.expires_at?new Date(offer.expires_at).toLocaleString():"—"}</strong></p>
                    <button className="button button-primary button-wide" disabled={busy}
                      onClick={performCheckout}>{busy?t(language,"loading"):registerLabel}</button>
                    <button className="button button-outline" disabled={busy} onClick={async()=>{
                      if(!window.confirm(txt.declineConfirm))return;
                      setBusy(true);
                      try{await declineWaitlistOffer(event.id);setOffer({status:"declined",expires_at:null,position:null});
                        setMessage("msg:declined");}
                      catch(err){setMessage(userFacingError(err,language));}
                      finally{setBusy(false);}
                    }}>{language==="ru"?"Отказаться от места":language==="cs"?"Odmítnout místo":language==="uk"?"Відмовитись від місця":"Decline offer"}</button>
                  </section>
                ) : wantsWaitlist || event.spots_left === 0 ? (
                  <>
                    <h2>{t(language, "waitlist")}</h2>
                    <p>{t(language, "soldOut")}</p>
                    <button className="button button-sun button-wide" onClick={performCheckout} disabled={busy}>
                      {busy ? t(language, "loading") : t(language, "waitlist")}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>{isFree ? freeLabel : t(language, "payment")}</h2>
                    {isFree ? <p className="demo-banner">{
                      language === "ru" ? "Оплата не нужна. После регистрации сразу получишь QR-билет." :
                      language === "uk" ? "Оплата не потрібна. QR-квиток буде доступний одразу." :
                      language === "cs" ? "Platba není potřeba. QR vstupenka bude připravena ihned." :
                      "No payment required. Your QR ticket will be ready immediately."
                    }</p> : !bookingConfig?.demo_payment_mode ? <div className="state-card">{txt.paymentUnavailable}</div> : <>
                    <div className="demo-banner">{t(language, "demoHint")}</div>
                    <div className="payment-methods">
                      {[
                        ["card", "💳", t(language, "card")],
                        ["apple", "", t(language, "applePay")],
                        ["google", "G", t(language, "googlePay")],
                      ].map(([key, icon, label]) => (
                        <button
                          type="button"
                          key={key}
                          className={`payment-method ${method === key ? "selected" : ""}`}
                          onClick={() => setMethod(key as PaymentMethod)}
                        >
                          <span>{icon}</span><strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                    {method === "card" && (
                      <div className="fake-card-fields">
                        <input value="4242 4242 4242 4242" readOnly aria-label="Demo card number" />
                        <div><input value="12/30" readOnly aria-label="Expiry" /><input value="123" readOnly aria-label="CVC" /></div>
                      </div>
                    )}
                    </>}
              <p className="tt-legal-at-collection">
                {language==="ru"?"Регистрация и обработка данных выполняются по ":language==="uk"?"Реєстрація та обробка даних здійснюються відповідно до ":language==="cs"?"Informace o registraci a zpracování osobních údajů: ":"Registration and data handling: "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer">{language==="ru"?"условиям использования":language==="uk"?"умов користування":language==="cs"?"Obchodní podmínky":"Terms of Service"}</Link>
                {" · "}
                <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">{language==="ru"?"политика конфиденциальности":language==="uk"?"політика конфіденційності":language==="cs"?"Ochrana osobních údajů":"Privacy Policy"}</Link>.
              </p>
                    {(isFree || bookingConfig?.demo_payment_mode) && <button className="button button-primary button-wide" onClick={performCheckout} disabled={busy}>
                      {busy ? t(language, "loading") : isFree ? registerLabel : `${t(language, "pay")} ${price}`}
                    </button>}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {message && <div className="state-card">{show(message)}</div>}
      </main>
    </div>
  );
}

function PaidCheckout({event,guest,language,source}:{
  event:TicketTreatEvent;guest:DemoGuest|null;
  language:"en"|"cs"|"ru"|"uk";source:string;
}){
  const [state,setState]=useState<PaidReservationStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [copiedInstructions,setCopiedInstructions]=useState(false);
  const [error,setError]=useState("");
  const [currentTime,setCurrentTime]=useState(()=>Date.now());
  const refresh=()=>getOwnPaidReservation(event.id).then(setState).catch(e=>setError(userFacingError(e,language)));
  useEffect(()=>{
    if(!guest)return;
    void refresh();
    const poll=window.setInterval(()=>{
      if(document.visibilityState==="visible")void refresh();
    },30000);
    return()=>window.clearInterval(poll);
  },[event.id,guest?.id]);
  useEffect(()=>{
    const tick=window.setInterval(()=>setCurrentTime(Date.now()),1000);
    return()=>window.clearInterval(tick);
  },[]);
  const pending=state?.status==="pending"&&state.reservation;
  const remains=pending?Math.max(0,new Date(pending.expires_at).getTime()-currentTime):0;
  const time=remains>0?`${Math.floor(remains/3600000).toString().padStart(2,"0")}:${Math.floor(remains%3600000/60000).toString().padStart(2,"0")}:${Math.floor(remains%60000/1000).toString().padStart(2,"0")}`:"00:00:00";
  const label=(en:string,ru:string,cs:string,uk:string)=>language==="ru"?ru:language==="cs"?cs:language==="uk"?uk:en;
  async function apply(){
    setBusy(true);setError("");
    try{
      await requestPaidReservation(event.id,language,source);
      await refresh();
    }catch(e){setError(userFacingError(e,language))}
    finally{setBusy(false)}
  }
  return <section className="panel form-stack">
    <h2>{label("Organizer-direct payment","Оплата напрямую организатору","Platba přímo pořadateli","Оплата безпосередньо організатору")}</h2>
    <p>{label("TicketTreat does not receive payments. Your application holds a place for up to 24 hours. Only the organizer can confirm receipt of your payment and activate a QR ticket.",
    "TicketTreat не принимает деньги. Заявка резервирует место на срок до 24 часов. Только организатор подтверждает получение оплаты и активирует QR-билет.",
    "TicketTreat nepřijímá platby. Žádost rezervuje místo až na 24 hodin. Pouze pořadatel potvrdí přijetí platby a aktivuje QR vstupenku.",
    "TicketTreat не приймає кошти. Заявка резервує місце до 24 годин. Лише організатор підтверджує оплату та активує QR-квиток.")}</p>
    <p><strong>{label("Organizer","Организатор","Pořadatel","Організатор")}:</strong> {event.organizer||"—"}</p>
    {!guest ? <>
      <p>{label("Sign in to apply. Your application and deadline will be linked to your verified account.",
      "Войди в аккаунт, чтобы встать в очередь на подтверждение оплаты.",
      "Přihlas se, abys požádal o rezervaci a následné potvrzení platby.",
      "Увійди до акаунта, щоб подати заявку на підтвердження оплати.")}</p>
      <Link className="button button-primary" href="/profile">{label("Sign in","Войти","Přihlásit se","Увійти")}</Link>
    </>:<>
      {!state&&<p role="status">{label("Loading reservation status…","Загружаем статус…","Načítání stavu…","Завантажуємо статус…")}</p>}
      {pending&&remains>0&&<>
        <div className="state-card" role="status">
          <strong>{label("Awaiting organizer's payment confirmation","Ожидание подтверждения оплаты","Čeká se na potvrzení platby","Очікується підтвердження оплати")}</strong>
          <p>{label("Time remaining","Осталось времени","Zbývající čas","Залишилося часу")}: <strong>{time}</strong></p>
          <p>{label("If the organizer does not confirm payment in time, your reservation expires and the place becomes available again.",
          "Если организатор не подтвердит оплату до истечения срока, заявка автоматически аннулируется и место освободится.",
          "Pokud pořadatel platbu včas nepotvrdí, rezervace vyprší a místo se uvolní.",
          "Якщо організатор не підтвердить оплату вчасно, заявку буде скасовано і місце звільниться.")}</p>
        </div>
        {state?.payment_instructions&&<div className="state-card tt-payment-direct-instructions">
          <strong>{label("Organizer payment instructions","Инструкция по оплате от организатора","Pokyny k platbě od pořadatele","Інструкція з оплати від організатора")}</strong>
          <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{state.payment_instructions}</p>
          <button type="button" className="button button-secondary" onClick={()=>{
            if(!state.payment_instructions)return;
            void navigator.clipboard.writeText(state.payment_instructions).then(()=>{
              setCopiedInstructions(true);
            }).catch(()=>setError(label("Select and copy the instructions above.","Выдели и скопируй инструкцию выше.","Označ a zkopíruj pokyny výše.","Виділи та скопіюй інструкцію вище.")));
          }}>
            {copiedInstructions?label("Copied","Скопировано","Zkopírováno","Скопійовано"):label("Copy payment instructions","Скопировать реквизиты","Zkopírovat platební pokyny","Скопіювати реквізити")}
          </button>
        </div>}
      </>}
      {state?.status==="confirmed"&&<div className="state-card" role="status">
        <strong>{label("Payment confirmed — your ticket is ready","Оплата подтверждена — билет готов","Platba potvrzena — vstupenka je připravena","Оплату підтверджено — квиток готовий")}</strong>
        <p><Link href="/tickets">{label("Open My Tickets","Открыть мои билеты","Moje vstupenky","Мої квитки")}</Link></p>
      </div>}
      {(state?.status==="not_joined"||state?.status==="expired"||state?.status==="declined")&&<>
        {state.status!=="not_joined"&&<p role="status">{label("The previous application is no longer active.","Предыдущая заявка больше не активна.","Předchozí žádost již není aktivní.","Попередня заявка більше не активна.")}</p>}
        <button type="button" className="button button-primary" disabled={busy||event.is_cancelled||event.spots_left===0} onClick={()=>void apply()}>
          {busy?label("Sending…","Отправляем…","Odesílání…","Надсилаємо…"):label("Reserve a place for 24 hours","Забронировать место на 24 часа","Rezervovat místo na 24 hodin","Зарезервувати місце на 24 години")}
        </button>
      </>}
    </>}
    <p className="tt-legal-at-collection"><Link href="/terms">{language==="ru"?"Условия использования":language==="cs"?"Obchodní podmínky":language==="uk"?"Умови користування":"Terms of Service"}</Link> · <Link href="/privacy-policy">{language==="ru"?"Политика конфиденциальности":language==="cs"?"Zásady ochrany osobních údajů":language==="uk"?"Політика конфіденційності":"Privacy Policy"}</Link></p>
    {error&&<p className="state-card state-error" role="alert">{error}</p>}
  </section>;
}
