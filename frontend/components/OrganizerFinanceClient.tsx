"use client";

import Link from "next/link";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {
  acceptFinanceContract,getFinanceContract,getFinanceDocuments,getFinanceEntries,
  getFinanceExport,getFinanceProfile,getFinanceSummary,getFinanceUnlockStatus,
  unlockFinances,updateFinanceProfile,getFinanceExpenses,getFinanceExpenseEvents,
  createFinanceExpense,reverseFinanceExpense,exportFinanceExpenses,
  type FinanceContract,type FinanceEntry,type FinanceProfile,type FinanceSummary,
  type FinanceExpense,type FinanceExpenseInput,
} from "@/lib/api";
import type {LanguageCode} from "@/lib/types";

const WORDS:Record<LanguageCode,Record<string,string>>={
  cs:{
    title:"Finance a elektronické smlouvy",intro:"Přehled ověřených platebních záznamů pořadatele. Rezervace nejsou prodeje ani daňové doklady.",
    back:"Správa akcí",reload:"Obnovit",export:"Stáhnout účetní CSV",loading:"Načítání financí…",
    month:"Měsíc",currency:"Měna",gross:"Tržby (brutto)",refunds:"Vráceno zákazníkům",
    fees:"Poplatky platební brány",net:"Po poplatcích, před daní",tax:"Ověřená DPH z transakcí",
    netTax:"Po ověřené DPH (ne po dani z příjmu)",payouts:"Vyplaceno na účet",
    platform:"Provize TicketTreat",missingTax:"Dosud neověřeno",noSales:"Zatím žádné ověřené transakce. Registrace nejsou započítány jako prodej.",
    entries:"Účetní pohyby",when:"Čas",kind:"Typ",ref:"Reference",amount:"Částka",byEvent:"Podle akce",
    documents:"Dokumentový archiv",noDocuments:"Zatím žádné ověřené dokumenty. Daňové doklady nelze vydávat před nastavením plateb a ověřením vystavitele.",
    contract:"Smlouva s pořadatelem",pending:"Smlouva se připravuje a čeká na právní schválení. Zatím ji nelze elektronicky uzavřít.",
    accepted:"Přijetí této verze je zaznamenáno.",sign:"Souhlasím s touto verzí smlouvy a potvrzuji oprávnění jednat za pořadatele.",
    accept:"Elektronicky přijmout",acceptNote:"Prokazatelné potvrzení přes přihlášený účet s MFA, nikoli kvalifikovaný elektronický podpis.",
    legal:"Faktura / daňový doklad není totožná s potvrzením platby. EET se pro běžné vzdálené online platby obecně neuplatní.",
    profile:"Fakturační údaje pořadatele",name:"Právní název",ico:"IČO (8 číslic)",dic:"DIČ (volitelné)",
    vat:"Postavení k DPH",nonpayer:"Neplátce DPH",payer:"Plátce DPH",exempt:"Osvobozený subjekt",
    save:"Uložit údaje",unverified:"Údaje čekají na ověření. Platby a výplaty zůstávají vypnuté.",
    ready:"Údaje ověřeny",stripe:"Stripe Connect",disconnected:"Nepřipojeno – platby vypnuté",
    connected:"Připojeno (je nutné další ověření)",error:"Nepodařilo se načíst nebo uložit údaje. Zkontrolujte oprávnění a dvoufázové ověření.",
    saved:"Údaje uloženy. Pro nové ověření kontaktujte správce.",
    unlockTitle:"Odemknout finanční kabinet",unlockText:"Finanční údaje vyžadují zvláštní ověření na 15 minut. Zadejte nový kód ze své ověřovací aplikace.",
    otp:"Nový šestimístný kód MFA",unlock:"Odemknout na 15 minut",
    otpNote:"Pro export, změnu údajů nebo přijetí smlouvy zadejte nový kód. Již použitý kód nelze opakovat; počkejte na další.",
  },
  en:{
    title:"Finances and electronic agreements",intro:"Verified financial evidence for your organization. Reservations are not sales or tax documents.",
    back:"Event management",reload:"Refresh",export:"Download accounting CSV",loading:"Loading finances…",
    month:"Month",currency:"Currency",gross:"Gross sales",refunds:"Customer refunds",
    fees:"Payment processing fees",net:"After fees, before tax",tax:"Verified transaction VAT",
    netTax:"After verified VAT (not income tax)",payouts:"Transferred to bank",
    platform:"TicketTreat commission",missingTax:"Not verified yet",noSales:"No verified payments yet. Event registrations are not counted as revenue.",
    entries:"Accounting movements",when:"Time",kind:"Type",ref:"Reference",amount:"Amount",byEvent:"By event",
    documents:"Document archive",noDocuments:"No verified documents. Tax invoices cannot be issued before payment and seller verification are enabled.",
    contract:"Organizer service agreement",pending:"The agreement is being prepared and awaits legal approval. Electronic acceptance is not enabled yet.",
    accepted:"Acceptance of this exact version is recorded.",sign:"I accept this version and confirm my authority to bind the organizer.",
    accept:"Accept electronically",acceptNote:"Auditable acknowledgement from an MFA-protected account, not a qualified electronic signature.",
    legal:"A payment receipt is not automatically a tax invoice. Normal remote online card payments generally do not require EET reporting.",
    profile:"Organizer billing details",name:"Registered legal name",ico:"Czech IČO (8 digits)",dic:"DIČ / VAT ID (optional)",
    vat:"VAT declaration",nonpayer:"Non-VAT payer",payer:"VAT payer",exempt:"Exempt entity",
    save:"Save details",unverified:"Pending verification. Charges and payouts remain disabled.",
    ready:"Identity verified",stripe:"Stripe Connect",disconnected:"Not connected – payments disabled",
    connected:"Connected (further verification required)",error:"Could not load or save the data. Check your role and two-factor verification.",
    saved:"Details saved. An administrator must verify them.",
    unlockTitle:"Unlock financial information",unlockText:"Sensitive finances require a separate 15-minute verification. Enter a fresh authenticator code.",
    otp:"Fresh six-digit MFA code",unlock:"Unlock for 15 minutes",
    otpNote:"Exports, billing changes and agreements need a fresh code. Used codes cannot be replayed; wait for the next code.",
  },
  ru:{
    title:"Финансы и электронные договоры",intro:"Учёт только подтверждённых операций организации. Брони и регистрации — не продажи и не налоговые документы.",
    back:"К управлению ивентами",reload:"Обновить",export:"Скачать CSV для бухгалтера",loading:"Загружаем финансы…",
    month:"Месяц",currency:"Валюта",gross:"Выручка до вычетов",refunds:"Возвраты гостям",
    fees:"Комиссии платёжной системы",net:"После комиссий, до налогов",tax:"Подтверждённый НДС",
    netTax:"За вычетом подтверждённого НДС (без налога на прибыль)",payouts:"Переведено на счёт",
    platform:"Комиссия TicketTreat",missingTax:"Пока не подтверждено",noSales:"Подтверждённых оплат пока нет. Регистрации не считаются выручкой.",
    entries:"Движение средств",when:"Время",kind:"Операция",ref:"Основание",amount:"Сумма",byEvent:"По мероприятиям",
    documents:"Архив документов",noDocuments:"Подтверждённых документов пока нет. Выдача налоговых документов включится только после проверки продавца и оплаты.",
    contract:"Договор с организатором",pending:"Договор готовится и ожидает юридического согласования. Электронное принятие пока недоступно.",
    accepted:"Принятие этой версии договора записано.",sign:"Принимаю эту версию договора и подтверждаю полномочия действовать от имени организатора.",
    accept:"Принять электронно",acceptNote:"Подтверждение из аккаунта с 2FA и журналом действий, не квалифицированная электронная подпись.",
    legal:"Квитанция об оплате не равна налоговому документу. Обычная дистанционная онлайн-оплата, как правило, не подпадает под EET.",
    profile:"Реквизиты организатора",name:"Юридическое название",ico:"IČO (8 цифр)",dic:"DIČ (необязательно)",
    vat:"Статус НДС",nonpayer:"Не плательщик НДС",payer:"Плательщик НДС",exempt:"Освобождён от НДС",
    save:"Сохранить данные",unverified:"Данные ожидают проверки. Приём оплат и выплаты отключены.",
    ready:"Реквизиты проверены",stripe:"Stripe Connect",disconnected:"Не подключён — оплаты отключены",
    connected:"Подключён (требуется проверка)",error:"Не удалось загрузить или сохранить данные. Проверь права и двухфакторную аутентификацию.",
    saved:"Данные сохранены. Администратор должен их проверить.",
    unlockTitle:"Разблокировать финансы",unlockText:"Для доступа к бухгалтерии нужно отдельное подтверждение на 15 минут. Введи новый код из приложения-аутентификатора.",
    otp:"Новый шестизначный код 2FA",unlock:"Открыть на 15 минут",
    otpNote:"Для экспорта, изменения реквизитов и договора нужен отдельный свежий код. Повторно использовать код нельзя — дождись следующего.",
  },
  uk:{
    title:"Фінанси та електронні договори",intro:"Облік лише підтверджених операцій організації. Реєстрації не є продажами чи податковими документами.",
    back:"Керування подіями",reload:"Оновити",export:"Завантажити CSV для обліку",loading:"Завантажуємо фінанси…",
    month:"Місяць",currency:"Валюта",gross:"Валові продажі",refunds:"Повернення гостям",
    fees:"Комісії платіжної системи",net:"Після комісій, до податків",tax:"Підтверджений ПДВ",
    netTax:"Після підтвердженого ПДВ (без податку на прибуток)",payouts:"Переказано на рахунок",
    platform:"Комісія TicketTreat",missingTax:"Поки не підтверджено",noSales:"Підтверджених оплат поки немає. Реєстрації не вважаються доходом.",
    entries:"Рух коштів",when:"Час",kind:"Операція",ref:"Підстава",amount:"Сума",byEvent:"За подіями",
    documents:"Архів документів",noDocuments:"Підтверджених документів поки немає. Податкові документи можна видавати лише після перевірки продавця.",
    contract:"Договір організатора",pending:"Договір готується та очікує юридичного схвалення. Електронне прийняття недоступне.",
    accepted:"Прийняття цієї версії записано.",sign:"Приймаю цю версію та підтверджую право діяти від імені організатора.",
    accept:"Прийняти електронно",acceptNote:"Підтвердження з облікового запису з 2FA, а не кваліфікований електронний підпис.",
    legal:"Підтвердження оплати не є автоматично податковим документом. Звичайні дистанційні онлайн-платежі, як правило, не підпадають під EET.",
    profile:"Реквізити організатора",name:"Юридична назва",ico:"IČO (8 цифр)",dic:"DIČ (необов'язково)",
    vat:"Статус ПДВ",nonpayer:"Не платник ПДВ",payer:"Платник ПДВ",exempt:"Звільнений від ПДВ",
    save:"Зберегти",unverified:"Дані очікують перевірки. Платежі й виплати вимкнені.",
    ready:"Реквізити перевірені",stripe:"Stripe Connect",disconnected:"Не підключено — платежі вимкнені",
    connected:"Підключено (потрібна перевірка)",error:"Не вдалося завантажити дані. Перевір права та 2FA.",
    saved:"Дані збережено. Адміністратор має їх перевірити.",
    unlockTitle:"Розблокувати фінанси",unlockText:"Для бухгалтерії потрібно окреме підтвердження на 15 хвилин. Введи новий код із застосунку.",
    otp:"Новий шестизначний код 2FA",unlock:"Відкрити на 15 хвилин",
    otpNote:"Для експорту, зміни реквізитів і договору потрібен новий код. Повторно використати код не можна.",
  },
};

