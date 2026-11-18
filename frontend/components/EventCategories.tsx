"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {getEventCategories,addEventCategory,setEventCategoryActive,type EventCategory} from "@/lib/api";
import {DEFAULT_TAGS,TAG_LABELS} from "@/lib/event-tags";
import {userFacingError} from "@/lib/user-facing-errors";
import type {LanguageCode} from "@/lib/types";

const defaults=DEFAULT_TAGS.map(key=>({key,en:TAG_LABELS.en[key],cs:TAG_LABELS.cs[key],active:true}));
const Catalog=createContext({rows:defaults,replace:(_rows:EventCategory[])=>{},loaded:false});
export function EventCategoriesProvider({children}:{children:ReactNode}){
  const [rows,replace]=useState<EventCategory[]>(defaults);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let live=true;
    getEventCategories().then(data=>{if(live&&Array.isArray(data)){replace(data);setLoaded(true);}}).catch(()=>{});
    return ()=>{live=false;};
  },[]);
  return <Catalog.Provider value={{rows,replace,loaded}}>{children}</Catalog.Provider>;
}
export function useCategories(language:LanguageCode){
  const {rows}=useContext(Catalog);
  function label(key:string){
    const row=rows.find(category=>category.key===key);
    if(language==="cs")return row?.cs??TAG_LABELS.cs[key]??key;
    return TAG_LABELS[language][key]??row?.en??key;
  }
  return {activeKeys:rows.filter(row=>row.active).map(row=>row.key),label};
}
export function CategoryManager({language}:{language:LanguageCode}){
  const {rows,replace,loaded}=useContext(Catalog);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const cs=language==="cs";
  async function save(action:()=>Promise<EventCategory[]>){
    setBusy(true);setError("");
    try{replace(await action());return true;}
    catch(e){setError(userFacingError(e,language));return false;}
    finally{setBusy(false);}
  }
  return <details className="panel"><summary>{cs?"Kategorie akcí":"Event categories"}</summary>
    <p>{cs?"Skrytá kategorie zůstane u dříve označených akcí.":"Hidden categories stay on events that already use them."}</p>
    {!loaded&&<p>{cs?"Pro načtení seznamu obnovte stránku.":"Refresh the page if the category list does not load."}</p>}
    {error&&<p role="alert">{error}</p>}
    {loaded&&rows.map(row=><div key={row.key} className="admin-event-actions"><span>{cs?row.cs:row.en}</span>
      <button className="button button-outline" disabled={busy} onClick={()=>void save(()=>setEventCategoryActive(row.key,!row.active))}>
      {row.active?(cs?"Skrýt":"Hide"):(cs?"Obnovit":"Restore")}</button></div>)}
    <form className="form-stack" onSubmit={async e=>{
      e.preventDefault();const form=e.currentTarget,data=new FormData(form);
      if(await save(()=>addEventCategory(String(data.get("en")).trim(),String(data.get("cs")).trim())))form.reset();
    }}>
      <label>{cs?"Název anglicky":"English name"}<input name="en" required maxLength={80}/></label>
      <label>{cs?"Název česky":"Czech name"}<input name="cs" required maxLength={80}/></label>
      <button className="button button-primary" disabled={busy||!loaded}>{cs?"Přidat kategorii":"Add category"}</button>
    </form></details>;
}
