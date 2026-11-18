"use client";

import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getManageMe,getEventCategories,addEventCategory,setEventCategoryActive,type EventCategory} from "@/lib/api";
import {invalidateEventCategories,categoryLabel} from "@/lib/event-categories";
import {userFacingError} from "@/lib/user-facing-errors";
import {getWebToken} from "@/lib/session";

const words={
 en:{title:"Event categories",intro:"Manage the categories used by organizers and the event discovery filters. Only global administrators can make changes.",back:"Dashboard",en:"English name",cs:"Czech name",add:"Add category",active:"Available categories",archived:"Archived categories",archive:"Archive",restore:"Restore",empty:"No archived categories",loading:"Loading categories…",saving:"Saving…",success:"Categories updated.",history:"Archiving removes a category from new event choices and discovery filters, but preserves it on existing events.",denied:"Only global administrators can manage categories.",verify:"Verify MFA"},
 cs:{title:"Kategorie akcí",intro:"Spravujte kategorie používané pořadateli a filtry akcí. Změny mohou provádět pouze hlavní administrátoři.",back:"Administrace",en:"Anglický název",cs:"Český název",add:"Přidat kategorii",active:"Aktivní kategorie",archived:"Archivované kategorie",archive:"Archivovat",restore:"Obnovit",empty:"Žádné archivované kategorie",loading:"Načítání kategorií…",saving:"Ukládání…",success:"Kategorie byly aktualizovány.",history:"Archivace odebere kategorii z výběru nových akcí a z filtrů, ale ponechá ji u stávajících akcí.",denied:"Kategorie mohou spravovat pouze hlavní administrátoři.",verify:"Ověřit MFA"},
} as const;

export function AdminCategoriesClient(){
 const {language}=useLanguage();
 const tr=words[language==="cs"?"cs":"en"];
 const [categories,setCategories]=useState<EventCategory[]>([]);
 const [authorized,setAuthorized]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [en,setEn]=useState(""),[cs,setCs]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let live=true;
  async function load(){
   try{
    const me=await getManageMe(getWebToken()||"");
    if(me.role!=="global_admin")throw new Error("global_admin_only");
    const catalog=await getEventCategories();
    if(live){setAuthorized(true);setCategories(catalog);}
   }catch(e){if(live)setError(e instanceof Error&&e.message==="global_admin_only"?tr.denied:userFacingError(e,language));}
   finally{if(live)setLoading(false);}
  }
  void load();return()=>{live=false};
 },[language,tr.denied]);

 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!en.trim()||!cs.trim())return;
  setBusy(true);setError("");setNotice("");
  try{setCategories(await addEventCategory(en.trim(),cs.trim()));invalidateEventCategories();setEn("");setCs("");setNotice(tr.success);}
  catch(e){setError(userFacingError(e,language));}finally{setBusy(false);}
 }
 async function toggle(category:EventCategory){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{setCategories(await setEventCategoryActive(category.key,!category.active));invalidateEventCategories();setNotice(tr.success);}
  catch(e){setError(userFacingError(e,language));}finally{setBusy(false);}
 }

 return <div className="app-shell"><AppHeader/><main className="page tt-dash-page">
  <div className="tt-dash-main" style={{maxWidth:900,margin:"0 auto"}}>
   <p><Link href="/admin" className="button button-outline">← {tr.back}</Link></p>
   <h1>{tr.title}</h1><p>{tr.intro}</p>
   {loading&&<div className="state-card">{tr.loading}</div>}
   {error&&<div role="alert" className="state-card state-error">{error}{/mfa_(?:enrollment|challenge)_required/.test(error)&&<p><Link href="/security/mfa" className="button button-outline">{tr.verify}</Link></p>}</div>}
   {notice&&<div role="status" className="success-banner">{notice}</div>}
   {authorized&&<>
    <form className="panel form-stack" onSubmit={create}>
     <h2>{tr.add}</h2>
     <div className="two-col"><label>{tr.en}<input value={en} onChange={e=>setEn(e.target.value)} maxLength={80} required/></label>
      <label>{tr.cs}<input value={cs} onChange={e=>setCs(e.target.value)} maxLength={80} required/></label></div>
     <div><button type="submit" className="button button-primary" disabled={busy||!en.trim()||!cs.trim()}>{busy?tr.saving:tr.add}</button></div>
    </form>
    <section className="panel"><h2>{tr.active}</h2><p className="form-note">{tr.history}</p>
     <div className="form-stack">{categories.filter(c=>c.active).map(category=><div key={category.key} className="admin-event-actions" style={{justifyContent:"space-between",alignItems:"center"}}>
      <div><strong>{categoryLabel(category,language)}</strong><small style={{display:"block",opacity:.75}}>{language==="cs"?category.en:category.cs}</small></div>
      <button type="button" className="button button-outline" disabled={busy} onClick={()=>void toggle(category)}>{tr.archive}</button>
     </div>)}</div>
    </section>
    <section className="panel"><h2>{tr.archived}</h2>
     {categories.filter(c=>!c.active).length===0?<p className="form-note">{tr.empty}</p>:
     <div className="form-stack">{categories.filter(c=>!c.active).map(category=><div key={category.key} className="admin-event-actions" style={{justifyContent:"space-between",alignItems:"center"}}>
      <div><strong>{categoryLabel(category,language)}</strong><small style={{display:"block",opacity:.75}}>{language==="cs"?category.en:category.cs}</small></div>
      <button type="button" className="button button-outline" disabled={busy} onClick={()=>void toggle(category)}>{tr.restore}</button>
     </div>)}</div>}
    </section>
   </>}
  </div>
 </main></div>;
}
