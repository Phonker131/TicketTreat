"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { checkInManagedTicket, getManageMe } from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { DemoTicket } from "@/lib/types";

function extractToken(value: string): string {
  const prefix = "CROWDLY:TICKET:";
  return value.startsWith(prefix) ? value.slice(prefix.length) : value.trim();
}

export function CheckInClient() {
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<DemoTicket | null>(null);
  const [message, setMessage] = useState("");
  const scannerRef = useRef<{stop: () => Promise<void>} | null>(null);

  async function submit(value: string) {
    const token = extractToken(value);
    if (!token) return;
    try {
      const session = getWebToken();
      if (!session) throw new Error("Нужно войти в аккаунт организатора.");
      await getManageMe(session).then(me => {
        if(me.role === "participant") throw new Error("Доступ только организаторам.");
      });
      const response = await checkInManagedTicket(session, token);
      setResult(response.ticket);
      setMessage("Check-in successful");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Check-in failed");
      setResult(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    import("html5-qrcode").then(async ({Html5Qrcode}) => {
      if (!mounted) return;
      const scanner = new Html5Qrcode("crowdly-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          {facingMode: "environment"},
          {fps: 10, qrbox: {width: 240, height: 240}},
          async (decodedText) => {
            await scanner.stop().catch(() => {});
            await submit(decodedText);
          },
          () => {},
        );
      } catch {
        setMessage("Camera unavailable. You can paste the QR token manually.");
      }
    });

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page narrow-page">
        <div className="admin-heading"><div><span className="status status-demo">CHECK-IN</span><h1>Scan Crowdly ticket</h1><p>Camera scanner + manual fallback.</p></div></div>
        <section className="panel">
          <div id="crowdly-reader" className="scanner-box" />
          <div className="manual-checkin">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste QR token" />
            <button className="button button-primary" onClick={() => submit(manual)}>Check in</button>
          </div>
        </section>
        {message && <div className={result ? "success-banner" : "state-card state-error"}>{message}</div>}
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