const EXPENSE_WORDS:Record<LanguageCode,Record<string,string>>={
  cs:{title:"Výdaje pořadatele (vlastní evidence)",intro:"Zapsané náklady nejsou automaticky daňově uznatelné ani ověřené účetní doklady.",
    total:"Čisté zapsané výdaje",add:"Zapsat výdaj",date:"Datum nákladu",category:"Kategorie",event:"Akce",general:"Obecný náklad organizace",amount:"Částka",supplier:"Dodavatel",reference:"Číslo dokladu (neověřené)",note:"Poznámka",create:"Uložit s novým MFA kódem",expenseExport:"Stáhnout CSV výdajů",empty:"Zatím žádné zapsané výdaje.",reverse:"Stornovat záznam",reversal:"Storno",reason:"Důvod storna",undo:"Potvrdit storno",success:"Záznam výdaje uložen. Není daňově ověřen.",reversed:"Storno bylo přidáno do historie.",invalid:"Zadejte kladnou částku s nejvýše dvěma desetinnými místy.",
    venue:"Prostor",staff:"Personál",equipment:"Vybavení",marketing:"Marketing",travel:"Doprava",services:"Služby",other:"Ostatní"},
  en:{title:"Organizer expenses (self-reported)",intro:"Recorded costs are not automatically tax-deductible or verified accounting documents.",
    total:"Net recorded expenses",add:"Record an expense",date:"Expense date",category:"Category",event:"Event",general:"General organization expense",amount:"Amount",supplier:"Supplier",reference:"Document reference (unverified)",note:"Note",create:"Save with fresh MFA code",expenseExport:"Download expense CSV",empty:"No self-reported expenses yet.",reverse:"Reverse entry",reversal:"Reversal",reason:"Reason for reversal",undo:"Confirm reversal",success:"Expense recorded; not tax-verified.",reversed:"An immutable reversal was added.",invalid:"Enter a positive amount with at most two decimal places.",
    venue:"Venue",staff:"Staff",equipment:"Equipment",marketing:"Marketing",travel:"Travel",services:"Services",other:"Other"},
  ru:{title:"Расходы организатора (введённые вручную)",intro:"Такие расходы не считаются автоматически подтверждёнными налоговыми вычетами.",
    total:"Учтённые расходы",add:"Добавить расход",date:"Дата",category:"Категория",event:"Мероприятие",general:"Общий расход организации",amount:"Сумма",supplier:"Поставщик",reference:"Номер документа (не проверен)",note:"Примечание",create:"Сохранить с новым кодом 2FA",expenseExport:"Скачать CSV расходов",empty:"Расходов пока нет.",reverse:"Сторнировать запись",reversal:"Сторно",reason:"Причина сторно",undo:"Подтвердить сторно",success:"Расход записан, налогово не проверен.",reversed:"Добавлена неизменяемая обратная запись.",invalid:"Введите положительную сумму максимум с двумя знаками после запятой.",
    venue:"Аренда",staff:"Персонал",equipment:"Оборудование",marketing:"Маркетинг",travel:"Транспорт",services:"Услуги",other:"Другое"},
  uk:{title:"Витрати організатора (ручний облік)",intro:"Такі витрати не є автоматично підтвердженими податковими відрахуваннями.",
    total:"Записані витрати",add:"Додати витрату",date:"Дата",category:"Категорія",event:"Подія",general:"Загальна витрата організації",amount:"Сума",supplier:"Постачальник",reference:"Номер документа (неперевірений)",note:"Примітка",create:"Зберегти з новим кодом 2FA",expenseExport:"Завантажити CSV витрат",empty:"Витрат ще немає.",reverse:"Сторнувати запис",reversal:"Сторно",reason:"Причина сторно",undo:"Підтвердити сторно",success:"Витрату записано, податково не перевірено.",reversed:"Додано незмінний зворотний запис.",invalid:"Укажіть додатну суму не більше ніж із двома знаками після коми.",
    venue:"Оренда",staff:"Персонал",equipment:"Обладнання",marketing:"Маркетинг",travel:"Транспорт",services:"Послуги",other:"Інше"},
};
const EXPENSE_CATEGORIES=["venue","staff","equipment","marketing","travel","services","other"] as const;

