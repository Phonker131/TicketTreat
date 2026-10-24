import type {
  AdminEventTickets,
  TicketTreatEvent,
  DemoCheckoutResponse,
  DemoGuest,
  DemoTicket,
  WebAuthResult,
  WebProfile,
  TelegramAuthResult,
} from "@/lib/types";

const API_URL = "/api/gateway";
function browserWebSession():boolean{
  if(typeof window==="undefined")return false;
  // The old marker remains readable for one-time migration to TicketTreat keys.
  const storage=window.localStorage;
  return storage.getItem("tickettreat_web_auth")==="browser-session" ||
    storage.getItem("crowdly_demo_web_auth")==="browser-session";
}
function signedIdentityAvailable():boolean {
  if(typeof window==="undefined")return false;
  const browser=browserWebSession();
  const telegram=Boolean((window as Window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData);
  return browser||telegram;
}


async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const websiteSession = browserWebSession();
  const telegramInitData =
    typeof window !== "undefined"
      ? (window as Window & {Telegram?: {WebApp?: {initData?: string}}}).Telegram?.WebApp?.initData
      : undefined;
  // Production TicketTreat API v1; previously deployed clients using /demo
  // remain supported by the server during the migration.
  const route = path.startsWith("/demo/") ? "/api/v1/" + path.slice("/demo/".length) : path;
  const response = await fetch(`${API_URL}${route}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      "X-TicketTreat-Client": "1",
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
): Promise<TicketTreatEvent[]> {
  return request<TicketTreatEvent[]>(
    `/events${includePast ? "?include_past=true" : ""}`,
    {signal},
  );
}

export function getEvent(
  eventId: string | number,
  signal?: AbortSignal,
): Promise<TicketTreatEvent> {
  return request<TicketTreatEvent>(
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
  source = "direct",
): Promise<DemoCheckoutResponse> {
  return request<DemoCheckoutResponse>(
    signedIdentityAvailable()? `/demo/me/events/${eventId}/checkout` : `/demo/events/${eventId}/checkout`,
    {
      method: "POST",
      body: JSON.stringify(signedIdentityAvailable()?{language,source}:{guest_token:guestToken,language,source}),
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
  return request<TicketTreatEvent>("/demo/admin/events", {
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
    link.download = `tickettreat-event-${eventId}-participants.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  }
}


