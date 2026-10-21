"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {getManageMe,getSiteLanding,updateSiteLanding,type SiteLanding} from "@/lib/api";
import {getWebToken} from "@/lib/session";

export function SiteContentClient(){
  const [landing,setLanding]=useState<SiteLanding|null>(null);
  const [headline,setHeadline]=useState(""),[subtitle,setSubtitle]=useState("");
  const [file,setFile]=useState<File|null>(null),[removeImage,setRemoveImage]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;const token=getWebToken();
    if(!token){setError("Войдите в аккаунт администратора.");setLoading(false);return;}
    Promise.all([getManageMe(token),getSiteLanding()]).then(([identity,details])=>{
      if(!active)return;
      if(identity.role!=="global_admin"){setError("Доступ только для глобального администратора.");return;}
      setAllowed(true);setLanding(details);setHeadline(details.headline);setSubtitle(details.subtitle);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();const token=getWebToken();
    if(!token||!allowed)return;
    setBusy(true);setError("");setNotice("");
    try{
      let hero_image_data_url:string|undefined;
      if(file){
        if(file.size>4*1024*1024)throw new Error("Максимум 4 МБ.");
        if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Выберите JPG, PNG или WebP.");
        hero_image_data_url=await new Promise<string>((resolve,reject)=>{
          const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
          reader.onerror=()=>reject(new Error("Ошибка чтения файла"));reader.readAsDataURL(file);
        });
      }
      const saved=await updateSiteLanding(token,{headline,subtitle,hero_image_data_url,remove_hero_image:removeImage});
      setLanding(saved);setFile(null);setRemoveImage(false);setNotice("Содержимое сайта обновлено.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Админ-панель</Link>
    <h1>Контент главной страницы</h1>
    <p className="form-note">Изменения появятся на сайте и в Telegram Mini App. Доступ — только глобальному администратору.</p>
    {loading&&<div className="state-card">Загрузка…</div>}
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner">{notice}</div>}
    {allowed&&<form className="panel form-stack" onSubmit={submit}>
      <label>Заголовок<input required minLength={3} maxLength={140} value={headline} onChange={e=>setHeadline(e.target.value)}/></label>
      <label>Описание<textarea required minLength={3} maxLength={750} rows={4} value={subtitle} onChange={e=>setSubtitle(e.target.value)}/></label>
      {landing?.hero_image_url&&!removeImage&&<img src={landing.hero_image_url+"?t="+Date.now()} className="event-poster-preview" alt="Баннер сайта"/>}
      <label>Новое изображение (JPG/PNG/WebP до 4 МБ)<input type="file" accept="image/png,image/jpeg,image/webp"
        onChange={e=>{setFile(e.target.files?.[0]||null);setRemoveImage(false);}}/></label>
      <label><input type="checkbox" checked={removeImage} onChange={e=>{setRemoveImage(e.target.checked);if(e.target.checked)setFile(null);}}/> Удалить изображение баннера</label>
      <button type="submit" className="button button-primary" disabled={busy}>{busy?"Сохранение…":"Сохранить"}</button>
    </form>}
  </main></div>;
}
