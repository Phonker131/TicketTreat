import type {TicketTreatEvent} from "@/lib/types";

/**
 * Public, server-only event data for search engines and initial HTML.
 * This uses the same published-only endpoints that the browser already uses.
 * Never index private organizer previews, accounts or QR ticket URLs.
 */
const backend = (process.env.BACKEND_API_URL || "").trim().replace(/\/+$/, "");

async function publicFetch(path: string): Promise<unknown> {
  if (!/^https?:\/\//.test(backend)) return null;
  try {
    const response = await fetch(backend + path, {
      next: {revalidate: 180},
      signal: AbortSignal.timeout(4500),
      redirect: "error",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function isPublicEvent(value: unknown): value is TicketTreatEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<TicketTreatEvent>;
  return Number.isSafeInteger(event.id) && Number(event.id) > 0
    && typeof event.title === "string" && event.title.trim().length > 0
    && event.publication?.visible !== false;
}

export async function publicEvents(): Promise<TicketTreatEvent[] | null> {
  const result = await publicFetch("/events");
  if (!Array.isArray(result)) return null;
  return result.filter(isPublicEvent).filter(e => !e.is_cancelled);
}

export async function publicEvent(id: string): Promise<TicketTreatEvent | null> {
  if (!/^[1-9][0-9]{0,8}$/.test(id)) return null;
  const result = await publicFetch(`/events/${id}`);
  if (!isPublicEvent(result) || result.id !== Number(id)) return null;
  return result;
}

export function isUpcomingEvent(event: TicketTreatEvent): boolean {
  if (!event.starts_at || event.is_cancelled) return false;
  const date = new Date(event.starts_at);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}
