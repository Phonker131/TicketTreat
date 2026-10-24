"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
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
  const scannerRef = useRef<{stop: () => Promise<void>} | null>(null);
  const scanBusy = useRef(false);
  const [scanCycle,setScanCycle]=useState(0);
  const [scanning,setScanning]=useState(false);
  const [cameraError,setCameraError]=useState(false);

  async function submit(value: string) {
    const token = extractToken(value);
    if (!token || scanBusy.current) return;
    scanBusy.current=true;
    try {
      const session = getWebToken();
      if (!session) throw new Error(tr("Войдите в подтверждённый аккаунт с доступом к check-in."));
      const response = await scanPilotTicket(session, token);
      setResult(response.ticket);
      setSuccessful(response.status!=="already_checked_in");
      setMessage(response.status==="already_checked_in"?
        tr("Билет уже использован! Повторный проход запрещён."):tr("Check-in successful"));
      setManual("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tr("Check-in failed"));
      setResult(null);
      setSuccessful(false);
    } finally { scanBusy.current=false; }
  }

  useEffect(() => {
    let mounted = true;
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
            if(scanBusy.current)return;
            await scanner.stop().catch(() => {});
            setScanning(false);
            await submit(decodedText);
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
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current=null;
    };
  }, [scanCycle,language]);

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
      </main>
    </div>
  );
}
