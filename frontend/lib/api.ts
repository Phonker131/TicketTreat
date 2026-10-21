import type {
  AdminEventTickets,
  CrowdlyEvent,
  DemoCheckoutResponse,
  DemoGuest,
  DemoTicket,
  WebAuthResult,
  WebProfile,
  TelegramAuthResult,
} from "@/lib/types";

const API_URL = "/api/gateway";
function signedIdentityAvailable():boolean {
  if(typeof window==="undefined")return false;
  const browser=window.localStorage.getItem("crowdly_demo_web_auth")==="browser-session";
  const telegram=Boolean((window as Window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData);
  return browser||telegram;
}


async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const websiteSession =
    typeof window !== "undefined" &&
    window.localStorage.getItem("crowdly_demo_web_auth") === "browser-session";
  const telegramInitData =
    typeof window !== "undefined"
      ? (window as Window & {Telegram?: {WebApp?: {initData?: string}}}).Telegram?.WebApp?.initData
      : undefined;
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      "X-Crowdly-Client": "1",
      ...(websiteSession ? {Authorization: "Bearer browser-session"} : {}),
      ...(telegramInitData ? {"X-Telegram-Init-Data": telegramInitData} : {}),
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
  language: "en" | "cs" | "ru" | "uk" = "en",
): Promise<DemoCheckoutResponse> {
  return request<DemoCheckoutResponse>(
    signedIdentityAvailable()? `/demo/me/events/${eventId}/checkout` : `/demo/events/${eventId}/checkout`,
    {
      method: "POST",
      body: JSON.stringify(signedIdentityAvailable()?{language}:{guest_token:guestToken,language}),
    },
  );
}

export function joinWaitlist(
  eventId: number,
  guestToken: string,
): Promise<{status: string; position?: number}> {
  return request(signedIdentityAvailable()? `/demo/me/events/${eventId}/waitlist` : `/demo/events/${eventId}/waitlist`, {
    method: "POST",
    body: JSON.stringify(signedIdentityAvailable()?{}:{guest_token:guestToken}),
  });
}

export function getDemoTickets(
  guestToken: string,
): Promise<DemoTicket[]> {
  return request<DemoTicket[]>(
    signedIdentityAvailable()?"/demo/me/tickets":`/demo/guests/${encodeURIComponent(guestToken)}/tickets`,
  );
}

export function getDemoTicket(
  guestToken: string,
  ticketId: string | number,
): Promise<DemoTicket> {
  return request<DemoTicket>(
    signedIdentityAvailable()?`/demo/me/tickets/${ticketId}`:`/demo/guests/${encodeURIComponent(guestToken)}/tickets/${ticketId}`,
  );
}

