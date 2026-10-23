/** Privacy-by-default client device-storage consent.
 * Only the optional Google Maps iframe is controlled for this release.
 * Analytics and advertising are NOT installed, and must never be enabled
 * under this consent version: a new provider requires a new version.
 */
export const CONSENT_KEY = "tt_cookie_choice_v1";
export const CONSENT_VERSION = "2026-10-23/maps-v1";
export const CONSENT_EVENT = "tickettreat-cookie-consent-change";
export const OPEN_CONSENT_EVENT = "tickettreat-open-cookie-settings";
export const CONSENT_LIFETIME_DAYS = 180;

export type ConsentChoice = {
  version: string;
  savedAt: string;
  expiresAt: string;
  necessary: true;
  externalMedia: boolean;
};

function validChoice(obj: unknown): obj is ConsentChoice {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<ConsentChoice>;
  return p.version === CONSENT_VERSION &&
    p.necessary === true &&
    typeof p.externalMedia === "boolean" &&
    typeof p.savedAt === "string" &&
    typeof p.expiresAt === "string" &&
    Number.isFinite(Date.parse(p.savedAt)) &&
    Number.isFinite(Date.parse(p.expiresAt)) &&
    Date.parse(p.savedAt) <= Date.now() &&
    Date.parse(p.expiresAt) > Date.now();
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validChoice(parsed)) return parsed;
    window.localStorage.removeItem(CONSENT_KEY);
  } catch { /* Storage may be disabled in private or managed browsing. */ }
  return null;
}

export function saveConsent(externalMedia: boolean): ConsentChoice {
  const now = new Date();
  const choice: ConsentChoice = {
    version: CONSENT_VERSION,
    savedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONSENT_LIFETIME_DAYS * 86400000).toISOString(),
    necessary: true,
    externalMedia,
  };
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice)); }
  catch { /* Still honor this decision in the current tab. */ }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
  return choice;
}

export function hasExternalMediaConsent(): boolean {
  return readConsent()?.externalMedia === true;
}

export function openCookieSettings(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
