import type {
  AdminEventTickets,
  CrowdlyEvent,
  DemoCheckoutResponse,
  DemoGuest,
  DemoTicket,
} from "@/lib/types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? {"Content-Type": "application/json"} : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `API ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload?.detail || payload?.error || detail;
    } catch {}
    const error = new Error(String(detail)) as Error & {status?: number};
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export function getEvents(
  signal?: AbortSignal,
  includePast = false,
): Promise<CrowdlyEvent[]> {
  return request<CrowdlyEvent[]>(
    `/events${includePast ? "?include_past=true" : ""}`,
    {signal},
  );
}

export function getEvent(
  eventId: string | number,
  signal?: AbortSignal,
): Promise<CrowdlyEvent> {
  return request<CrowdlyEvent>(
    `/events/${encodeURIComponent(String(eventId))}`,
    {signal},
  );
}

export function createDemoGuest(payload: {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  telegram_id?: number | null;
  username?: string | null;
}): Promise<DemoGuest> {
  return request<DemoGuest>("/demo/guests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDemoGuest(token: string): Promise<DemoGuest> {
  return request<DemoGuest>(
    `/demo/guests/${encodeURIComponent(token)}`,
  );
}

export function demoCheckout(
  eventId: number,
  guestToken: string,
): Promise<DemoCheckoutResponse> {
  return request<DemoCheckoutResponse>(
    `/demo/events/${eventId}/checkout`,
    {
      method: "POST",
      body: JSON.stringify({guest_token: guestToken}),
    },
  );
}

export function joinWaitlist(
  eventId: number,
  guestToken: string,
): Promise<{status: string; position?: number}> {
  return request(`/demo/events/${eventId}/waitlist`, {
    method: "POST",
    body: JSON.stringify({guest_token: guestToken}),
  });
}

export function getDemoTickets(
  guestToken: string,
): Promise<DemoTicket[]> {
  return request<DemoTicket[]>(
    `/demo/guests/${encodeURIComponent(guestToken)}/tickets`,
  );
}

export function getDemoTicket(
  guestToken: string,
  ticketId: string | number,
): Promise<DemoTicket> {
  return request<DemoTicket>(
    `/demo/guests/${encodeURIComponent(guestToken)}/tickets/${ticketId}`,
  );
}

export function cancelDemoTicket(
  guestToken: string,
  ticketId: number,
): Promise<{status: string; ticket: DemoTicket}> {
  return request(
    `/demo/guests/${encodeURIComponent(guestToken)}/tickets/${ticketId}`,
    {method: "DELETE"},
  );
}

export function getAdminEventTickets(
  eventId: number,
  adminKey: string,
): Promise<AdminEventTickets> {
  return request<AdminEventTickets>(
    `/demo/admin/events/${eventId}/tickets`,
    {headers: {"X-Demo-Admin-Key": adminKey}},
  );
}

export function adminCheckIn(
  qrToken: string,
  adminKey: string,
): Promise<{status: string; ticket: DemoTicket}> {
  return request(
    `/demo/admin/check-in/${encodeURIComponent(qrToken)}`,
    {
      method: "POST",
      headers: {"X-Demo-Admin-Key": adminKey},
    },
  );
}

export function createEvent(payload: Record<string, unknown>, adminKey: string) {
  return request<CrowdlyEvent>("/demo/admin/events", {
    method: "POST",
    headers: {"X-Demo-Admin-Key": adminKey},
    body: JSON.stringify(payload),
  });
}
