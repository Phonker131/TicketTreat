"use client";
import {WaveShader} from "@/components/premium/WaveShader";
import type {LanguageCode} from "@/lib/types";

const COPY={
 en:{line:"One account for every ticket",sub:"Email, Google or Telegram. Your QR tickets stay in one place.",admit:"Admit one",title:"Your tickets",code:"Signed in"},
 cs:{line:"Jeden účet pro všechny vstupenky",sub:"E-mail, Google nebo Telegram. QR vstupenky máš na jednom místě.",admit:"Vstup pro 1",title:"Tvoje vstupenky",code:"Přihlášeno"},
 ru:{line:"Один аккаунт для всех билетов",sub:"Email, Google или Telegram. QR-билеты в одном месте.",admit:"Вход на 1",title:"Твои билеты",code:"Вход"},
 uk:{line:"Один акаунт для всіх квитків",sub:"Email, Google або Telegram. QR-квитки в одному місці.",admit:"Вхід на 1",title:"Твої квитки",code:"Вхід"},
} as const;

/** The picture beside the sign-in form (after the Flatlogic login layout): the night glow,
 *  a ticket with a lock on its stub, and a paper plane for Telegram flying along a dotted path. */
export function LoginArt({language}:{language:LanguageCode}){
 const c=COPY[language];
 return <aside className="tt-login-art" aria-hidden="true">
  <WaveShader className="tt-login-wave"/>
  <svg className="tt-login-path" viewBox="0 0 480 360" fill="none">
   <path d="M30 300 C 120 300, 110 170, 210 170 S 330 250, 380 120" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 11"/>
   <g transform="translate(372 78) rotate(-18)">
    <path d="M44 4 3 21c-2.6 1-2.5 3.1.2 3.9l10.2 3.1 3.9 12.1c.6 1.8 2.5 2.2 3.7 1l5.7-5.2 10.7 7.8c1.6 1.2 3.4.4 3.9-1.6L48.5 8.4C49.1 5.4 46.9 3 44 4Z" fill="#0297DE" stroke="#02070A" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="m13.4 28 23.8-15.3" stroke="#02070A" strokeWidth="2.5" strokeLinecap="round"/>
   </g>
  </svg>
  <div className="tt-login-ticket">
   <div className="tt-login-ticket-main"><span>{c.admit}</span><strong>{c.title}</strong><small>TICKETTREAT</small></div>
   <div className="tt-login-ticket-stub">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>
    <span>{c.code}</span>
   </div>
  </div>
  <div className="tt-login-art-copy"><p>{c.line}</p><span>{c.sub}</span></div>
 </aside>;
}
