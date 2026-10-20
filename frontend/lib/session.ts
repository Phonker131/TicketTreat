import type { DemoGuest } from "@/lib/types";
import { getDemoGuest } from "@/lib/api";

const TOKEN_KEY = "crowdly_demo_guest_token";
const ADMIN_KEY = "crowdly_demo_admin_key";

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

export async function restoreGuest(): Promise<DemoGuest | null> {
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
