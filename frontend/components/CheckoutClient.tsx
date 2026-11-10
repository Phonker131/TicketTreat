"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { createDemoGuest, demoCheckout, getEvent, joinWaitlist, getBookingConfig, getWaitlistOfferStatus,claimWaitlistOffer,declineWaitlistOffer,requestQuickSignup,confirmQuickSignup } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { getStoredGuestToken, restoreGuest, storeGuest,setWebAuth } from "@/lib/session";
import type { TicketTreatEvent, DemoGuest, } from "@/lib/types";

const CHECKOUT_TEXT={"en":{"reserved":"A place has been reserved for you. Confirm it before the deadline.","codeSent":"If eligible, a sign-up code has been sent.","confirmed":"Email verified. You can now get your free ticket.","declined":"Offer declined.","declineConfirm":"Decline the available place?","quickIntro":"No password needed: enter your name and email, then confirm a one-time code.","accept":"I have reviewed the ","and":"and ","getCode":"Send sign-up code","oneTime":"One-time 8-digit code","verify":"Verify and continue","paymentUnavailable":"Paid ticket sales are not available yet. Please check back later.","quickTitle":"Quick signup","alreadyBot":"You are already registered through the Telegram bot. See your bot registration in My tickets."},"cs":{"reserved":"Místo je pro vás rezervováno. Potvrďte ho před uplynutím lhůty.","codeSent":"Pokud je účet způsobilý, byl odeslán registrační kód.","confirmed":"E-mail byl ověřen. Nyní můžete získat vstupenku zdarma.","declined":"Nabídka byla odmítnuta.","declineConfirm":"Odmítnout nabídnuté místo?","quickIntro":"Bez hesla: vyplňte jméno a e-mail a potvrďte jednorázový kód.","accept":"Seznámil/a jsem se s ","and":"a ","getCode":"Odeslat registrační kód","oneTime":"Jednorázový osmimístný kód","verify":"Ověřit e-mail a pokračovat","paymentUnavailable":"Prodej placených vstupenek zatím není dostupný. Zkuste to později.","quickTitle":"Rychlá registrace","alreadyBot":"Už jste zaregistrováni přes Telegram bota. Registraci najdete v sekci Moje vstupenky."},"ru":{"reserved":"Место зарезервировано для тебя. Подтверди его до указанного срока.","codeSent":"Если аккаунт подходит для регистрации, код отправлен.","confirmed":"Email подтверждён. Теперь можно получить бесплатный билет.","declined":"Предложение отклонено.","declineConfirm":"Отказаться от предложенного места?","quickIntro":"Без пароля: укажи имя, email и подтверди одноразовый код. Билет станет доступен после проверки почты.","accept":"Я ознакомился с ","and":"и ","getCode":"Получить код на email","oneTime":"Одноразовый код (8 цифр)","verify":"Подтвердить email","paymentUnavailable":"Продажа платных билетов пока недоступна. Попробуй позже.","quickTitle":"Быстрая регистрация","alreadyBot":"Ты уже записан на этот ивент через Telegram-бота. Запись видна в разделе «Мои билеты»."},"uk":{"reserved":"Місце зарезервовано для тебе. Підтвердь його до кінця терміну.","codeSent":"Якщо акаунт підходить для реєстрації, код надіслано.","confirmed":"Email підтверджено. Тепер можна отримати безкоштовний квиток.","declined":"Пропозицію відхилено.","declineConfirm":"Відмовитися від запропонованого місця?","quickIntro":"Без пароля: введи ім’я, email і підтвердь одноразовий код. Квиток стане доступним після перевірки пошти.","accept":"Я ознайомився з ","and":"та ","getCode":"Отримати код на email","oneTime":"Одноразовий код (8 цифр)","verify":"Підтвердити email","paymentUnavailable":"Продаж платних квитків поки недоступний. Спробуй пізніше.","quickTitle":"Швидка реєстрація","alreadyBot":"Ти вже зареєстрований через Telegram-бота. Запис доступний у розділі «Мої квитки»."}};

