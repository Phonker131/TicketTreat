import type { DemoGuest } from "@/lib/types";
import { getDemoGuest, getWebProfile, authenticateTelegram } from "@/lib/api";
import { getTelegramWebApp } from "@/lib/telegram";
import type { TelegramAuthResult, WebAuthResult, WebProfile } from "@/lib/types";

const TOKEN_KEY = "crowdly_demo_guest_token";
const ADMIN_KEY = "crowdly_demo_admin_key";
const WEB_TOKEN_KEY = "crowdly_demo_web_auth";
const SESSION_MARKER = "browser-session";
let telegramAuthPromise: Promise<TelegramAuthResult | null> | null = null;
let activeGuest: DemoGuest | null = null;
// Old persistent guest tokens are deliberately never rehydrated. Current
// verified accounts restore identity from the HttpOnly session / signed TG.
function clearLegacyGuestStorage(){
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_KEY);
}

/** Web app user identity is verified by FastAPI using bot-token HMAC.
 * Do not merge verified Telegram identity with website email accounts.
 */
export function getVerifiedTelegramSession(): Promise<TelegramAuthResult | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const initData = getTelegramWebApp()?.initData;
  if (!initData) return Promise.resolve(null);
  if (!telegramAuthPromise) {
    telegramAuthPromise = authenticateTelegram(initData).then(result => {
      if (!getWebToken()) {
        storeGuest(result.guest);
        window.dispatchEvent(new Event("crowdly-auth-change"));
      }
      return result;
    }).catch(error => {
      telegramAuthPromise = null;
      throw error;
    });
  }
  return telegramAuthPromise;
}


export function getStoredGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  clearLegacyGuestStorage();
  // Demo-only anonymous reservations may persist for this browser tab.
  // Public production sessions rehydrate from server, never browser storage.
  if (process.env.NODE_ENV !== "production") {
    return activeGuest?.access_token || sessionStorage.getItem(TOKEN_KEY);
  }
  return activeGuest?.access_token || null;
}

export function storeGuest(guest: DemoGuest) {
  activeGuest=guest;
  if (typeof window === "undefined") return;
  clearLegacyGuestStorage();
  if (process.env.NODE_ENV !== "production") {
    sessionStorage.setItem(TOKEN_KEY,guest.access_token);
  }
}

export function clearGuest() {
  activeGuest=null;
  if (typeof window === "undefined") return;
  clearLegacyGuestStorage();
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getWebToken(): string | null {
  if (typeof window === "undefined") return null;
  const marker = localStorage.getItem(WEB_TOKEN_KEY);
  if(marker && marker!==SESSION_MARKER){localStorage.removeItem(WEB_TOKEN_KEY);return null;}
  return marker;
}

export function setWebAuth(auth: WebAuthResult): void {
  if (typeof window === "undefined") return;
  // Real tokens are in HttpOnly cookies managed by the server gateway.
  localStorage.setItem(WEB_TOKEN_KEY, SESSION_MARKER);
  storeGuest(auth.profile.guest);
  window.dispatchEvent(new Event("crowdly-auth-change"));
}

export function clearWebAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WEB_TOKEN_KEY);
  clearGuest();
  window.dispatchEvent(new Event("crowdly-auth-change"));
}

export async function restoreWebProfile(): Promise<WebProfile | null> {
  const token = getWebToken() || SESSION_MARKER;
  try {
    const profile = await getWebProfile(token);
    setWebAuth({token:SESSION_MARKER,profile});
    return profile;
  } catch (error) {
    if ((error as {status?: number})?.status === 401) {
      clearWebAuth();
      return null;
    }
    throw error;
  }
}

export async function restoreGuest(): Promise<DemoGuest | null> {
  // Inside Telegram always use the user proved by signed initData.
  // A saved website account may be present in the same browser, but it must
  // never silently replace the Telegram identity for tickets/checkout.
  if (getTelegramWebApp()?.initData) {
    const result = await getVerifiedTelegramSession();
    return result?.guest || null;
  }
  const webToken = getWebToken();
  if (webToken) {
    const profile = await restoreWebProfile();
    return profile?.guest || null;
  }
  const token = getStoredGuestToken();
  if (token) {
    try {
      return await getDemoGuest(token);
    } catch {
      clearGuest();
    }
  }

  // No implicit Telegram login: initDataUnsafe is not signed or verified.
  // The demo asks guests to enter a name and email until verified Telegram
  // identity or email magic-link login is implemented.
  return null;
}

export function getAdminKey(): string {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return "";
  return sessionStorage.getItem(ADMIN_KEY) || "";
}

export function setAdminKey(value: string) {
  if (typeof window === "undefined") return;
  clearLegacyGuestStorage();
  if (process.env.NODE_ENV !== "production") sessionStorage.setItem(ADMIN_KEY,value);
}