export function cancelDemoTicket(
  guestToken: string,
  ticketId: number,
): Promise<{status: string; ticket: DemoTicket}> {
  return request(
    signedIdentityAvailable()?`/demo/me/tickets/${ticketId}`:`/demo/guests/${encodeURIComponent(guestToken)}/tickets/${ticketId}`,
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

/** Validate admin access on the server, not just in browser storage. */
export function verifyDemoAdminKey(adminKey: string): Promise<{authenticated: boolean}> {
  return request<{authenticated: boolean}>("/demo/admin/verify", {
    headers: {"X-Demo-Admin-Key": adminKey},
  });
}

export type WebRegistration = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  instagram?: string | null;
  contact_preference: string;
  guest_token?: string | null;
  account_role?: "participant" | "organizer";
  country_code: string;
  city: string;
  language?: "en" | "cs" | "ru" | "uk";
};

export async function signupWebAccount(payload: WebRegistration): Promise<WebAuthResult> {
  return request<WebAuthResult>("/demo/auth/signup", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export async function loginWebAccount(email: string, password: string): Promise<WebAuthResult> {
  return request<WebAuthResult>("/demo/auth/login", {
    method: "POST", body: JSON.stringify({email, password}),
  });
}

export async function getWebProfile(token: string): Promise<WebProfile> {
  return request<WebProfile>("/demo/auth/me", {
    headers: {Authorization: `Bearer ${token}`},
  });
}

export async function updateWebProfile(
  token: string, payload: Record<string, unknown>,
): Promise<WebProfile> {
  return request<WebProfile>("/demo/auth/me", {
    method: "PATCH",
    headers: {Authorization: `Bearer ${token}`},
    body: JSON.stringify(payload),
  });
}

export async function logoutWebAccount(token: string): Promise<void> {
  await request<{status: string}>("/demo/auth/logout", {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`},
  });
}

export async function downloadEventParticipantsCsv(eventId: number, adminKey: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/demo/admin/events/${encodeURIComponent(String(eventId))}/participants.csv`,
    {headers: {"X-Demo-Admin-Key": adminKey}, cache: "no-store"},
  );
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Неверный ключ администратора." : `CSV export failed (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `crowdly-event-${eventId}-participants.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  }
}

/** Every manage route requires a logged-in account, not the old shared key. */
function accountHeaders(token: string): HeadersInit {
  return {Authorization: `Bearer ${token}`};
}

export function getManageMe(token: string): Promise<import("@/lib/types").ManageIdentity> {
  return request("/demo/manage/me", {headers:accountHeaders(token)});
}
export function getManageEvents(token: string): Promise<import("@/lib/types").ManageEvent[]> {
  return request("/demo/manage/events", {headers:accountHeaders(token)});
}
export function getManageEvent(id: number, token: string): Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${id}`, {headers:accountHeaders(token)});
}
export function addManageEvent(token: string, payload: Record<string, unknown>): Promise<import("@/lib/types").ManageEvent> {
  return request("/demo/manage/events", {method:"POST",headers:accountHeaders(token),body:JSON.stringify(payload)});
}
export function editManageEvent(token: string, eventId: number, payload: Record<string,unknown>): Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${eventId}`, {method:"PATCH",headers:accountHeaders(token),body:JSON.stringify(payload)});
}
export function cancelManageEvent(token: string, eventId: number, reason: string): Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${eventId}/cancel`,{method:"POST",headers:accountHeaders(token),body:JSON.stringify({reason})});
}
export function getManageParticipants(token:string, eventId:number): Promise<AdminEventTickets> {
  return request(`/demo/manage/events/${eventId}/participants`,{headers:accountHeaders(token)});
}
export function checkInManagedTicket(token:string, qrToken:string):Promise<{status:string;ticket:DemoTicket}> {
  return request(`/demo/manage/check-in`,{method:"POST",headers:accountHeaders(token),body:JSON.stringify({qr_token:qrToken})});
}
export async function exportManageParticipantsCsv(token:string,eventId:number):Promise<void> {
  const r=await fetch(`${API_URL}/demo/manage/events/${eventId}/participants.csv`,{
    headers:accountHeaders(token),cache:"no-store"
  });
  if(!r.ok) throw new Error(r.status===403?"Access denied for this event":`Export failed (HTTP ${r.status})`);
  const data=await r.blob();
  const url=URL.createObjectURL(data);
  const anchor=document.createElement("a");anchor.href=url;
  anchor.download=`crowdly-event-${eventId}-participants.csv`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),120000);
}
export function listManageOrganizers(token:string):Promise<import("@/lib/types").OrganizerIdentity[]> {
  return request("/demo/manage/organizers",{headers:accountHeaders(token)});
}
export function assignManageOwner(token:string,eventId:number,ownerAccountId:number):Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${eventId}/owner`,{method:"PUT",headers:accountHeaders(token),body:JSON.stringify({owner_account_id:ownerAccountId})});
}
export function getManageAudit(token:string,eventId:number):Promise<{action:string;details:string;actor_account_id:number;at:string}[]> {
  return request(`/demo/manage/events/${eventId}/audit`,{headers:accountHeaders(token)});
}

export type ManagedAccount = {
  account_id: number; email: string; name: string;
  role: "participant" | "organizer" | "global_admin";
};
export function getManagedAccounts(token:string):Promise<ManagedAccount[]> {
  return request("/demo/manage/accounts",{headers:accountHeaders(token)});
}
export function setManagedAccountRole(token:string,accountId:number,role:"participant"|"organizer"):Promise<{account_id:number;role:string}> {
  return request(`/demo/manage/accounts/${accountId}/role`,{
    method:"PUT",headers:accountHeaders(token),body:JSON.stringify({role})
  });
}

/** Recover a configured global-admin account; server verifies the recovery secret. */
export function claimWebGlobalAdmin(token: string, recoveryKey: string): Promise<{role:"global_admin";account_id:number}> {
  return request("/demo/auth/admin-claim", {
    method:"POST",
    headers:{Authorization:`Bearer ${token}`},
    body:JSON.stringify({recovery_key:recoveryKey}),
  });
}

/** Password rotation returns a new session and revokes every old one. */
export async function changeWebPassword(token: string, current_password: string, new_password: string): Promise<WebAuthResult> {
  return request<WebAuthResult>("/demo/auth/change-password", {
    method: "POST", headers: {Authorization: `Bearer ${token}`},
    body: JSON.stringify({current_password, new_password}),
  });
}

export async function logoutAllWebSessions(token: string): Promise<void> {
  await request<{status: string}>("/demo/auth/logout-all", {
    method: "POST", headers: {Authorization: `Bearer ${token}`},
  });
}

export async function getWebSessions(token: string): Promise<{sessions: {id: number; created_at: string; expires_at: string}[]}> {
  return request("/demo/auth/sessions", {headers: {Authorization: `Bearer ${token}`}});
}

