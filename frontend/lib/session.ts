import type { DemoGuest } from "@/lib/types";
import { getDemoGuest, getWebProfile } from "@/lib/api";
import type { WebAuthResult, WebProfile } from "@/lib/types";

const TOKEN_KEY = "crowdly_demo_guest_token";
const ADMIN_KEY = "crowdly_demo_admin_key";
const WEB_TOKEN_KEY = "crowdly_demo_web_auth";

export function getStoredGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeGuest(guest: DemoGuest) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, guest.access_token);
  }
}

export function clearGuest() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getWebToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WEB_TOKEN_KEY);
}

export function setWebAuth(auth: WebAuthResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WEB_TOKEN_KEY, auth.token);
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
  const token = getWebToken();
  if (!token) return null;
  try {
    const profile = await getWebProfile(token);
    storeGuest(profile.guest);
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
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY) || "";
}

export function setAdminKey(value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ADMIN_KEY, value);
  }
}
