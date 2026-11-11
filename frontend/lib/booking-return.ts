const storageKey = "tt-booking-return";

function checkoutPath(value: unknown): string | null {
  if (typeof value !== "string" || !/^\/checkout\/\d+(?:\?|$)/.test(value)) return null;
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin && /^\/checkout\/\d+$/.test(url.pathname)
    ? url.pathname + url.search : null;
}

export function rememberBooking() {
  const path = checkoutPath(location.pathname + location.search);
  try {
    if (path) sessionStorage.setItem(storageKey, JSON.stringify({path, until:Date.now()+30*60*1000}));
  } catch { /* Storage is optional. */ }
}

export function takeBooking(): string | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    if (!raw) return null;
    const item = JSON.parse(raw);
    return item.until > Date.now() ? checkoutPath(item.path) : null;
  } catch { return null; }
}