/** Only signed Telegram WebApp.initData is accepted; never send initDataUnsafe.user. */
export function authenticateTelegram(initData: string): Promise<TelegramAuthResult> {
  return request<TelegramAuthResult>("/demo/telegram/auth", {
    method: "POST",
    body: JSON.stringify({init_data: initData}),
  });
}


/** Confirmation of an already authenticated website account. */
export function requestEmailVerification(token:string):Promise<{status:string}> {
  return request("/demo/auth/email/request-verification",{method:"POST",headers:{Authorization:`Bearer ${token}`}});
}
export function confirmAccountEmail(token:string,email:string,code:string):Promise<{email_verified:boolean}> {
  return request("/demo/auth/email/confirm",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({email,code})});
}
/** Returns generic response, never leaks whether an address exists. */
export function requestPasswordReset(email:string):Promise<{status:string}> {
  return request("/demo/auth/password/forgot",{method:"POST",body:JSON.stringify({email})});
}
export function confirmPasswordReset(email:string,code:string,newPassword:string):Promise<{status:string}> {
  return request("/demo/auth/password/reset",{method:"POST",body:JSON.stringify({email,code,new_password:newPassword})});
}

export type SiteLanding = {headline:string;subtitle:string;hero_image_url:string|null};
export function getSiteLanding():Promise<SiteLanding> {
  return request("/demo/site/landing");
}
export function updateSiteLanding(token:string,payload:{
  headline:string;subtitle:string;hero_image_data_url?:string|null;remove_hero_image?:boolean;
}):Promise<SiteLanding> {
  return request("/demo/manage/site/landing",{
    method:"PUT",headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(payload)
  });
}

export function exportAccountData(token:string):Promise<unknown> {
  return request("/demo/auth/export",{headers:{Authorization:`Bearer ${token}`}});
}

export function linkTelegramToWebsite(token:string,initData:string):Promise<{linked:boolean;already_linked:boolean;migrated_tickets?:number}> {
  return request("/demo/telegram/link",{
    method:"POST",headers:{Authorization:`Bearer ${token}`},
    body:JSON.stringify({init_data:initData})
  });
}

export type BookingConfig = {demo_payment_mode:boolean;real_money_charged:boolean;verified_accounts_required:boolean};
export function getBookingConfig():Promise<BookingConfig> {
  return request("/demo/config");
}

export type PrivacyRequestStatus = {
  status: "none" | "pending" | "withdrawn" | "completed";
  requested_at: string | null;
  updated_at: string | null;
  response_due_at: string | null;
  note: string;
};
export function getPrivacyRequest(): Promise<PrivacyRequestStatus> {
  return request("/demo/auth/privacy-request");
}
export function submitPrivacyRequest(password: string): Promise<{status:string;message:string}> {
  return request("/demo/auth/privacy-request", {
    method:"POST", body:JSON.stringify({current_password:password}),
  });
}
export function withdrawPrivacyRequest(): Promise<{status:string}> {
  return request("/demo/auth/privacy-request",{method:"DELETE"});
}

export type MFAStatus = {enabled:boolean;elevated:boolean;needs_setup:boolean};
export type MFAStart = {secret:string;otpauth_url:string};
export function getMFAStatus():Promise<MFAStatus> {
  return request("/demo/auth/mfa/status");
}
export function startMFA(password:string):Promise<MFAStart> {
  return request("/demo/auth/mfa/start",{method:"POST",body:JSON.stringify({current_password:password})});
}
export function confirmMFA(code:string):Promise<MFAStatus> {
  return request("/demo/auth/mfa/confirm",{method:"POST",body:JSON.stringify({code})});
}
export function elevateMFA(code:string):Promise<MFAStatus> {
  return request("/demo/auth/mfa/elevate",{method:"POST",body:JSON.stringify({code})});
}

export type PendingErasure = {request_id:number;account_id:number;email:string;created_at:string};
export function listErasureRequests():Promise<PendingErasure[]> {
  return request("/demo/manage/privacy-requests");
}
export function fulfillErasureRequest(requestId:number,justification:string):Promise<{status:string;account_id:number}> {
  return request(`/demo/manage/privacy-requests/${requestId}/fulfill`,{
    method:"POST",body:JSON.stringify({confirmation:"ERASE",justification}),
  });
}

export type OrganizerApplicationStatus = {status:string;role:string};
export type PendingOrganizer = {account_id:number;email:string;created_at:string};
export function getOrganizerApplication():Promise<OrganizerApplicationStatus>{
  return request("/demo/auth/organizer-application");
}
export function applyAsOrganizer():Promise<{status:string}>{
  return request("/demo/auth/organizer-application",{method:"POST"});
}
export function listOrganizerApplications():Promise<PendingOrganizer[]>{
  return request("/demo/manage/organizer-applications");
}
export function decideOrganizer(accountId:number,approve:boolean):Promise<{status:string}>{
  return request(`/demo/manage/organizer-applications/${accountId}/decision`,{
    method:"POST",body:JSON.stringify({approve}),
  });
}
