"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { scanPilotTicket } from "@/lib/api";
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
  const scanBusy = useRef(false);
  const lastDecoded = useRef<{value:string;at:number}|null>(null);
  // Wait until the old camera stream and its DOM elements are released
  // before starting a replacement scanner (notably necessary on iOS).
  const teardown = useRef<Promise<void>>(Promise.resolve());
  const submitLatest = useRef<(value:string)=>Promise<void>>(async()=>{});
  const [submitting,setSubmitting]=useState(false);
  const [scanCycle,setScanCycle]=useState(0);
  const [scanning,setScanning]=useState(false);
  const [cameraError,setCameraError]=useState(false);

  async function submit(value: string) {
    const token = extractToken(value);
    if (!token || scanBusy.current) return;
    scanBusy.current=true;
    setSubmitting(true);
    try {
      const session = getWebToken();
      if (!session) throw new Error("login_required");
      const response = await scanPilotTicket(session, token);
      setResult(response.ticket);
      setSuccessful(response.status!=="already_checked_in");
      setMessage(response.status==="already_checked_in"?
        tr("Билет уже использован! Повторный проход запрещён."):tr("Check-in successful"));
      setManual("");
    } catch (e) {
      setMessage(userFacingError(e,language));
      setResult(null);
      setSuccessful(false);
    } finally {
      scanBusy.current=false;
      setSubmitting(false);
    }
  }

  // Camera callbacks always use the current UI language without restarting
  // the camera whenever a check-in updates the component state.
  submitLatest.current=submit;

  useEffect(()=>{
    let disposed=false;
    let scanner:import("html5-qrcode").Html5Qrcode|null=null;
    lastDecoded.current=null;
    const ready=teardown.current.then(async()=>{
      if(disposed)return;
      const {Html5Qrcode}=await import("html5-qrcode");
      if(disposed)return;
      scanner=new Html5Qrcode("tickettreat-qr-reader");
      try {
        await scanner.start(
          {facingMode:"environment"},
          {fps:10,qrbox:(width:number,height:number)=>{
            const side=Math.max(150,Math.min(250,Math.floor(Math.min(width,height)*.70)));
            return {width:side,height:side};
          }},
          decodedText=>{
            // Do NOT stop the camera on a scan. Success or failure must leave
            // the reader usable for the next attendee immediately.
            const value=extractToken(decodedText);
            if(disposed||scanBusy.current||!value)return;
            const recent=lastDecoded.current;
            const now=Date.now();
            if(recent?.value===value&&now-recent.at<15000)return;
            lastDecoded.current={value,at:now};
            void submitLatest.current(value);
          },
          ()=>{},
        );
        if(!disposed){setScanning(true);setCameraError(false);}
      }catch{
        if(!disposed){setScanning(false);setCameraError(true);}
      }
    }).catch(()=>{
      if(!disposed){setScanning(false);setCameraError(true);}
    });
    return ()=>{
      disposed=true;
      // Serialize async start/stop/clear to avoid WebKit camera races and
      // reusing a mutated html5-qrcode container on retries/navigation.
      teardown.current=ready.then(async()=>{
        if(!scanner)return;
        try{await scanner.stop();}catch{/* Camera may not have started. */}
        try{scanner.clear();}catch{/* Reader was already cleared. */}
      }).catch(()=>{});
    };
  },[scanCycle]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="admin-heading"><div><span className="status status-demo">CHECK-IN</span><h1>{tr("Scan TicketTreat ticket")}</h1><p>{tr("Camera scanner + manual fallback.")}</p></div></div>
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
                disabled={submitting||!manual.trim()} onClick={() => void submit(manual)}>{tr("Check in")}</button>
              <button type="button" className="button button-outline" disabled={submitting}
                onClick={()=>{setScanning(false);setCameraError(false);setScanCycle(v=>v+1);}}>
                {tr("↻ Перезапустить камеру")}
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
      </main>
    </div>
  );
}
