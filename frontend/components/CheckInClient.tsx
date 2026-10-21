"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
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
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<DemoTicket | null>(null);
  const [message, setMessage] = useState("");
  const scannerRef = useRef<{stop: () => Promise<void>} | null>(null);
  const scanBusy = useRef(false);
  const [scanCycle,setScanCycle]=useState(0);
  const [scanning,setScanning]=useState(false);

  async function submit(value: string) {
    const token = extractToken(value);
    if (!token || scanBusy.current) return;
    scanBusy.current=true;
    try {
      const session = getWebToken();
      if (!session) throw new Error("Войдите в подтверждённый аккаунт с доступом к check-in.");
      const response = await scanPilotTicket(session, token);
      setResult(response.ticket);
      setMessage(response.status==="already_checked_in"?
        "Билет уже использован! Повторный проход запрещён.":"Check-in successful");
      setManual("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Check-in failed");
      setResult(null);
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
          {fps: 10, qrbox: {width: 240, height: 240}},
          async (decodedText) => {
            if(scanBusy.current)return;
            await scanner.stop().catch(() => {});
            setScanning(false);
            await submit(decodedText);
          },
          () => {},
        );
        setScanning(true);
      } catch {
        setScanning(false);
        setMessage("Camera unavailable. You can paste the QR token manually.");
      }
    });

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current=null;
    };
  }, [scanCycle]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="admin-heading"><div><span className="status status-demo">CHECK-IN</span><h1>{tr("Scan TicketTreat ticket")}</h1><p>{tr("Camera scanner + manual fallback.")}</p></div></div>
        <section className="panel">
          <div id="tickettreat-qr-reader" className="scanner-box" />
          <div className="manual-checkin">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste QR token" />
            <button className="button button-primary" disabled={!manual.trim()} onClick={() => submit(manual)}>{tr("Check in")}</button>
          </div>
          <button type="button" className="button button-outline" disabled={scanning}
            onClick={()=>{setResult(null);setMessage("");setScanCycle(s=>s+1)}}>
            {scanning?"Камера сканирует":"Сканировать следующий билет"}
          </button>
        </section>
        {message && <div className={result&&message==="Check-in successful" ? "success-banner" : "state-card state-error"}>{message}</div>}
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
