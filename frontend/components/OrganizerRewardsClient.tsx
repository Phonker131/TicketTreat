"use client";
import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {
  getOrganizerRewards,createOrganizerReward,grantOrganizerReward,
  revokeOrganizerReward,type OrganizerRewardsDashboard,
} from "@/lib/api";
import {userFacingError} from "@/lib/user-facing-errors";

const labels={
  en:{
    title:"Attendance rewards",intro:"Recognize people who actually attended your events. Rewards are visible in their guest passport.",
    back:"Organizer dashboard",refresh:"Refresh",loading:"Loading attendance…",
    create:"Create a reward",createHelp:"Create a reusable award for your organizer profile. You can give it after a verified QR check-in.",
    event:"Organizer event",rewardTitle:"Reward name",description:"Description (optional)",
    kind:"Award type",badge:"Badge",recognition:"Recognition",perk:"Special benefit",
    save:"Save reward",issuing:"Give reward",selectEvent:"Choose an event",
    selectReward:"Choose a reward",selectGuest:"Choose a checked-in guest",
    attendee:"Checked-in attendee",note:"Personal note (optional)",give:"Award guest",
    issued:"Award history",earned:"Awarded",revoked:"Revoked",revoke:"Revoke",
    noEvents:"Create an organizer-owned event before adding rewards.",
    noCheckins:"No verified QR check-ins for this event yet. Rewards cannot be given for bookings.",
    noRewards:"Create a reward for this event's organizer first.",
    already:"Already awarded",confirm:"Revoke this award? The guest will no longer see it, but the audit record will remain.",
    saved:"Reward created.",granted:"Reward issued.",removed:"Award revoked.",
    mfa:"Organizer access requires email verification and MFA.",login:"Sign in to your organizer account.", busy:"Saving…",
    privacy:"Only confirmed attendees of events you manage appear here. QR codes and personal contact details are not exposed.",
    unavailable:"Unable to load rewards. Check your organizer access and MFA."
  },
  cs:{
    title:"Odměny za návštěvu",intro:"Oceňte hosty, kteří skutečně navštívili vaše akce. Odměny se zobrazí v jejich pasu hosta.",
    back:"Panel pořadatele",refresh:"Obnovit",loading:"Načítání návštěv…",
    create:"Vytvořit odměnu",createHelp:"Založte opakovaně použitelnou odměnu pro svého pořadatele. Uděluje se až po potvrzeném QR odbavení.",
    event:"Akce pořadatele",rewardTitle:"Název odměny",description:"Popis (nepovinný)",
    kind:"Typ odměny",badge:"Odznak",recognition:"Ocenění",perk:"Zvláštní výhoda",
    save:"Uložit odměnu",issuing:"Udělit odměnu",selectEvent:"Vyberte akci",
    selectReward:"Vyberte odměnu",selectGuest:"Vyberte odbaveného hosta",
    attendee:"Odbavený host",note:"Osobní vzkaz (nepovinný)",give:"Udělit odměnu",
    issued:"Historie odměn",earned:"Uděleno",revoked:"Zrušeno",revoke:"Zrušit",
    noEvents:"Nejprve vytvořte vlastní akci, abyste mohli přidávat odměny.",
    noCheckins:"Na této akci zatím nikdo neprošel QR odbavením. Za pouhou registraci nelze odměnu udělit.",
    noRewards:"Nejprve vytvořte odměnu pro pořadatele této akce.",
    already:"Již uděleno",confirm:"Odebrat tuto odměnu? Z pasu hosta zmizí, záznam zůstane uložen.",
    saved:"Odměna vytvořena.",granted:"Odměna udělena.",removed:"Odměna odebrána.",
    mfa:"Pro přístup pořadatele je nutné ověřený e-mail a MFA.",login:"Přihlaste se jako pořadatel.",busy:"Ukládám…",
    privacy:"Zobrazují se pouze odbavení hosté vašich akcí. QR kódy ani soukromé kontakty se nezobrazují.",
    unavailable:"Odměny nelze načíst. Zkontrolujte oprávnění pořadatele a MFA."
  },
  ru:{
    title:"Награды за посещение",intro:"Отмечайте гостей, которые действительно посетили ваши мероприятия. Награды появятся в их паспорте гостя.",
    back:"Панель организатора",refresh:"Обновить",loading:"Загружаем посещения…",
    create:"Создать награду",createHelp:"Создайте награду для мероприятий своего организатора. Выдавать её можно после подтверждённого QR check-in.",
    event:"Мероприятие организатора",rewardTitle:"Название награды",description:"Описание (необязательно)",
    kind:"Тип награды",badge:"Значок",recognition:"Признание",perk:"Особый бонус",
    save:"Сохранить награду",issuing:"Вручить награду",selectEvent:"Выберите событие",
    selectReward:"Выберите награду",selectGuest:"Выберите посетителя",
    attendee:"Посетитель с подтверждённым check-in",note:"Личная заметка (необязательно)",give:"Наградить",
    issued:"История выдач",earned:"Выдана",revoked:"Отменена",revoke:"Отменить",
    noEvents:"Сначала создайте мероприятие со своим организатором.",
    noCheckins:"Для этого события пока нет подтверждённых QR-посещений. За одну регистрацию награды не выдаются.",
    noRewards:"Сначала создайте награду для организатора этого события.",
    already:"Уже вручена",confirm:"Отменить выдачу? Награда исчезнет из паспорта, но запись останется в истории.",
    saved:"Награда создана.",granted:"Награда вручена.",removed:"Награда отменена.",
    mfa:"Для доступа организатора нужно подтвердить email и MFA.",login:"Войдите в аккаунт организатора.",busy:"Сохраняем…",
    privacy:"В списке только гости с QR check-in на ваших событиях. QR-коды и контакты не отображаются.",
    unavailable:"Не удалось загрузить награды. Проверьте роль и MFA."
  },
  uk:{
    title:"Нагороди за відвідування",intro:"Відзначайте гостей, які справді відвідали ваші події. Нагороди з'являться в паспорті гостя.",
    back:"Панель організатора",refresh:"Оновити",loading:"Завантажуємо відвідування…",
    create:"Створити нагороду",createHelp:"Створіть нагороду для свого організатора. Видача можлива після підтвердженого QR check-in.",
    event:"Подія організатора",rewardTitle:"Назва нагороди",description:"Опис (необов'язково)",
    kind:"Тип нагороди",badge:"Значок",recognition:"Визнання",perk:"Особливий бонус",
    save:"Зберегти нагороду",issuing:"Вручити нагороду",selectEvent:"Оберіть подію",
    selectReward:"Оберіть нагороду",selectGuest:"Оберіть відвідувача",
    attendee:"Відвідувач із підтвердженим check-in",note:"Особиста нотатка (необов'язково)",give:"Нагородити",
    issued:"Історія нагород",earned:"Видано",revoked:"Скасовано",revoke:"Скасувати",
    noEvents:"Спочатку створіть власну подію, щоб додавати нагороди.",
    noCheckins:"Для цієї події ще немає підтверджених QR-відвідувань. За реєстрацію нагороди не видаються.",
    noRewards:"Спочатку створіть нагороду для організатора цієї події.",
    already:"Уже видано",confirm:"Скасувати нагороду? Вона зникне з паспорта, але запис залишиться.",
    saved:"Нагороду створено.",granted:"Нагороду вручено.",removed:"Нагороду скасовано.",
    mfa:"Організатор повинен підтвердити email та MFA.",login:"Увійдіть як організатор.",busy:"Зберігаємо…",
    privacy:"Доступні лише гості ваших подій із QR check-in. QR-коди та контактні дані не відображаються.",
    unavailable:"Не вдалося завантажити нагороди. Перевірте доступ організатора та MFA."
  }
} as const;

