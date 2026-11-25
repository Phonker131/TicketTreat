"use client";

import Link from "next/link";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {
  acceptFinanceContract,getFinanceContract,getFinanceDocuments,getFinanceEntries,
  getFinanceExport,getFinanceProfile,getFinanceSummary,updateFinanceProfile,
  type FinanceContract,type FinanceEntry,type FinanceProfile,type FinanceSummary,
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
    entries:"Účetní pohyby",when:"Čas",kind:"Typ",ref:"Reference",amount:"Částka",
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
  },
  en:{
    title:"Finances and electronic agreements",intro:"Verified financial evidence for your organization. Reservations are not sales or tax documents.",
    back:"Event management",reload:"Refresh",export:"Download accounting CSV",loading:"Loading finances…",
    month:"Month",currency:"Currency",gross:"Gross sales",refunds:"Customer refunds",
    fees:"Payment processing fees",net:"After fees, before tax",tax:"Verified transaction VAT",
    netTax:"After verified VAT (not income tax)",payouts:"Transferred to bank",
    platform:"TicketTreat commission",missingTax:"Not verified yet",noSales:"No verified payments yet. Event registrations are not counted as revenue.",
    entries:"Accounting movements",when:"Time",kind:"Type",ref:"Reference",amount:"Amount",
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
  },
  ru:{
    title:"Финансы и электронные договоры",intro:"Учёт только подтверждённых операций организации. Брони и регистрации — не продажи и не налоговые документы.",
    back:"К управлению ивентами",reload:"Обновить",export:"Скачать CSV для бухгалтера",loading:"Загружаем финансы…",
    month:"Месяц",currency:"Валюта",gross:"Выручка до вычетов",refunds:"Возвраты гостям",
    fees:"Комиссии платёжной системы",net:"После комиссий, до налогов",tax:"Подтверждённый НДС",
    netTax:"За вычетом подтверждённого НДС (без налога на прибыль)",payouts:"Переведено на счёт",
    platform:"Комиссия TicketTreat",missingTax:"Пока не подтверждено",noSales:"Подтверждённых оплат пока нет. Регистрации не считаются выручкой.",
    entries:"Движение средств",when:"Время",kind:"Операция",ref:"Основание",amount:"Сумма",
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
  },
  uk:{
    title:"Фінанси та електронні договори",intro:"Облік лише підтверджених операцій організації. Реєстрації не є продажами чи податковими документами.",
    back:"Керування подіями",reload:"Оновити",export:"Завантажити CSV для обліку",loading:"Завантажуємо фінанси…",
    month:"Місяць",currency:"Валюта",gross:"Валові продажі",refunds:"Повернення гостям",
    fees:"Комісії платіжної системи",net:"Після комісій, до податків",tax:"Підтверджений ПДВ",
    netTax:"Після підтвердженого ПДВ (без податку на прибуток)",payouts:"Переказано на рахунок",
    platform:"Комісія TicketTreat",missingTax:"Поки не підтверджено",noSales:"Підтверджених оплат поки немає. Реєстрації не вважаються доходом.",
    entries:"Рух коштів",when:"Час",kind:"Операція",ref:"Підстава",amount:"Сума",
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
  },
};

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

export function OrganizerFinanceClient(){
  const {language}=useLanguage(),t=WORDS[language];
  const [month,setMonth]=useState(pragueMonth);
  const [currency,setCurrency]=useState<"CZK"|"EUR">("CZK");
  const [summary,setSummary]=useState<FinanceSummary|null>(null);
  const [entries,setEntries]=useState<FinanceEntry[]>([]);
  const [documents,setDocuments]=useState<{id:number;kind:string;document_number:string;issued_at:string}[]>([]);
  const [contract,setContract]=useState<FinanceContract|null>(null);
  const [profile,setProfile]=useState<FinanceProfile|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [agreed,setAgreed]=useState(false);
  const [name,setName]=useState(""),[ico,setIco]=useState(""),[dic,setDic]=useState("");
  const [vat,setVat]=useState<"non_payer"|"payer"|"exempt">("non_payer");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const [financial,rows,docs,agreement,details]=await Promise.all([
        getFinanceSummary(month,currency),getFinanceEntries(month,currency),
        getFinanceDocuments(),getFinanceContract(language==="cs"?"cs":"en"),getFinanceProfile(),
      ]);
      setSummary(financial);setEntries(rows.entries);setDocuments(docs.documents);
      setContract(agreement);setProfile(details);
      setName(details.legal_name||"");setIco(details.ico||"");
      setDic(details.dic||"");
      setVat(details.vat_status==="payer"||details.vat_status==="exempt"?details.vat_status:"non_payer");
    }catch{setError(t.error);}
    finally{setLoading(false);}
  },[month,currency,language,t.error]);
  useEffect(()=>{void load();},[load]);

  async function saveProfile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const updated=await updateFinanceProfile({legal_name:name.trim(),ico:ico.trim(),dic:dic.trim()||null,vat_status:vat});
      setProfile(updated);setNotice(t.saved);
    }catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function accept(){
    if(!agreed||!contract?.contract)return;
    setSaving(true);setError("");setNotice("");
    try{await acceptFinanceContract(contract.contract.id,contract.contract.sha256);setAgreed(false);await load();}
    catch{setError(t.error);}
    finally{setSaving(false);}
  }
  async function download(){
    setError("");
    try{const result=await getFinanceExport(month,currency);csvDownload(result.filename,result.csv);}
    catch{setError(t.error);}
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
      <button className="button button-outline" type="button" onClick={()=>void load()} disabled={loading}>{t.reload}</button>
    </div>
    {error&&<div className="state-card state-error" role="alert">{error} <Link href="/security/mfa">MFA →</Link></div>}
    {notice&&<div className="state-card" role="status">{notice}</div>}
    {loading&&!summary&&<div className="state-card">{t.loading}</div>}
    {summary&&<div className="tt-finance-sections">
      <div className="tt-finance-controls panel">
        <label>{t.month}<input type="month" min="2026-01" max="2100-12" value={month} onChange={e=>setMonth(e.target.value)}/></label>
        <label>{t.currency}<select value={currency} onChange={e=>setCurrency(e.target.value as "CZK"|"EUR")}>
          <option value="CZK">CZK</option><option value="EUR">EUR</option>
        </select></label>
        <button type="button" className="button button-primary" disabled={loading} onClick={()=>void download()}>{t.export}</button>
      </div>
      <div className="tt-finance-grid">{metrics.map(([label,value])=>
        <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      {s?.entry_count===0&&<div className="state-card">{t.noSales}</div>}
      <p className="form-note">{t.legal}</p>
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
          <button type="submit" className="button button-primary" disabled={saving}>{t.save}</button>
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
            <button className="button button-primary" disabled={!agreed||saving} type="button" onClick={()=>void accept()}>{t.accept}</button>
          </>}
        </>}
      </section>
    </div>}
  </main></div>;
}