export function getPublicOrganizers():Promise<import("@/lib/types").OrganizerPublicSummary[]> {
  return request("/demo/public/organizers");
}
export function getPublicOrganizer(slug:string):Promise<import("@/lib/types").OrganizerPublicDetail> {
  return request(`/demo/public/organizers/${encodeURIComponent(slug)}`);
}
export function getOwnOrganizerProfile():Promise<import("@/lib/types").EditableOrganizerProfile> {
  return request("/demo/manage/organizer-profile");
}
export function saveOwnOrganizerProfile(profile:Pick<import("@/lib/types").EditableOrganizerProfile,
  "slug"|"display_name"|"bio"|"city"|"website_url"|"instagram"|"published">):
  Promise<import("@/lib/types").EditableOrganizerProfile> {
  return request("/demo/manage/organizer-profile",{method:"PUT",body:JSON.stringify(profile)});
}
export function uploadOrganizerImage(kind:"logo"|"cover",data_url:string):
  Promise<import("@/lib/types").EditableOrganizerProfile> {
  return request(`/demo/manage/organizer-profile/media/${kind}`,{
    method:"PUT",body:JSON.stringify({data_url})
  });
}
export function deleteOrganizerImage(kind:"logo"|"cover"):
  Promise<import("@/lib/types").EditableOrganizerProfile> {
  return request(`/demo/manage/organizer-profile/media/${kind}`,{method:"DELETE"});
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
export function setManagePublication(token:string,eventId:number,payload:{status:"draft"|"scheduled"|"published";publish_at?:string}):
  Promise<import("@/lib/types").ManageEvent>{
  return request(`/demo/manage/events/${eventId}/publication`,{
    method:"PUT",headers:accountHeaders(token),body:JSON.stringify(payload)
  });
}
export function duplicateManageEvent(token:string,eventId:number,startsAt?:string):
  Promise<import("@/lib/types").ManageEvent>{
  return request(`/demo/manage/events/${eventId}/duplicate`,{
    method:"POST",headers:accountHeaders(token),
    body:JSON.stringify(startsAt?{starts_at:startsAt}:{})
  });
}
export function editManageEvent(token: string, eventId: number, payload: Record<string,unknown>): Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${eventId}`, {method:"PATCH",headers:accountHeaders(token),body:JSON.stringify(payload)});
}
export function cancelManageEvent(token: string, eventId: number, reason: string): Promise<import("@/lib/types").ManageEvent> {
  return request(`/demo/manage/events/${eventId}/cancel`,{method:"POST",headers:accountHeaders(token),body:JSON.stringify({reason})});
}
export type EventEmailStatus = {
  email_enabled:boolean;
  verified_ticket_holders:number;
  message_states:Record<string,number>;
  scope:string;
  telegram_enabled:boolean;
  telegram_recipients:number;
  telegram_message_states:Record<string,number>;
};
export function getEventEmailStatus(token:string,eventId:number):Promise<EventEmailStatus> {
  return request(`/demo/manage/events/${eventId}/email-status`,{headers:accountHeaders(token)});
}
export function uploadManageGalleryPhoto(token:string,eventId:number,dataUrl:string):
  Promise<{id:number;url:string}> {
  return request(`/demo/manage/events/${eventId}/gallery`,{
    method:"POST",headers:accountHeaders(token),body:JSON.stringify({data_url:dataUrl})
  });
}
export function orderManageGallery(token:string,eventId:number,orderedIds:number[],coverId:number|null):Promise<{ordered_ids:number[];cover_id:number|null}>{
  return request(`/demo/manage/events/${eventId}/gallery/order`,{
    method:"PUT",headers:accountHeaders(token),
    body:JSON.stringify({ordered_ids:orderedIds,cover_id:coverId})
  });
}
export function deleteManageGalleryPhoto(token:string,eventId:number,imageId:number):
  Promise<{status:string}> {
  return request(`/demo/manage/events/${eventId}/gallery/${imageId}`,{
    method:"DELETE",headers:accountHeaders(token)
  });
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
  anchor.download=`tickettreat-event-${eventId}-participants.csv`;
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

export type GlobalAdminDelegation = {account_id:number;email:string;granted_at:string};
export function getGlobalAdminDelegations(token:string):Promise<GlobalAdminDelegation[]> {
  return request("/demo/manage/global-admins",{headers:accountHeaders(token)});
}
export function grantGlobalAdmin(token:string,email:string):Promise<{account_id:number;role:string;mfa_setup_required:boolean}> {
  return request("/demo/manage/global-admins/grant",{
    method:"POST",headers:accountHeaders(token),body:JSON.stringify({email})
  });
}
export function revokeGlobalAdmin(token:string,accountId:number):Promise<{status:string}> {
  return request(`/demo/manage/global-admins/${accountId}`,{
    method:"DELETE",headers:accountHeaders(token)
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

export type TelegramLinkStart = {challenge:string; bot_link:string; expires_in_seconds:number};
export function startTelegramAccountLink(token:string):Promise<TelegramLinkStart> {
  return request("/demo/telegram/link/start",{
    method:"POST",headers:{Authorization:`Bearer ${token}`}
  });
}
export function getTelegramAccountLinkStatus(token:string, challenge:string):Promise<{status:string;linked:boolean}> {
  return request(`/demo/telegram/link/status?challenge=${encodeURIComponent(challenge)}`,{
    headers:{Authorization:`Bearer ${token}`}
  });
}
/** This endpoint takes ONLY Telegram-signed initData and a short-lived browser link code. */
export function claimTelegramAccountLink(challenge:string,initData:string):Promise<{linked:boolean;already_linked:boolean;migrated_tickets?:number;legacy_unresolved?:number}> {
  return request("/demo/telegram/link/claim",{
    method:"POST",body:JSON.stringify({challenge,init_data:initData})
  });
}

export type BookingConfig = {demo_payment_mode:boolean;real_money_charged:boolean;verified_accounts_required:boolean};
export type PaidReservation = {
  id:number;event_id:number;status:"pending"|"confirmed"|"expired"|"declined";
  created_at:string;expires_at:string;confirmed_at:string|null;
  guest?:{first_name:string;last_name:string|null;email:string|null};
};
export type PaidReservationStatus = {status:PaidReservation["status"]|"not_joined";
  reservation:PaidReservation|null;payment_instructions:string|null;};
export function requestPaidReservation(eventId:number,language:"en"|"cs"|"ru"|"uk",source="direct"):
  Promise<{reservation:PaidReservation;payment_instructions:string|null}>{
  return request(`/demo/me/events/${eventId}/paid-reservations`,{
    method:"POST",body:JSON.stringify({language,source}),
  });
}
export function getOwnPaidReservation(eventId:number):Promise<PaidReservationStatus>{
  return request(`/demo/me/events/${eventId}/paid-reservations`);
}
export function getManagePaidReservations(token:string,eventId:number):Promise<{reservations:PaidReservation[]}>{
  return request(`/demo/manage/events/${eventId}/paid-reservations`,{headers:accountHeaders(token)});
}
export function decidePaidReservation(token:string,eventId:number,reservationId:number,
  action:"confirm"|"decline"):Promise<{status:string;ticket_id?:number}>{
  return request(`/demo/manage/events/${eventId}/paid-reservations/${reservationId}/${action}`,{
    method:"POST",headers:accountHeaders(token)
  });
}

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

export function requestQuickSignup(email:string,firstName:string,privacyAccepted:boolean):Promise<{status:string}>{
  return request("/demo/auth/quick/request",{
    method:"POST",body:JSON.stringify({email,first_name:firstName,privacy_accepted:privacyAccepted,privacy_version:"2026-10"})
  });
}
export function confirmQuickSignup(email:string,code:string):Promise<WebAuthResult>{
  return request("/demo/auth/quick/confirm",{
    method:"POST",body:JSON.stringify({email,code})
  });
}
export function requestMagicLogin(email:string):Promise<{status:string}>{
  return request("/demo/auth/magic/request",{method:"POST",body:JSON.stringify({email})});
}
export function confirmMagicLogin(email:string,code:string):Promise<WebAuthResult>{
  return request("/demo/auth/magic/confirm",
    {method:"POST",body:JSON.stringify({email,code})});
}

export function sendEventAnnouncement(token:string,id:number,payload:{category:"access"|"logistics"|"schedule";message:string}):
 Promise<{status:string;eligible_notification_deliveries:number}>{
  return request(`/demo/manage/events/${id}/announcement`,{method:"POST",headers:accountHeaders(token),
    body:JSON.stringify(payload)});
}
/** Organizer-owned read-only performance metrics. */
export type PilotInsights = {
  event_id:number; capacity:number|null; registered:number;
  active_qr_tickets:number; checked_in:number; awaiting_checkin:number;event_finished:boolean;
  waitlist:number; cancelled_tickets:number; no_show:number|null;
  occupancy_percent:number|null; attendance_percent:number|null;
  daily_bookings:{date:string;count:number}[];channels:{source:string;registrations:number}[];limitations:string[];
};
export type PilotSettings = {signup_cutoff_minutes:number;reminder_minutes:number[];reminder_text?:string;waitlist_offer_minutes:number;event_duration_minutes:number};
export type CheckinStaff = {account_id:number;email:string;granted_at:string};
export function getPilotInsights(token:string,id:number):Promise<PilotInsights>{
  return request(`/demo/manage/events/${id}/insights`,{headers:accountHeaders(token)});
}
export function getPilotSettings(token:string,id:number):Promise<PilotSettings>{
  return request(`/demo/manage/events/${id}/pilot-settings`,{headers:accountHeaders(token)});
}
export function updatePilotSettings(token:string,id:number,settings:PilotSettings):Promise<PilotSettings>{
  return request(`/demo/manage/events/${id}/pilot-settings`,
    {method:"PUT",headers:accountHeaders(token),body:JSON.stringify(settings)});
}
export function getPilotStaff(token:string,id:number):Promise<CheckinStaff[]>{
  return request(`/demo/manage/events/${id}/checkin-staff`,{headers:accountHeaders(token)});
}
export function grantPilotStaff(token:string,id:number,email:string):Promise<{account_id:number;status:string}>{
  return request(`/demo/manage/events/${id}/checkin-staff`,
    {method:"POST",headers:accountHeaders(token),body:JSON.stringify({email})});
}
export function revokePilotStaff(token:string,id:number,accountId:number):Promise<{status:string}>{
  return request(`/demo/manage/events/${id}/checkin-staff/${accountId}`,
    {method:"DELETE",headers:accountHeaders(token)});
}
export function checkInByList(token:string,eventId:number,ticketId:number):Promise<{status:"checked_in"|"already_checked_in";ticket:DemoTicket}>{
  return request(`/demo/manage/events/${eventId}/check-in-by-list/${ticketId}`,
    {method:"POST",headers:accountHeaders(token),body:JSON.stringify({})});
}
export function scanPilotTicket(token:string,qrToken:string):Promise<{status:"checked_in"|"already_checked_in";ticket:DemoTicket}>{
  return request("/demo/pilot/check-in",{method:"POST",headers:accountHeaders(token),
    body:JSON.stringify({qr_token:qrToken})});
}
export type LoyaltyTier = "newcomer"|"regular"|"insider"|"vip";
export type LoyaltyStudio = {
  organizer_id:number;organizer_name:string;
  season_visits:number;lifetime_visits:number;
  tier:LoyaltyTier;threshold:number;next_threshold:number|null;
  remaining:number;progress_percent:number;
  perks:{key:string;required_visits:number;available:boolean;operational:boolean}[];
};
export type LoyaltyPassport = {
  season:string;season_starts_at:string;season_ends_at:string;
  scope:"per_organizer";total_lifetime_visits:number;studios:LoyaltyStudio[];
};
export function getMyLoyalty():Promise<LoyaltyPassport>{
  return request("/demo/me/loyalty");
}
export type AttendanceHistory = {visit_count:number;limited_to:number;
  history:{event_id:number;title:string;checked_in_at:string;location:string|null}[]};
export type WaitlistOfferStatus = {status:string;expires_at:string|null;position:number|null};
export function getWaitlistOfferStatus(eventId:number):Promise<WaitlistOfferStatus>{
  return request(`/demo/me/events/${eventId}/waitlist/status`);
}
export function claimWaitlistOffer(eventId:number,language:string):Promise<DemoCheckoutResponse>{
  return request(`/demo/me/events/${eventId}/waitlist/claim`,{
    method:"POST",body:JSON.stringify({language})
  });
}
export function declineWaitlistOffer(eventId:number):Promise<{status:string}>{
  return request(`/demo/me/events/${eventId}/waitlist/decline`,{
    method:"POST",body:JSON.stringify({})
  });
}
export function getMyAttendance():Promise<AttendanceHistory>{
  return request("/demo/me/attendance");
}

export type BroadcastAudience = {
  scope:"global"|"event";event_id:number|null;role:"global_admin"|"organizer"|"participant";
  email_recipients:number;telegram_recipients:number;
  email_available:boolean;telegram_available:boolean;service_only:true;
};
export type BroadcastHistory = {
  id:number;scope:"global"|"event";event_id:number|null;
  subject:string;created_at:string;email_count:number;telegram_count:number;
  emails:Record<string,number>;telegram:Record<string,number>;
};
export type BroadcastDraft = {scope:"global"|"event";event_id:number|null};
export type BroadcastSend = BroadcastDraft & {
  request_id:string;subject:string;message:string;image_url:string|null;
  expected_email_recipients:number;expected_telegram_recipients:number;
  confirm:"SEND";service_only:true;
};
export function previewBroadcast(token:string,draft:BroadcastDraft):Promise<BroadcastAudience> {
  return request("/demo/manage/broadcasts/preview",{method:"POST",headers:accountHeaders(token),body:JSON.stringify(draft)});
}
export function sendBroadcast(token:string,payload:BroadcastSend):Promise<BroadcastHistory> {
  return request("/demo/manage/broadcasts",{method:"POST",headers:accountHeaders(token),body:JSON.stringify(payload)});
}
export function getBroadcastHistory(token:string):Promise<BroadcastHistory[]> {
  return request("/demo/manage/broadcasts",{headers:accountHeaders(token)});
}

/** Wallet passes are available only after Apple Pass Type credentials are configured. */
export function getWalletStatus():Promise<{enabled:boolean}>{
  return request("/demo/wallet/status");
}
/** Global email transport readiness, without exposing account existence. */
export function getMailStatus():Promise<{available:boolean}>{
  return request("/demo/auth/email/status");
}

/** Support: website account owns its tickets; only global admins can read the inbox. */
export type SupportTicket={
  id:number;subject:string;category:string;status:"open"|"answered"|"closed";
  created_at:string;updated_at:string;last_customer_at:string;
  unread?:boolean;customer?:{name:string;email:string|null};
};
export type SupportMessage={
  id:number;role:"customer"|"admin";body:string;created_at:string;
  email_status?:"pending"|"sent"|"failed"|"skipped"|"not_queued";
};
export type SupportThread={ticket:SupportTicket;messages:SupportMessage[]};
export type SupportSummary={unread:number;open:number;answered:number};
export function createSupportTicket(category:string,subject:string,body:string):
  Promise<{id:number;status:string}>{
  return request("/demo/support/tickets",{method:"POST",body:JSON.stringify({category,subject,body})});
}
export function listMySupportTickets():Promise<{tickets:SupportTicket[]}>{
  return request("/demo/support/tickets");
}
export function getMySupportTicket(id:number):Promise<SupportThread>{
  return request(`/demo/support/tickets/${id}`);
}
export function replyMySupportTicket(id:number,body:string):Promise<{status:string}>{
  return request(`/demo/support/tickets/${id}/messages`,{method:"POST",body:JSON.stringify({body})});
}
export function getSupportSummary():Promise<SupportSummary>{
  return request("/demo/manage/support/summary");
}
export function listAdminSupportTickets(status:"all"|"open"|"answered"|"closed"="all"):
  Promise<{tickets:SupportTicket[]}>{
  return request(`/demo/manage/support/tickets?status=${status}`);
}
export function getAdminSupportTicket(id:number):Promise<SupportThread>{
  return request(`/demo/manage/support/tickets/${id}`);
}
export function markSupportRead(id:number):Promise<{status:string}>{
  return request(`/demo/manage/support/tickets/${id}/read`,{method:"POST"});
}
export function replyAdminSupportTicket(id:number,body:string):
  Promise<{id:number;status:string;email_status:string}>{
  return request(`/demo/manage/support/tickets/${id}/reply`,{method:"POST",body:JSON.stringify({body})});
}
export function closeAdminSupportTicket(id:number):Promise<{status:string}>{
  return request(`/demo/manage/support/tickets/${id}/close`,{method:"POST"});
}