export function OrganizerRewardsClient(){
  const {language}=useLanguage();
  const t=labels[language];
  const [data,setData]=useState<OrganizerRewardsDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [createEvent,setCreateEvent]=useState("");
  const [awardEvent,setAwardEvent]=useState("");
  const [rewardId,setRewardId]=useState("");
  const [ticketId,setTicketId]=useState("");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [kind,setKind]=useState<"badge"|"recognition"|"perk">("badge");
  const [note,setNote]=useState("");

  async function reload(){
    setLoading(true);setError("");
    try {
      const next=await getOrganizerRewards();
      setData(next);
      setCreateEvent(current=>current||String(next.events[0]?.id||""));
      setAwardEvent(current=>current||String(next.events[0]?.id||""));
    } catch (cause){setError(userFacingError(cause,language));}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[]);

  const event=data?.events.find(e=>String(e.id)===awardEvent);
  const attendees=useMemo(()=>data?.attendees.filter(a=>String(a.event_id)===awardEvent)||[],[data,awardEvent]);
  const rewards=useMemo(()=>data?.rewards.filter(r=>r.active && event?.owner_account_id===r.owner_account_id)||[],[data,event?.owner_account_id]);
  const chosenReward=rewards.find(r=>String(r.id)===rewardId);
  const chosenTicket=attendees.find(a=>String(a.ticket_id)===ticketId);
  const already=new Set((data?.grants||[]).filter(g=>g.revoked_at===null)
    .map(g=>g.reward_id+":"+g.ticket_id));
  const isDuplicate=chosenReward&&chosenTicket&&already.has(chosenReward.id+":"+chosenTicket.ticket_id);

  async function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!createEvent)return;
    setBusy(true);setError("");setNotice("");
    try{
      await createOrganizerReward({
        event_id:Number(createEvent),title:title.trim(),description:description.trim(),kind,
      });
      setTitle("");setDescription("");setNotice(t.saved);
      setData(await getOrganizerRewards());
    }catch(cause){setError(userFacingError(cause,language));}
    finally{setBusy(false);}
  }
  async function grant(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!rewardId||!ticketId||isDuplicate)return;
    setBusy(true);setError("");setNotice("");
    try{
      await grantOrganizerReward(Number(rewardId),Number(ticketId),note.trim());
      setNotice(t.granted);setNote("");
      setData(await getOrganizerRewards());
    }catch(cause){setError(userFacingError(cause,language));}
    finally{setBusy(false);}
  }
  async function revoke(id:number){
    if(!window.confirm(t.confirm))return;
    setBusy(true);setError("");setNotice("");
    try{
      await revokeOrganizerReward(id);
      setNotice(t.removed);
      setData(await getOrganizerRewards());
    }catch(cause){setError(userFacingError(cause,language));}
    finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page tt-reward-admin">
    <Link href="/admin" className="back-link">← {t.back}</Link>
    <div className="section-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div>
      <button type="button" className="button button-outline" disabled={busy||loading}
        onClick={()=>void reload()}>{t.refresh}</button></div>
    {error&&<div className="state-card state-error" role="alert">{error}
      {(/mfa|verification_required/.test(error))&&<p><Link href="/security/mfa" className="button button-outline">{t.mfa}</Link></p>}
    </div>}
    {notice&&<p className="success-banner" role="status">{notice}</p>}
    {loading?<div className="state-card" role="status">{t.loading}</div>:data&&<>
      <p className="form-note">{t.privacy}</p>
      <div className="tt-reward-admin-grid">
        <section className="panel">
          <h2>{t.create}</h2><p className="form-note">{t.createHelp}</p>
          {data.events.length===0?<p>{t.noEvents}</p>:
          <form className="form-stack" onSubmit={create}>
            <label>{t.event}<select value={createEvent} required onChange={e=>setCreateEvent(e.target.value)}>
              {data.events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
            </select></label>
            <label>{t.rewardTitle}<input value={title} required minLength={3} maxLength={80}
              onChange={e=>setTitle(e.target.value)} placeholder="VIP · Thank you"/></label>
            <label>{t.description}<textarea value={description} maxLength={300} rows={3}
              onChange={e=>setDescription(e.target.value)}/></label>
            <label>{t.kind}<select value={kind}
              onChange={e=>setKind(e.target.value as "badge"|"recognition"|"perk")}>
              <option value="badge">{t.badge}</option>
              <option value="recognition">{t.recognition}</option>
              <option value="perk">{t.perk}</option>
            </select></label>
            <button type="submit" disabled={busy||title.trim().length<3}
              className="button button-primary">{busy?t.busy:t.save}</button>
          </form>}
        </section>
        <section className="panel">
          <h2>{t.issuing}</h2>
          {data.events.length===0?<p>{t.noEvents}</p>:
          <form className="form-stack" onSubmit={grant}>
            <label>{t.event}<select value={awardEvent} onChange={e=>{setAwardEvent(e.target.value);setRewardId("");setTicketId("");}}>
              {data.events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
            </select></label>
            {attendees.length===0?<p className="form-note">{t.noCheckins}</p>:
            <label>{t.attendee}<select value={ticketId} required onChange={e=>setTicketId(e.target.value)}>
              <option value="">{t.selectGuest}</option>
              {attendees.map(a=><option key={a.ticket_id} value={a.ticket_id}>{a.guest_name} · #{a.ticket_id}</option>)}
            </select></label>}
            {rewards.length===0?<p className="form-note">{t.noRewards}</p>:
            <label>{t.selectReward}<select value={rewardId} required onChange={e=>setRewardId(e.target.value)}>
              <option value="">{t.selectReward}</option>
              {rewards.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
            </select></label>}
            <label>{t.note}<textarea value={note} maxLength={200} rows={2}
              onChange={e=>setNote(e.target.value)}/></label>
            {isDuplicate&&<p className="form-note" role="status">{t.already}</p>}
            <button type="submit" className="button button-primary"
              disabled={busy||!ticketId||!rewardId||!!isDuplicate}>{busy?t.busy:t.give}</button>
          </form>}
        </section>
      </div>
      <section className="panel">
        <h2>{t.issued} ({data.grants.length})</h2>
        {data.grants.length===0?<p className="form-note">—</p>:
        <div className="tt-rewards-history">{data.grants.map(grant=><div key={grant.id} className="tt-reward-history-row">
          <div><strong>{grant.title}</strong><p>{grant.guest_name||"#"+grant.ticket_id} · {grant.event_title}</p>
            {grant.note&&<p className="form-note">{grant.note}</p>}</div>
          <div className="tt-reward-history-actions">
            <span className={"status "+(grant.revoked_at?"status-demo":"status-success")}>{grant.revoked_at?t.revoked:t.earned}</span>
            {!grant.revoked_at&&<button type="button" className="button button-outline" disabled={busy}
              onClick={()=>void revoke(grant.id)}>{t.revoke}</button>}
          </div>
        </div>)}</div>}
      </section>
    </>}
    <p className="form-note">{t.mfa}</p>
  </main></div>;
}
