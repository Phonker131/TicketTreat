"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getOwnOrganizerProfile,saveOwnOrganizerProfile,uploadOrganizerImage,deleteOrganizerImage} from "@/lib/api";
import type {EditableOrganizerProfile,LanguageCode} from "@/lib/types";

const WORDS:Record<LanguageCode,Record<string,string>>={
  ru:{title:"Публичный профиль организатора",intro:"Заполни информацию, которую увидят посетители. Профиль остаётся приватным до публикации.",name:"Название организатора",slug:"Адрес страницы (латиницей)",bio:"О нас",city:"Город",website:"Сайт (HTTPS)",instagram:"Instagram (имя пользователя)",visible:"Опубликовать профиль",save:"Сохранить профиль",saving:"Сохраняем…",saved:"Профиль сохранён",logo:"Логотип",cover:"Обложка",upload:"Загрузить изображение",remove:"Удалить",view:"Открыть публичную страницу",back:"В кабинет организатора",unpublished:"Сейчас профиль скрыт от посетителей",published:"Профиль опубликован",uploadFirst:"Сначала сохрани профиль",imageTooLarge:"Логотип: до 600 КБ, обложка: до 2 МБ. JPG, PNG или WebP.",publishHint:"Для публикации нужны название и описание минимум из 30 символов. Email, телефон и список участников никогда не показываются.",loading:"Загружаем профиль…",error:"Не удалось загрузить профиль. Убедись, что твой аккаунт организатора подтверждён и MFA настроена.",invalid:"Выбери JPG, PNG или WebP."},
  en:{title:"Public organizer profile",intro:"Describe your organization for attendees. The page stays private until you publish it.",name:"Organizer name",slug:"Public page slug",bio:"About us",city:"City",website:"Website (HTTPS)",instagram:"Instagram username",visible:"Publish profile",save:"Save profile",saving:"Saving…",saved:"Profile saved",logo:"Logo",cover:"Cover image",upload:"Upload image",remove:"Remove",view:"View public page",back:"Organizer dashboard",unpublished:"Profile is currently hidden",published:"Profile is published",uploadFirst:"Save the profile first",imageTooLarge:"Logo up to 600 KB, cover up to 2 MB. JPG, PNG or WebP.",publishHint:"Publication requires a name and at least 30 characters of description. Email, phone and attendee lists are never public.",loading:"Loading profile…",error:"Could not load profile. Please verify organizer access and MFA.",invalid:"Choose a JPG, PNG or WebP image."},
  cs:{title:"Veřejný profil pořadatele",intro:"Vyplňte informace pro návštěvníky. Profil zůstane soukromý, dokud jej nezveřejníte.",name:"Název pořadatele",slug:"Adresa profilu",bio:"O nás",city:"Město",website:"Web (HTTPS)",instagram:"Instagram uživatelské jméno",visible:"Zveřejnit profil",save:"Uložit profil",saving:"Ukládání…",saved:"Profil uložen",logo:"Logo",cover:"Úvodní obrázek",upload:"Nahrát obrázek",remove:"Odstranit",view:"Otevřít veřejný profil",back:"Panel pořadatele",unpublished:"Profil je nyní skrytý",published:"Profil je zveřejněný",uploadFirst:"Nejprve uložte profil",imageTooLarge:"Logo do 600 kB, úvodní obrázek do 2 MB. JPG, PNG nebo WebP.",publishHint:"Pro zveřejnění je nutný název a popis s alespoň 30 znaky. E-mail, telefon a seznam účastníků se nezobrazují.",loading:"Načítání profilu…",error:"Profil se nepodařilo načíst. Zkontrolujte oprávnění a MFA.",invalid:"Vyberte JPG, PNG nebo WebP."},
  uk:{title:"Публічний профіль організатора",intro:"Заповни інформацію для відвідувачів. Профіль залишається прихованим до публікації.",name:"Назва організатора",slug:"Адреса сторінки",bio:"Про нас",city:"Місто",website:"Вебсайт (HTTPS)",instagram:"Ім’я користувача Instagram",visible:"Опублікувати профіль",save:"Зберегти профіль",saving:"Зберігаємо…",saved:"Профіль збережено",logo:"Логотип",cover:"Обкладинка",upload:"Завантажити зображення",remove:"Видалити",view:"Відкрити публічну сторінку",back:"Кабінет організатора",unpublished:"Профіль наразі прихований",published:"Профіль опублікований",uploadFirst:"Спочатку збережи профіль",imageTooLarge:"Логотип до 600 КБ, обкладинка до 2 МБ. JPG, PNG або WebP.",publishHint:"Для публікації потрібні назва й опис щонайменше 30 символів. Email, телефон і списки учасників не публікуються.",loading:"Завантажуємо профіль…",error:"Не вдалося завантажити профіль. Перевір доступ організатора й MFA.",invalid:"Обери JPG, PNG або WebP."}
};
const DEFAULT:EditableOrganizerProfile={
  slug:"",display_name:"",bio:"",city:"",website_url:"",instagram:"",
  logo_url:null,cover_url:null,published:false
};

