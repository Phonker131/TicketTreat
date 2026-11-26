"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { getCheckinAccess,scanPilotTicket,type CheckinAccess } from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { DemoTicket } from "@/lib/types";

function extractToken(value: string): string {
  // Existing QR codes must remain scannable after the brand migration.
  const raw = value.trim();
  for (const prefix of ["TICKETTREAT:TICKET:", "CROWDLY:TICKET:"]) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  }
  return raw;
}

export function CheckInClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>eventAdminText(language,phrase);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<DemoTicket | null>(null);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");
  const scannerRef = useRef<{stop: () => Promise<void>} | null>(null);
  const scanBusy = useRef(false);
  const [scanCycle,setScanCycle]=useState(0);
  const [scanning,setScanning]=useState(false);
  const [cameraError,setCameraError]=useState(false);
  const [access,setAccess]=useState<CheckinAccess|null>(null);
  const [accessLoading,setAccessLoading]=useState(true);
  const [selectedEventId,setSelectedEventId]=useState<number|null>(null);
  const scanPaused=useRef(false);
  const recentScan=useRef<{value:string;at:number}|null>(null);
  const canScan=Boolean(access&&(access.can_scan_all||access.events.length>0));
  const copy={
    en:{event:"Scanning event",all:"All events (global administrator)",noAccess:"No active check-in assignments. Ask the event organizer to grant access to your verified TicketTreat account.",instructions:"Sign in to the same account that received the invitation. Select the event, allow camera access, and scan guests' ticket QR codes. A previously used ticket must not be admitted again.",profile:"Go to profile",loading:"Loading…"},
    cs:{event:"Akce pro kontrolu",all:"Všechny akce (hlavní správce)",noAccess:"Nemáte přidělený přístup ke skeneru. Požádejte pořadatele, aby oprávnění udělil vašemu ověřenému účtu TicketTreat.",instructions:"Přihlaste se účtem, kterému byl přístup udělen. Vyberte akci, povolte fotoaparát a skenujte QR kódy. Již použitou vstupenku znovu nepouštějte.",profile:"Přejít na profil",loading:"Načítání…"},
    ru:{event:"Мероприятие для проверки",all:"Все мероприятия (главный администратор)",noAccess:"Нет доступа к сканеру. Попроси организатора назначить твой подтверждённый TicketTreat-аккаунт.",instructions:"Войди в аккаунт, на который назначен доступ. Выбери мероприятие, разреши камеру и сканируй QR. Билет, уже отмеченный на входе, повторно пропускать нельзя.",profile:"Открыть профиль",loading:"Загрузка…"},
    uk:{event:"Подія для перевірки",all:"Усі події (головний адміністратор)",noAccess:"Немає доступу до сканера. Попросіть організатора призначити ваш підтверджений TicketTreat-акаунт.",instructions:"Увійдіть у акаунт, якому надали доступ. Оберіть подію, дозвольте камеру та скануйте QR. Уже використаний квиток повторно не пропускайте.",profile:"Відкрити профіль",loading:"Завантаження…"},
  }[language];

  useEffect(()=>{
    let active=true;
    const token=getWebToken();
    if(!token){setAccessLoading(false);setMessage(userFacingError(new Error("login_required"),language));return;}
    getCheckinAccess(token).then(result=>{
      if(!active)return;
      setAccess(result);
      const requested=Number(new URLSearchParams(window.location.search).get("event")||0);
      setSelectedEventId(result.events.some(row=>row.id===requested)?requested:
        result.can_scan_all?null:result.events[0]?.id??null);
    }).catch(e=>{if(active){setAccess(null);setMessage(userFacingError(e,language));}})
      .finally(()=>{if(active)setAccessLoading(false);});
    return()=>{active=false;};
  },[language]);

  async function submit(value: string) {
    const token = extractToken(value);
    if (!token || scanBusy.current) return;
    scanBusy.current=true;
    try {
      const session = getWebToken();
      if (!session) throw new Error("login_required");
      const response = await scanPilotTicket(session, token, selectedEventId);
      setResult(response.ticket);
      setSuccessful(response.status!=="already_checked_in");
      setMessage(response.status==="already_checked_in"?
        tr("Билет уже использован! Повторный проход запрещён."):tr("Check-in successful"));
      setManual("");
    } catch (e) {
      setMessage(userFacingError(e,language));
      setResult(null);
      setSuccessful(false);
    } finally { scanBusy.current=false; }
  }

  useEffect(() => {
    if(!canScan||accessLoading)return;
    let mounted = true;
    let restartTimer:number|undefined;
    scanPaused.current=false;
    setScanning(false);
    import("html5-qrcode").then(async ({Html5Qrcode}) => {
      if (!mounted) return;
      const scanner = new Html5Qrcode("tickettreat-qr-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          {facingMode: "environment"},
          {fps: 10, qrbox: (width:number,height:number) => {
            const side=Math.max(150,Math.min(250,Math.floor(Math.min(width,height)*0.70)));
            return {width:side,height:side};
          }},
          async (decodedText) => {
            if(scanBusy.current||scanPaused.current)return;
            const token=extractToken(decodedText);
            if(recentScan.current?.value===token&&Date.now()-recentScan.current.at<8000)return;
            scanPaused.current=true;
            recentScan.current={value:token,at:Date.now()};
            await scanner.stop().catch(() => {});
            if(!mounted)return;
            setScanning(false);
            await submit(token);
            // Restart after every attempt; suppress the same QR for eight
            // seconds to avoid repeated check-ins when it stays in view.
            if(mounted)restartTimer=window.setTimeout(()=>setScanCycle(v=>v+1),900);
          },
          () => {},
        );
        setScanning(true);setCameraError(false);
      } catch {
        setScanning(false);setCameraError(true);
        setMessage(tr("Camera unavailable. You can paste the QR token manually."));
      }
    });

    return () => {
      mounted = false;
      if(restartTimer!==undefined)window.clearTimeout(restartTimer);
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current=null;
    };
  }, [scanCycle,language,canScan,accessLoading,selectedEventId]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="admin-heading"><div><span className="status status-demo">CHECK-IN</span><h1>{tr("Scan TicketTreat ticket")}</h1><p>{tr("Camera scanner + manual fallback.")}</p></div></div>
        {accessLoading?<div className="state-card">{copy.loading}</div>:!canScan?
          <section className="panel form-stack"><p role="status">{message||copy.noAccess}</p>
            <Link href="/profile" className="button button-primary">{copy.profile}</Link>
          </section>:<>
        <section className="panel form-stack">
          <label>{copy.event}
            <select value={selectedEventId??""} onChange={e=>setSelectedEventId(e.target.value?Number(e.target.value):null)}>
              {access?.can_scan_all&&<option value="">{copy.all}</option>}
              {access?.events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </label>
          <p className="form-note">{copy.instructions}</p>
        </section>
        <section className="panel tt-checkin-panel" aria-label={tr("Сканер билетов")}>
          <div className="tt-checkin-camera">
            <div id="tickettreat-qr-reader" className="scanner-box" />
          </div>
          <div className="tt-checkin-camera-status" role="status" aria-live="polite">
            <span className="tt-checkin-camera-indicator" aria-hidden="true"/>
            <span>{scanning?tr("📷 Камера сканирует QR-код"):cameraError?tr("Камера недоступна — используй ручной ввод"):tr("Подключение камеры…")}</span>
          </div>
          <div className="tt-checkin-controls">
            <div className="tt-checkin-manual">
              <label htmlFor="tickettreat-manual-token">{tr("QR-код билета — ручной ввод")}</label>
              <input id="tickettreat-manual-token" value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={tr("Вставь токен из QR-кода")}
                autoComplete="off" />
            </div>
            <div className="tt-checkin-buttons">
              <button type="button" className="button button-primary"
                disabled={!manual.trim()} onClick={() => submit(manual)}>{tr("Check in")}</button>
              <button type="button" className="button button-outline" disabled={scanning}
                onClick={()=>{setResult(null);setSuccessful(false);setMessage("");setCameraError(false);setScanCycle(v=>v+1);}}>
                {scanning?tr("Камера активна"):tr("↻ Перезапустить камеру")}
              </button>
            </div>
          </div>
        </section>
        {message && <div className={successful ? "success-banner" : "state-card state-error"}>{message}</div>}
        {result && (
          <section className="panel checkin-result">
            <h2>{result.guest?.first_name} {result.guest?.last_name}</h2>
            <p>{result.event?.title}</p>
            <strong>{result.code}</strong>
          </section>
        )}
        </>}
      </main>
    </div>
  );
}
