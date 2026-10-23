"use client";
import {openCookieSettings} from "@/lib/cookie-consent";
export function CookieSettingsControl(){
  return <button type="button" className="button button-outline" onClick={openCookieSettings}>
    Cookie settings / Nastavení cookies
  </button>;
}