export function OrganizerProfileEditor(){
  const {language}=useLanguage(),tr=WORDS[language];
  const [profile,setProfile]=useState<EditableOrganizerProfile>(DEFAULT);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [stored,setStored]=useState(false),[notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [previews,setPreviews]=useState<Record<string,string>>({});
  useEffect(()=>{
    let live=true;
    getOwnOrganizerProfile().then(data=>{if(live){setProfile(data);setStored(Boolean(data.display_name));}})
      .catch(()=>{if(live)setError(tr.error);}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false};
  },[]); // The server's permission checks are authoritative.

  function change<K extends keyof EditableOrganizerProfile>(key:K,value:EditableOrganizerProfile[K]){
    setProfile(p=>({...p,[key]:value}));setNotice("");
  }
  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      const result=await saveOwnOrganizerProfile(profile);
      setProfile(result);setStored(true);setNotice(tr.saved);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function upload(kind:"logo"|"cover",file:File|undefined){
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){setError(tr.invalid);return;}
    if(file.size>(kind==="logo"?600_000:2_000_000)){setError(tr.imageTooLarge);return;}
    if(!stored){setError(tr.uploadFirst);return;}
    setBusy(true);setError("");setNotice("");
    try{
      const data_url=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
        reader.onerror=()=>reject(new Error("image_read_error"));reader.readAsDataURL(file);
      });
      const result=await uploadOrganizerImage(kind,data_url);
      setProfile(result);setPreviews(p=>({...p,[kind]:data_url}));setNotice(tr.saved);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function remove(kind:"logo"|"cover"){
    setBusy(true);setError("");
    try{setProfile(await deleteOrganizerImage(kind));setPreviews(p=>({...p,[kind]:""}));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page organizer-editor">
    <Link href="/admin" className="back-link">← {tr.back}</Link>
    <h1>{tr.title}</h1><p className="form-note">{tr.intro}</p>
    {loading?<div className="state-card">{tr.loading}</div>:<>
      <p className={"status "+(profile.published?"status-success":"")}>{profile.published?tr.published:tr.unpublished}</p>
      {error&&<div className="state-card state-error" role="alert">{error}</div>}
      {notice&&<div className="state-card" role="status">{notice}</div>}
      <form className="panel form-stack" onSubmit={save}>
        <label>{tr.name}<input value={profile.display_name} onChange={e=>change("display_name",e.target.value)} maxLength={100} required/></label>
        <label>{tr.slug}<input value={profile.slug} onChange={e=>change("slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} pattern="[a-z0-9][a-z0-9-]{1,69}[a-z0-9]" minLength={3} maxLength={75} disabled={profile.published} required/></label>
        <label>{tr.bio}<textarea value={profile.bio} onChange={e=>change("bio",e.target.value)} maxLength={2000} rows={6}/></label>
        <label>{tr.city}<input value={profile.city} onChange={e=>change("city",e.target.value)} maxLength={100}/></label>
        <label>{tr.website}<input type="url" value={profile.website_url} onChange={e=>change("website_url",e.target.value)} placeholder="https://example.com" maxLength={400}/></label>
        <label>{tr.instagram}<input value={profile.instagram} onChange={e=>change("instagram",e.target.value)} placeholder="@organizer" maxLength={32}/></label>
        <label className="organizer-publish-toggle"><input type="checkbox" checked={profile.published} onChange={e=>change("published",e.target.checked)}/>{tr.visible}</label>
        <p className="form-note">{tr.publishHint}</p>
        <div className="admin-event-actions">
          <button className="button button-primary" disabled={busy} type="submit">{busy?tr.saving:tr.save}</button>
          {profile.published&&stored&&<Link className="button button-outline" href={`/organizers/${profile.slug}`}>{tr.view} ↗</Link>}
        </div>
      </form>
      <section className="panel form-stack" style={{marginTop:20}}>
        <p className="form-note">{tr.imageTooLarge}</p>
        {(["logo","cover"] as const).map(kind=><div className="organizer-editor-media" key={kind}>
          <h2>{tr[kind]}</h2>
          {(previews[kind]||(profile.published?(kind==="logo"?profile.logo_url:profile.cover_url):null))&&
          // eslint-disable-next-line @next/next/no-img-element
          <img className={kind==="logo"?"organizer-edit-logo":"organizer-edit-cover"} src={previews[kind]||(kind==="logo"?profile.logo_url:profile.cover_url)||""} alt="" />}
          <div className="admin-event-actions">
            <label className="button button-outline">{tr.upload}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||!stored} style={{display:"none"}} onChange={e=>{void upload(kind,e.target.files?.[0]);e.currentTarget.value="";}}/>
            </label>
            {(kind==="logo"?profile.logo_url:profile.cover_url)&&<button className="button button-outline" type="button" disabled={busy} onClick={()=>void remove(kind)}>{tr.remove}</button>}
          </div>
        </div>)}
      </section>
    </>}
  </main></div>;
}