const pragueMonth=()=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Europe/Prague",year:"numeric",month:"2-digit",
}).format(new Date());
function money(amount:number|null,currency:string,language:LanguageCode,unknown:string):string{
  if(amount===null)return unknown;
  return new Intl.NumberFormat(language==="uk"?"uk-UA":language==="ru"?"ru-RU":language==="cs"?"cs-CZ":"en-GB",{
    style:"currency",currency,
  }).format(amount/100);
}
function csvDownload(filename:string,data:string){
  const file=new Blob(["\uFEFF",data],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(file);
  const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function expenseMinor(raw:string):number|null{
  const clean=raw.trim().replace(",",".");
  if(!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(clean))return null;
  const [units,fraction=""]=clean.split(".");
  const amount=Number(units)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(amount)&&amount>0&&amount<=1_000_000_000_000?amount:null;
}

export function OrganizerFinanceClient(){
  const {language}=useLanguage(),t=WORDS[language];
  const x=EXPENSE_WORDS[language];
  const [month,setMonth]=useState(pragueMonth);
  const [currency,setCurrency]=useState<"CZK"|"EUR">("CZK");
  const [summary,setSummary]=useState<FinanceSummary|null>(null);
  const [entries,setEntries]=useState<FinanceEntry[]>([]);
  const [documents,setDocuments]=useState<{id:number;kind:string;document_number:string;issued_at:string}[]>([]);
  const [expenses,setExpenses]=useState<FinanceExpense[]>([]);
  const [expenseTotal,setExpenseTotal]=useState(0);
  const [expenseCategories,setExpenseCategories]=useState<Record<string,number>>({});
  const [expenseEvents,setExpenseEvents]=useState<{id:number;title:string;starts_at:string|null}[]>([]);
  const [contract,setContract]=useState<FinanceContract|null>(null);
  const [profile,setProfile]=useState<FinanceProfile|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [unlocked,setUnlocked]=useState(false);
  const [unlockExpiresAt,setUnlockExpiresAt]=useState<string|null>(null);
  const [unlockCode,setUnlockCode]=useState("");
  const [profileCode,setProfileCode]=useState("");
  const [contractCode,setContractCode]=useState("");
  const [exportCode,setExportCode]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [agreed,setAgreed]=useState(false);
  const [name,setName]=useState(""),[ico,setIco]=useState(""),[dic,setDic]=useState("");
  const [vat,setVat]=useState<"non_payer"|"payer"|"exempt">("non_payer");
  const [expenseDate,setExpenseDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [expenseCategory,setExpenseCategory]=useState<FinanceExpenseInput["category"]>("venue");
  const [expenseEventId,setExpenseEventId]=useState("");
  const [expenseAmount,setExpenseAmount]=useState("");
  const [expenseSupplier,setExpenseSupplier]=useState("");
  const [expenseReference,setExpenseReference]=useState("");
  const [expenseNote,setExpenseNote]=useState("");
  const [expenseCode,setExpenseCode]=useState("");
  const [expenseExportCode,setExpenseExportCode]=useState("");
  const [reverseId,setReverseId]=useState<number|null>(null);
  const [reverseReason,setReverseReason]=useState("");
  const [reverseCode,setReverseCode]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const [financial,rows,docs,agreement,details,manual,eventChoices]=await Promise.all([
        getFinanceSummary(month,currency),getFinanceEntries(month,currency),
        getFinanceDocuments(),getFinanceContract(language==="cs"?"cs":"en"),getFinanceProfile(),
        getFinanceExpenses(month,currency),getFinanceExpenseEvents(),
      ]);
      setSummary(financial);setEntries(rows.entries);setDocuments(docs.documents);
      setExpenses(manual.entries);setExpenseTotal(manual.summary.manual_expenses_minor);
      setExpenseCategories(manual.summary.by_category);
      setExpenseEvents(eventChoices.events);
      setContract(agreement);setProfile(details);
      setName(details.legal_name||"");setIco(details.ico||"");
      setDic(details.dic||"");
      setVat(details.vat_status==="payer"||details.vat_status==="exempt"?details.vat_status:"non_payer");
    }catch(e){
      if(e instanceof Error&&e.message==="finance_unlock_required"){
        setUnlocked(false);setUnlockExpiresAt(null);setSummary(null);setEntries([]);
        setDocuments([]);setExpenses([]);setExpenseTotal(0);setExpenseCategories({});setExpenseEvents([]);
        setContract(null);setProfile(null);
      }else{setError(t.error);}
    }
    finally{setLoading(false);}
  },[month,currency,language,t.error]);
  useEffect(()=>{
    let live=true;
    getFinanceUnlockStatus().then(result=>{
      if(live){setUnlocked(result.unlocked);setUnlockExpiresAt(result.expires_at);
        if(!result.unlocked)setLoading(false);}
    }).catch(()=>{if(live){setError(t.error);setLoading(false);}});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{if(unlocked)void load();},[unlocked,load]);
  useEffect(()=>{
    if(!unlocked||!unlockExpiresAt)return;
    const expire=()=>{
      if(Date.now()<Date.parse(unlockExpiresAt))return;
      setUnlocked(false);setUnlockExpiresAt(null);setSummary(null);setEntries([]);
      setDocuments([]);setExpenses([]);setExpenseTotal(0);setExpenseCategories({});setExpenseEvents([]);
      setContract(null);setProfile(null);
    };
    const delay=Math.max(0,Date.parse(unlockExpiresAt)-Date.now()+50);
    const timeout=window.setTimeout(expire,Math.min(delay,2_147_483_647));
    document.addEventListener("visibilitychange",expire);
    return()=>{window.clearTimeout(timeout);document.removeEventListener("visibilitychange",expire);};
  },[unlocked,unlockExpiresAt]);

  async function unlock(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");
    try{
      const result=await unlockFinances(unlockCode);
      setUnlockCode("");setUnlockExpiresAt(result.expires_at);setUnlocked(true);
    }catch{setError(t.error);}
    finally{setSaving(false);}
  }

  async function saveProfile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const updated=await updateFinanceProfile({legal_name:name.trim(),ico:ico.trim(),
        dic:dic.trim()||null,vat_status:vat,mfa_code:profileCode});
      setProfileCode("");
      setProfile(updated);setNotice(t.saved);
    }catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function accept(){
    if(!agreed||!contract?.contract||contractCode.length!==6)return;
    setSaving(true);setError("");setNotice("");
    try{await acceptFinanceContract(contract.contract.id,contract.contract.sha256,contractCode);
      setContractCode("");setAgreed(false);await load();}
    catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function download(){
    setError("");
    if(exportCode.length!==6)return;
    try{const result=await getFinanceExport(month,currency,exportCode);
      setExportCode("");csvDownload(result.filename,result.csv);}
    catch{setError(t.error);}
  }
  async function recordExpense(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setNotice("");
    const amountMinor=expenseMinor(expenseAmount);
    if(amountMinor===null){setError(x.invalid);return;}
    setSaving(true);
    try{
      await createFinanceExpense({expense_date:expenseDate,category:expenseCategory,
        amount_minor:amountMinor,currency,event_id:expenseEventId?Number(expenseEventId):null,
        supplier:expenseSupplier.trim()||null,reference:expenseReference.trim()||null,
        note:expenseNote.trim()||null,mfa_code:expenseCode});
      setExpenseCode("");setExpenseAmount("");setExpenseSupplier("");
      setExpenseReference("");setExpenseNote("");setNotice(x.success);
      await load();
    }catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function reverseExpense(){
    if(reverseId===null||reverseCode.length!==6||reverseReason.trim().length<4)return;
    setSaving(true);setError("");setNotice("");
    try{
      await reverseFinanceExpense(reverseId,reverseReason.trim(),reverseCode);
      setReverseId(null);setReverseReason("");setReverseCode("");
      setNotice(x.reversed);await load();
    }catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function downloadExpenses(){
    if(expenseExportCode.length!==6)return;
    setError("");
    try{
      const result=await exportFinanceExpenses(month,currency,expenseExportCode);
      setExpenseExportCode("");csvDownload(result.filename,result.csv);
    }catch{setError(t.error);}
  }
  const s=summary?.summary;
  const metrics=s?[
    [t.gross,money(s.gross_sales_minor,currency,language,t.missingTax)],
    [t.refunds,money(s.refunds_minor,currency,language,t.missingTax)],
    [t.fees,money(s.stripe_fees_minor,currency,language,t.missingTax)],
    [t.net,money(s.net_after_processing_minor,currency,language,t.missingTax)],
    [t.tax,money(s.verified_tax_minor,currency,language,t.missingTax)],
    [t.netTax,money(s.net_after_verified_tax_minor,currency,language,t.missingTax)],
    [t.payouts,money(s.payouts_minor,currency,language,t.missingTax)],
    [t.platform,money(s.platform_fee_minor,currency,language,t.missingTax)],
  ]:[];

  return <div className="app-shell"><AppHeader/><main className="page tt-finance">
    <Link href="/admin" className="back-link">← {t.back}</Link>
    <div className="tt-finance-heading">
      <div><h1>{t.title}</h1><p className="form-note">{t.intro}</p></div>
      {unlocked&&<button className="button button-outline" type="button" onClick={()=>void load()} disabled={loading}>{t.reload}</button>}
    </div>
    {error&&<div className="state-card state-error" role="alert">{error} <Link href="/security/mfa">MFA →</Link></div>}
    {notice&&<div className="state-card" role="status">{notice}</div>}
    {loading&&!summary&&<div className="state-card">{t.loading}</div>}
    {!loading&&!unlocked&&<form className="panel form-stack tt-finance-unlock" onSubmit={e=>void unlock(e)}>
      <h2>{t.unlockTitle}</h2><p className="form-note">{t.unlockText}</p>
      <label>{t.otp}<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
        autoComplete="one-time-code" value={unlockCode} onChange={e=>setUnlockCode(e.target.value.replace(/\D/g,""))}/></label>
      <button type="submit" className="button button-primary" disabled={saving||unlockCode.length!==6}>{t.unlock}</button>
      <Link href="/security/mfa">MFA →</Link>
    </form>}
    {unlocked&&summary&&<div className="tt-finance-sections">
      <div className="tt-finance-controls panel">
        <label>{t.month}<input type="month" min="2026-01" max="2100-12" value={month} onChange={e=>setMonth(e.target.value)}/></label>
        <label>{t.currency}<select value={currency} onChange={e=>setCurrency(e.target.value as "CZK"|"EUR")}>
          <option value="CZK">CZK</option><option value="EUR">EUR</option>
        </select></label>
        <label>{t.otp}<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="one-time-code" value={exportCode} onChange={e=>setExportCode(e.target.value.replace(/\D/g,""))}/></label>
        <button type="button" className="button button-primary" disabled={loading||exportCode.length!==6} onClick={()=>void download()}>{t.export}</button>
      </div>
      <p className="form-note">{t.otpNote}</p>
      <div className="tt-finance-grid">{metrics.map(([label,value])=>
        <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      {s?.entry_count===0&&<div className="state-card">{t.noSales}</div>}
      <p className="form-note">{t.legal}</p>
      {(summary?.by_event?.length||0)>0&&<section className="panel">
        <h2>{t.byEvent}</h2>
        <div className="tt-finance-table-wrap"><table className="tt-finance-table">
          <thead><tr><th>{x.event}</th><th>{t.gross}</th><th>{t.refunds}</th><th>{t.fees}</th><th>{t.net}</th></tr></thead>
          <tbody>{summary?.by_event.map(item=><tr key={item.event_id}>
            <td>{expenseEvents.find(event=>event.id===item.event_id)?.title||`#${item.event_id}`}</td>
            <td>{money(item.summary.gross_sales_minor,currency,language,t.missingTax)}</td>
            <td>{money(item.summary.refunds_minor,currency,language,t.missingTax)}</td>
            <td>{money(item.summary.stripe_fees_minor,currency,language,t.missingTax)}</td>
            <td>{money(item.summary.net_after_processing_minor,currency,language,t.missingTax)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}
      <section className="panel">
        <h2>{t.profile}</h2>
        <p className="form-note">{profile?.verified?t.ready:t.unverified} · {t.stripe}: {profile?.stripe_connected?t.connected:t.disconnected}</p>
        <form className="form-stack tt-finance-profile" onSubmit={e=>void saveProfile(e)}>
          <label>{t.name}<input required minLength={2} maxLength={255} value={name} onChange={e=>setName(e.target.value)}/></label>
          <label>{t.ico}<input required type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={ico} onChange={e=>setIco(e.target.value)}/></label>
          <label>{t.dic}<input type="text" maxLength={32} value={dic} onChange={e=>setDic(e.target.value)}/></label>
          <label>{t.vat}<select value={vat} onChange={e=>setVat(e.target.value as typeof vat)}>
            <option value="non_payer">{t.nonpayer}</option>
            <option value="payer">{t.payer}</option>
            <option value="exempt">{t.exempt}</option>
          </select></label>
          <label>{t.otp}<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="one-time-code" value={profileCode} onChange={e=>setProfileCode(e.target.value.replace(/\D/g,""))}/></label>
          <button type="submit" className="button button-primary" disabled={saving||profileCode.length!==6}>{t.save}</button>
        </form>
      </section>
      <section className="panel">
        <h2>{t.entries}</h2>
        {entries.length>0?<div className="tt-finance-table-wrap"><table className="tt-finance-table">
          <thead><tr><th>{t.when}</th><th>{t.kind}</th><th>{t.ref}</th><th>{t.amount}</th></tr></thead>
          <tbody>{entries.map(row=><tr key={row.id}><td>{new Date(row.occurred_at).toLocaleString(language==="cs"?"cs-CZ":language==="ru"?"ru-RU":"en-GB")}</td><td>{row.category}</td><td>{row.order_reference||"—"}</td><td>{money(row.amount_minor,currency,language,t.missingTax)}</td></tr>)}</tbody>
        </table></div>:<p className="form-note">{t.noSales}</p>}
      </section>
      <section className="panel">
        <h2>{x.title}</h2>
        <p className="form-note">{x.intro}</p>
        <div className="stat-card tt-finance-expense-total">
          <span>{x.total} · {month}</span>
          <strong>{money(expenseTotal,currency,language,t.missingTax)}</strong>
        </div>
        {Object.values(expenseCategories).some(value=>value!==0)&&<div className="tt-finance-grid">
          {EXPENSE_CATEGORIES.filter(category=>expenseCategories[category]).map(category=><div className="stat-card" key={category}>
            <span>{x[category]}</span><strong>{money(expenseCategories[category],currency,language,t.missingTax)}</strong>
          </div>)}
        </div>}
        <h3>{x.add}</h3>
        <form className="form-stack tt-finance-expenses-form" onSubmit={e=>void recordExpense(e)}>
          <label>{x.date}<input required type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></label>
          <label>{x.category}<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value as FinanceExpenseInput["category"])}>
            {EXPENSE_CATEGORIES.map(item=><option key={item} value={item}>{x[item]}</option>)}
          </select></label>
          <label>{x.event}<select value={expenseEventId} onChange={e=>setExpenseEventId(e.target.value)}>
            <option value="">{x.general}</option>
            {expenseEvents.map(item=><option key={item.id} value={item.id}>
              {item.title} · {item.starts_at?new Date(item.starts_at).toLocaleDateString(language):"#"+item.id}
            </option>)}
          </select></label>
          <label>{x.amount} ({currency})<input required type="text" inputMode="decimal" maxLength={14}
            placeholder="1200.00" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label>
          <label>{x.supplier}<input maxLength={160} value={expenseSupplier} onChange={e=>setExpenseSupplier(e.target.value)}/></label>
          <label>{x.reference}<input maxLength={120} value={expenseReference} onChange={e=>setExpenseReference(e.target.value)}/></label>
          <label>{x.note}<textarea maxLength={400} rows={2} value={expenseNote} onChange={e=>setExpenseNote(e.target.value)}/></label>
          <label>{t.otp}<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="one-time-code" value={expenseCode} onChange={e=>setExpenseCode(e.target.value.replace(/\D/g,""))}/></label>
          <button type="submit" className="button button-primary" disabled={saving||expenseCode.length!==6}>{x.create}</button>
        </form>
        {expenses.length>0?<div className="tt-finance-table-wrap"><table className="tt-finance-table">
          <thead><tr><th>{x.date}</th><th>{x.category}</th><th>{x.supplier}</th><th>{x.reference}</th><th>{x.amount}</th><th>{x.reverse}</th></tr></thead>
          <tbody>{expenses.map(row=>{
            return <tr key={row.id}>
              <td>{row.expense_date}</td>
              <td>{row.entry_type==="reversal"?x.reversal:x[row.category]||row.category}</td>
              <td>{row.supplier||"—"}</td><td>{row.reference||"—"}</td>
              <td>{money(row.amount_minor,currency,language,t.missingTax)}</td>
              <td>{row.entry_type==="expense"&&!row.reversed?<button type="button" className="button button-outline"
                onClick={()=>{setReverseId(row.id);setReverseReason("");setReverseCode("");}}>{x.reverse}</button>:"—"}</td>
            </tr>;
          })}</tbody>
        </table></div>:<p className="form-note">{x.empty}</p>}
        {reverseId!==null&&<div className="tt-finance-reversal form-stack">
          <p>{x.reverse} #{reverseId}</p>
          <label>{x.reason}<input required minLength={4} maxLength={400} value={reverseReason}
            onChange={e=>setReverseReason(e.target.value)}/></label>
          <label>{t.otp}<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="one-time-code" value={reverseCode} onChange={e=>setReverseCode(e.target.value.replace(/\D/g,""))}/></label>
          <button type="button" className="button button-outline" disabled={saving||reverseCode.length!==6||reverseReason.trim().length<4}
            onClick={()=>void reverseExpense()}>{x.undo}</button>
        </div>}
        <div className="tt-finance-expense-export">
          <label>{t.otp}<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="one-time-code" value={expenseExportCode} onChange={e=>setExpenseExportCode(e.target.value.replace(/\D/g,""))}/></label>
          <button type="button" className="button button-outline" disabled={expenseExportCode.length!==6}
            onClick={()=>void downloadExpenses()}>{x.expenseExport}</button>
        </div>
      </section>
      <section className="panel">
        <h2>{t.documents}</h2>
        {documents.length>0?<ul>{documents.map(doc=><li key={doc.id}>
          {doc.document_number} · {doc.kind} · {new Date(doc.issued_at).toLocaleDateString(language)}
        </li>)}</ul>:<p className="form-note">{t.noDocuments}</p>}
      </section>
      <section className="panel">
        <h2>{t.contract}</h2>
        {!contract?.contract?<p className="form-note">{t.pending}</p>:<>
          <p className="form-note">Version {contract.contract.version} · SHA-256 {contract.contract.sha256}</p>
          <div className="tt-finance-contract">{contract.contract.body}</div>
          {contract.accepted?<p className="state-card" role="status">{t.accepted}</p>:<>
            <label className="tt-finance-consent"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>{t.sign}</span></label>
            <p className="form-note">{t.acceptNote}</p>
            <label className="tt-finance-otp-label">{t.otp}<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              autoComplete="one-time-code" value={contractCode} onChange={e=>setContractCode(e.target.value.replace(/\D/g,""))}/></label>
            <button className="button button-primary" disabled={!agreed||saving||contractCode.length!==6} type="button" onClick={()=>void accept()}>{t.accept}</button>
          </>}
        </>}
      </section>
    </div>}
  </main></div>;
}
