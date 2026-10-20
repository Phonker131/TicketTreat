"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {getManagedAccounts,setManagedAccountRole} from "@/lib/api";
import type {ManagedAccount} from "@/lib/api";
import {getWebToken} from "@/lib/session";

export function ManageAccountsClient() {
  const [accounts,setAccounts]=useState<ManagedAccount[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError("Для просмотра аккаунтов необходимо войти.");setLoading(false);return;}
    getManagedAccounts(token).then(setAccounts).catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setLoading(false));
  },[]);
  async function changeRole(account:ManagedAccount,role:"participant"|"organizer"){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(`Изменить роль аккаунта #${account.account_id} на ${role}?`))return;
    setBusy(account.account_id);setError("");setNotice("");
    try{
      await setManagedAccountRole(token,account.account_id,role);
      setAccounts(prev=>prev.map(a=>a.account_id===account.account_id?{...a,role}:a));
      setNotice("Роль обновлена");
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Organizer dashboard</Link>
    <div className="admin-heading"><div><span className="status status-demo">GLOBAL ADMIN</span><h1>Управление аккаунтами</h1>
      <p>Разрешение ролей участников и организаторов. Глобальных администраторов можно назначить только в Railway.</p></div></div>
    {error&&<div className="state-card state-error">{error}</div>}
    {notice&&<div className="success-banner">{notice}</div>}
    {loading?<div className="state-card">Загрузка…</div>:<div className="panel">
      <h2>Аккаунты ({accounts.length})</h2>
      {accounts.map(a=><div className="participant-row" key={a.account_id}>
        <div><strong>{a.name}</strong><small>#{a.account_id} · {a.email}</small>
          <span className="status status-demo">{a.role}</span></div>
        {a.role!=="global_admin"&&<div className="participant-actions">
          <button className="button button-outline" disabled={busy===a.account_id||a.role==="participant"}
            onClick={()=>changeRole(a,"participant")}>Participant</button>
          <button className="button button-primary" disabled={busy===a.account_id||a.role==="organizer"}
            onClick={()=>changeRole(a,"organizer")}>Organizer</button>
        </div>}
      </div>)}
    </div>}
  </main></div>;
}
