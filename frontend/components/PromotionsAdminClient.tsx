"use client";
import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";
import {
 getManagePromotions,createPromotion,editPromotion,setPromotionStatus,
 getPromotionClaims,reviewPromotionClaim,
 type Promotion,type PromotionClaim,type PromotionEvent,type PromotionPayload,
 type PromotionTrigger,type PromotionReward,
} from "@/lib/api";

const copy={
 en:{
  title:"Marketing campaigns",intro:"Schedule promotions, define rewards and review Instagram submissions.",
  back:"Dashboard",public:"Public campaigns",new:"New campaign",cancel:"Close editor",
  signup:"New TicketTreat account",booking:"Register for an event",instagram:"Instagram follow",
  template:"Start from a template",quick:"24-hour VIP signup",follow:"Instagram follow promotion",
  organizer:"Organizer (choose one of its events)",event:"Registration event",
  name:"Campaign title",description:"Public campaign description",trigger:"Participation condition",
  kind:"Reward type",vip:"VIP organizer perk",badge:"Badge",other:"Other benefit",
  reward:"Reward title",details:"What the organizer will provide",social:"Instagram profile URL",
  starts:"Starts",ends:"Ends",benefit:"Reward valid until (optional)",hour:"Set 24-hour window",
  create:"Save draft",update:"Update draft",publish:"Publish",pause:"Pause",resume:"Resume",
  edit:"Edit draft",review:"Review Instagram claims",approve:"Approve",reject:"Reject",
  empty:"No campaigns yet.",noEvents:"Create an organizer-owned event first.",
  loading:"Loading…",busy:"Saving…",refresh:"Refresh",saved:"Campaign saved.",
  scheduled:"Scheduled",live:"Live",ended:"Ended",draft:"Draft",paused:"Paused",
  eligible:"Qualified",pending:"Pending",approved:"Approved",
  validate:"Check your dates: the end must follow the start; reward expiry must follow the campaign end.",
  time:"Times are in your local timezone. Eligibility is checked using server timestamps.",
  note:"VIP promotional perks are separate from the 12-check-in loyalty tier. Instagram follows are never automatically verified.",
  scope:"For signup or Instagram campaigns, the event identifies the organizer only — participants do not need to book that event.",
  verify:"Instagram requests are pending until the organizer verifies the username manually.",
  confirm:"Publish this campaign? Its terms and dates are locked afterwards.",
  stop:"Pause this campaign and temporarily hide its benefits?",
  success:"Changes saved.",none:"No Instagram claims.",select:"Choose event",
 },
 cs:{
  title:"Marketingové kampaně",intro:"Plánujte kampaně, nastavujte odměny a ověřujte instagramové žádosti.",
  back:"Administrace",public:"Veřejné kampaně",new:"Nová kampaň",cancel:"Zavřít editor",
  signup:"Nový účet TicketTreat",booking:"Registrace na akci",instagram:"Sledování Instagramu",
  template:"Rychlá šablona",quick:"VIP za registraci během 24 hodin",follow:"Instagramová kampaň",
  organizer:"Pořadatel (vyberte jeho akci)",event:"Akce pro registraci",
  name:"Název kampaně",description:"Veřejný popis kampaně",trigger:"Podmínka účasti",
  kind:"Typ odměny",vip:"VIP výhoda pořadatele",badge:"Odznak",other:"Jiná odměna",
  reward:"Název odměny",details:"Co pořadatel poskytne",social:"URL instagramového profilu",
  starts:"Začátek",ends:"Konec",benefit:"Platnost odměny (nepovinné)",hour:"Nastavit 24 hodin",
  create:"Uložit koncept",update:"Upravit koncept",publish:"Zveřejnit",pause:"Pozastavit",resume:"Obnovit",
  edit:"Upravit",review:"Ověřit Instagram",approve:"Schválit",reject:"Zamítnout",
  empty:"Zatím žádné kampaně.",noEvents:"Nejprve vytvořte akci svého pořadatele.",
  loading:"Načítání…",busy:"Ukládání…",refresh:"Obnovit",saved:"Kampaň uložena.",
  scheduled:"Naplánováno",live:"Probíhá",ended:"Ukončeno",draft:"Koncept",paused:"Pozastaveno",
  eligible:"Oprávnění",pending:"Čeká na kontrolu",approved:"Schváleno",
  validate:"Zkontrolujte data: konec musí být po začátku a platnost odměny po konci kampaně.",
  time:"Časy jsou v místním pásmu. Oprávnění se ověřuje podle času na serveru.",
  note:"Promo VIP je samostatná výhoda, nikoliv věrnostní úroveň za 12 návštěv. Sledování Instagramu se automaticky neověřuje.",
  scope:"U registrace účtu a Instagramu vybraná akce pouze určuje pořadatele.",
  verify:"Instagramové žádosti čekají na ruční ověření pořadatelem.",
  confirm:"Zveřejnit kampaň? Podmínky a termíny už nepůjde změnit.",
  stop:"Pozastavit kampaň a dočasně skrýt její výhody?",
  success:"Změny uloženy.",none:"Zatím žádné instagramové žádosti.",select:"Vyberte akci",
 }
} as const;
type Draft=Omit<PromotionPayload,"starts_at"|"ends_at"|"benefit_expires_at"> & {
 starts_at:string;ends_at:string;benefit_expires_at:string;
};
function localInput(d:Date){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function toInput(v:string|null|undefined){const d=new Date(v||"");return Number.isFinite(d.getTime())?localInput(d):"";}
function blank(anchor=0):Draft{
 const d=new Date();d.setMinutes(d.getMinutes()+5,0,0);
 return {anchor_event_id:anchor,event_id:null,trigger:"account_signup",
  reward_kind:"vip_perk",title:"",description:"",reward_title:"",reward_details:"",
  instagram_url:"",starts_at:localInput(d),ends_at:localInput(new Date(d.getTime()+86400000)),
  benefit_expires_at:localInput(new Date(d.getTime()+31*86400000))};
}
function dateLabel(v:string,lang:"cs"|"en"){
 const d=new Date(v);
 return new Intl.DateTimeFormat(lang==="cs"?"cs-CZ":"en-GB",
 {dateStyle:"medium",timeStyle:"short"}).format(d);
}
export function PromotionsAdminClient(){
 const {language}=useLanguage(),lang=language==="cs"?"cs":"en",t=copy[lang];
 const [events,setEvents]=useState<PromotionEvent[]>([]);
 const [campaigns,setCampaigns]=useState<Promotion[]>([]);
 const [form,setForm]=useState<Draft>(()=>blank());
 const [editing,setEditing]=useState<number|null>(null),[open,setOpen]=useState(false);
 const [claimsFor,setClaimsFor]=useState<number|null>(null),[claims,setClaims]=useState<PromotionClaim[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const chosen=events.find(e=>e.id===form.anchor_event_id);
 const ownerEvents=events.filter(e=>e.owner_account_id===chosen?.owner_account_id);
 async function refresh(){
  setLoading(true);
  try{
   const data=await getManagePromotions();
   setEvents(data.events);setCampaigns(data.campaigns);
   setForm(f=>f.anchor_event_id?f:{...f,anchor_event_id:data.events[0]?.id||0});
  }catch(e){setError(userFacingError(e,language))}
  finally{setLoading(false)}
 }
 useEffect(()=>{void refresh()},[]);
 const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setForm(f=>({...f,[key]:value}));
 function close(){setOpen(false);setEditing(null);setForm(blank(events[0]?.id||0));}
 function begin(which:"signup"|"instagram"){
  const f=blank(events[0]?.id||0);
  f.trigger=which==="signup"?"account_signup":"instagram_follow";
  f.title=which==="signup"?"Amber Events · VIP 24h":"Amber Events · Instagram VIP";
  f.reward_title="Amber Events VIP";
  f.description=which==="signup"
   ?"Register for TicketTreat during the promotional 24 hours to qualify for VIP."
   :"Follow the organizer on Instagram and submit your handle for manual verification.";
  setEditing(null);setForm(f);setOpen(true);
 }
 function edit(p:Promotion){
  setEditing(p.id);setForm({anchor_event_id:p.anchor_event_id||0,event_id:p.event_id,
   title:p.title,description:p.description,trigger:p.trigger,reward_kind:p.reward_kind,
   reward_title:p.reward_title,reward_details:p.reward_details,instagram_url:p.instagram_url,
   starts_at:toInput(p.starts_at),ends_at:toInput(p.ends_at),
   benefit_expires_at:toInput(p.benefit_expires_at)});
  setOpen(true);window.scrollTo({top:0,behavior:"smooth"});
 }
 function set24(){
  const ms=Date.parse(form.starts_at);
  if(Number.isFinite(ms))set("ends_at",localInput(new Date(ms+86400000)));
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("");
  const start=Date.parse(form.starts_at),end=Date.parse(form.ends_at);
  const expires=form.benefit_expires_at?Date.parse(form.benefit_expires_at):null;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||(expires!==null&&(!Number.isFinite(expires)||expires<=end))){
   setError(t.validate);return;
  }
  setBusy(true);
  try{
   const payload:PromotionPayload={...form,
    event_id:form.trigger==="event_booking"?form.event_id:null,
    instagram_url:form.trigger==="instagram_follow"?form.instagram_url:"",
    starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),
    benefit_expires_at:expires!==null?new Date(expires).toISOString():null};
   if(editing!==null)await editPromotion(editing,payload);else await createPromotion(payload);
   setCampaigns((await getManagePromotions()).campaigns);setNotice(t.saved);close();
  }catch(e){setError(userFacingError(e,language))}
  finally{setBusy(false)}
 }
 async function status(p:Promotion,next:"active"|"paused"){
  if(!window.confirm(next==="active"?t.confirm:t.stop))return;
  setBusy(true);setError("");
  try{await setPromotionStatus(p.id,next);setCampaigns((await getManagePromotions()).campaigns);setNotice(t.success)}
  catch(e){setError(userFacingError(e,language))}
  finally{setBusy(false)}
 }
 async function loadClaims(id:number){
  setClaimsFor(id);
  try{setClaims((await getPromotionClaims(id)).claims)}
  catch(e){setError(userFacingError(e,language))}
 }
 async function review(id:number,claimId:number,approve:boolean){
  setBusy(true);setError("");
  try{
   await reviewPromotionClaim(id,claimId,approve);
   await loadClaims(id);setCampaigns((await getManagePromotions()).campaigns);setNotice(t.success);
  }catch(e){setError(userFacingError(e,language))}
  finally{setBusy(false)}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-promo-page">
  <Link href="/admin" className="back-link">← {t.back}</Link>
  <div className="section-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div>
   <div className="tt-promo-actions"><Link className="button button-outline" href="/promotions">{t.public}</Link>
   <button type="button" className="button button-primary" onClick={()=>{if(open)close();else setOpen(true)}}>{open?t.cancel:t.new}</button></div>
  </div>
  {error&&<div role="alert" className="state-card state-error">{error}
   {error.includes("mfa")&&<Link href="/security/mfa">MFA</Link>}</div>}
  {notice&&<p className="success-banner" role="status">{notice}</p>}
  <p className="form-note tt-promo-note">{t.note}</p>
  {loading?<div className="state-card">{t.loading}</div>:<>
   {events.length===0?<div className="panel">{t.noEvents}</div>:<>
    <div className="tt-promo-actions"><span>{t.template}:</span>
     <button type="button" className="button button-outline" onClick={()=>begin("signup")}>{t.quick}</button>
     <button type="button" className="button button-outline" onClick={()=>begin("instagram")}>{t.follow}</button>
    </div>
    {open&&<section className="panel tt-promo-editor">
     <h2>{editing===null?t.new:t.edit}</h2>
     <form className="form-stack" onSubmit={save}>
      <div className="tt-promo-fields">
       <label>{t.organizer}<select required value={form.anchor_event_id} onChange={e=>{
        setForm(f=>({...f,anchor_event_id:Number(e.target.value),event_id:null}));
       }}><option value={0}>{t.select}</option>
        {events.map(e=><option key={e.id} value={e.id}>{e.organizer_name+" · "+e.title+" #"+e.id}</option>)}
       </select></label>
       <label>{t.trigger}<select value={form.trigger} onChange={e=>setForm(f=>({...f,trigger:e.target.value as PromotionTrigger,event_id:null,instagram_url:""}))}>
        <option value="account_signup">{t.signup}</option>
        <option value="event_booking">{t.booking}</option>
        <option value="instagram_follow">{t.instagram}</option>
       </select></label>
       {form.trigger==="event_booking"&&<label>{t.event}<select required value={form.event_id??""}
        onChange={e=>set("event_id",Number(e.target.value)||null)}><option value="">{t.select}</option>
        {ownerEvents.map(e=><option key={e.id} value={e.id}>{e.title+" #"+e.id}</option>)}
       </select></label>}
       {form.trigger==="instagram_follow"&&<label>{t.social}<input required type="url"
        placeholder="https://www.instagram.com/profile/" value={form.instagram_url}
        onChange={e=>set("instagram_url",e.target.value)}/></label>}
       <label>{t.name}<input required minLength={3} maxLength={100} value={form.title}
        onChange={e=>set("title",e.target.value)}/></label>
       <label>{t.kind}<select value={form.reward_kind} onChange={e=>set("reward_kind",e.target.value as PromotionReward)}>
        <option value="vip_perk">{t.vip}</option><option value="badge">{t.badge}</option><option value="other">{t.other}</option>
       </select></label>
       <label>{t.reward}<input required minLength={3} maxLength={100} value={form.reward_title}
        onChange={e=>set("reward_title",e.target.value)}/></label>
       <label>{t.starts}<input required type="datetime-local" value={form.starts_at}
        onChange={e=>set("starts_at",e.target.value)}/></label>
       <label>{t.ends}<input required type="datetime-local" value={form.ends_at}
        onChange={e=>set("ends_at",e.target.value)}/></label>
       <label>{t.benefit}<input type="datetime-local" value={form.benefit_expires_at}
        onChange={e=>set("benefit_expires_at",e.target.value)}/></label>
      </div>
      <button type="button" className="button button-outline" onClick={set24}>{t.hour}</button>
      <p className="form-note">{t.time} {t.scope}</p>
      <label>{t.description}<textarea rows={3} maxLength={1500} value={form.description}
       onChange={e=>set("description",e.target.value)}/></label>
      <label>{t.details}<textarea rows={3} maxLength={500} value={form.reward_details}
       onChange={e=>set("reward_details",e.target.value)}/></label>
      <div className="tt-promo-actions"><button disabled={busy||!form.anchor_event_id} type="submit" className="button button-primary">
       {busy?t.busy:editing===null?t.create:t.update}</button>
       <button type="button" className="button button-outline" onClick={close}>{t.cancel}</button>
      </div>
     </form>
    </section>}
   </>}
   <section className="tt-promo-list">
    <div className="section-heading"><h2>{t.title+" ("+campaigns.length+")"}</h2>
     <button type="button" className="button button-outline" disabled={busy} onClick={()=>void refresh()}>{t.refresh}</button>
    </div>
    {campaigns.length===0?<div className="panel">{t.empty}</div>:<div className="tt-promo-cards">
     {campaigns.map(p=>{
      const current=Date.now(),start=Date.parse(p.starts_at),end=Date.parse(p.ends_at);
      const state=p.status==="draft"?t.draft:p.status==="paused"?t.paused:current>=end?t.ended:current<start?t.scheduled:t.live;
      return <article className="panel tt-promo-card" key={p.id}>
       <div className="tt-promo-card-top"><div><small>{p.organizer_name+" · #"+p.id}</small>
        <h3>{p.title}</h3></div><span className="status">{state}</span></div>
       <p>{p.description}</p><div className="tt-promo-metrics">
        <span>{t.starts+": "+dateLabel(p.starts_at,lang)}</span>
        <span>{t.ends+": "+dateLabel(p.ends_at,lang)}</span>
        <span>{t.reward+": "+p.reward_title}</span>
        <span>{t.eligible+": "+(p.eligible_count||0)}</span>
        {p.trigger==="instagram_follow"&&<span>{t.pending+": "+(p.claims?.pending||0)+" · "+t.approved+": "+(p.claims?.approved||0)}</span>}
       </div>
       <div className="tt-promo-actions">
        {p.status==="draft"&&<>
         <button type="button" className="button button-outline" onClick={()=>edit(p)}>{t.edit}</button>
         <button type="button" disabled={busy} className="button button-primary" onClick={()=>void status(p,"active")}>{t.publish}</button>
        </>}
        {p.status==="active"&&<button type="button" disabled={busy} className="button button-outline"
         onClick={()=>void status(p,"paused")}>{t.pause}</button>}
        {p.status==="paused"&&<button type="button" disabled={busy} className="button button-primary"
         onClick={()=>void status(p,"active")}>{t.resume}</button>}
        {p.trigger==="instagram_follow"&&<button type="button" className="button button-outline"
         onClick={()=>void loadClaims(p.id)}>{t.review+" ("+(p.claims?.pending||0)+")"}</button>}
       </div>
       {claimsFor===p.id&&<div className="tt-promo-claims">
        <h4>{t.review}</h4><p className="form-note">{t.verify}</p>
        {claims.length===0?<p>{t.none}</p>:claims.map(c=><div className="tt-promo-claim" key={c.id}>
         <div><strong>{c.name}</strong><p>{"@"+c.instagram_username+" · "+c.status}</p></div>
         {c.status==="pending"&&<div className="tt-promo-actions">
          <button type="button" disabled={busy} className="button button-primary" onClick={()=>void review(p.id,c.id,true)}>{t.approve}</button>
          <button type="button" disabled={busy} className="button button-outline" onClick={()=>void review(p.id,c.id,false)}>{t.reject}</button>
         </div>}
        </div>)}
       </div>}
      </article>;
     })}
    </div>}
   </section>
  </>}
 </main></div>;
}