export function CheckoutClient() {
  const params = useParams<{id: string}>();
  const router = useRouter();
  const search = useSearchParams();
  const { language } = useLanguage();
  const txt=CHECKOUT_TEXT[language];
  const show=(value:string)=>value.startsWith("msg:")?txt[value.slice(4) as keyof typeof txt]||value:value;

  const eventId = Number(params?.id);
  const wantsWaitlist = search.get("waitlist") === "1";
  const candidate=search.get("invite");
  const invite=candidate&&/^[A-Za-z0-9_-]{43}$/.test(candidate)?candidate:null;
  const rawSource=(search.get("utm_source")||search.get("ref")||"direct").toLowerCase();
  const attributionSource=/^[a-z0-9_-]{1,40}$/.test(rawSource)?rawSource:"direct";

  const [event, setEvent] = useState<TicketTreatEvent | null>(null);
  const [guest, setGuest] = useState<DemoGuest | null>(null);
  const [loadingGuest, setLoadingGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offer,setOffer]=useState<{status:string;expires_at:string|null;position:number|null}|null>(null);
  const [bookingConfig,setBookingConfig] = useState<{demo_payment_mode:boolean;verified_accounts_required:boolean}|null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [quickCode,setQuickCode]=useState("");
  const [quickSent,setQuickSent]=useState(false);
  const [privacyAccepted,setPrivacyAccepted]=useState(false);

  useEffect(() => {
    if (!Number.isFinite(eventId)) return;
    getEvent(eventId,undefined,invite).then(setEvent).catch(err => setMessage(userFacingError(err,language)));
  }, [eventId, language, invite]);

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
  const registerLabel = isFree
    ? (language === "ru" ? "Получить бесплатный билет" : language === "uk" ? "Отримати безкоштовний квиток" : language === "cs" ? "Získat vstupenku zdarma" : "Get free ticket")
    : (language === "ru" ? "Записаться и получить билет" : language === "uk" ? "Записатись і отримати квиток" : language === "cs" ? "Registrovat se a získat vstupenku" : "Register and get ticket");
  const paidNotice = language === "ru" ? "Запись подтверждается сразу и выдаётся QR-билет. TicketTreat не принимает и не проверяет оплату: о способе оплаты договаривайся с организатором отдельно." :
    language === "uk" ? "Запис підтверджується відразу, QR-квиток видається одразу. TicketTreat не приймає й не перевіряє оплату: домовляйся з організатором окремо." :
    language === "cs" ? "Registrace a QR vstupenka se vydají okamžitě. TicketTreat platby nevybírá ani neověřuje; platební podmínky řešte samostatně s pořadatelem." :
    "Registration immediately issues a QR ticket. TicketTreat does not collect or verify payment; arrange payment terms separately with the organizer.";

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
    setBusy(true);
    setMessage(null);
    try {
      if(offer?.status==="offered"){
        const result=await claimWaitlistOffer(event.id,language,invite);
        router.push(`/tickets/${result.ticket.id}?registered=1`);
        return;
      }
      if (wantsWaitlist || event.spots_left === 0) {
        const result = await joinWaitlist(event.id, guest.access_token,invite);
        if(result.status==="offered"){
          const next=await getWaitlistOfferStatus(event.id);setOffer(next);
          setMessage("msg:reserved");
        }else{
          setMessage(`${t(language, "waitlistJoined")}${result.position ? ` #${result.position}` : ""}`);
        }
        return;
      }

      const result = await demoCheckout(event.id, guest.access_token, language, attributionSource,invite);
      router.push(`/tickets/${result.ticket.id}?registered=1`);
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

        {!event || loadingGuest ? (
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

            {!isFree&&<p className="state-card" role="status">{paidNotice}</p>}
            {!guest ? (
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
                    <h2>{isFree?freeLabel:price}</h2>
                    <p className="demo-banner">{isFree?(
                      language === "ru" ? "Оплата не нужна. После регистрации сразу получишь QR-билет." :
                      language === "uk" ? "Оплата не потрібна. QR-квиток буде доступний одразу." :
                      language === "cs" ? "Platba není potřeba. QR vstupenka bude připravena ihned." :
                      "No payment required. Your QR ticket will be ready immediately."
                    ):paidNotice}</p>
              <p className="tt-legal-at-collection">
                {language==="ru"?"Регистрация и обработка данных выполняются по ":language==="uk"?"Реєстрація та обробка даних здійснюються відповідно до ":language==="cs"?"Informace o registraci a zpracování osobních údajů: ":"Registration and data handling: "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer">{language==="ru"?"условиям использования":language==="uk"?"умов користування":language==="cs"?"Obchodní podmínky":"Terms of Service"}</Link>
                {" · "}
                <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">{language==="ru"?"политика конфиденциальности":language==="uk"?"політика конфіденційності":language==="cs"?"Ochrana osobních údajů":"Privacy Policy"}</Link>.
              </p>
                    <button className="button button-primary button-wide" onClick={performCheckout} disabled={busy}>
                      {busy ? t(language, "loading") : registerLabel}
                    </button>
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
