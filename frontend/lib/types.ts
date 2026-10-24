export type LanguageCode = "en" | "cs" | "ru" | "uk";


/** Explicitly published, non-sensitive organizer identity; never account email. */
export type OrganizerPublicSummary = {
  slug:string; display_name:string; bio:string; city:string;
  website_url:string; instagram:string; logo_url:string|null; cover_url:string|null;
};
export type OrganizerPublicDetail = OrganizerPublicSummary & {
  upcoming_events:TicketTreatEvent[]; past_events:TicketTreatEvent[];
  upcoming_count:number; past_count:number;
};
export type EditableOrganizerProfile = OrganizerPublicSummary & {published:boolean};

export type TicketTreatEvent = {
  id: number;
  title: string;
  organizer: string | null;
  organizer_profile?: OrganizerPublicSummary|null;
  location: string | null;
  country_code: string | null;
  city: string | null;
  description: string | null;
  max_participants: number | null;
  registered_count?: number;
  spots_left?: number | null;
  price: string | null;
  currency: string | null;
  languages: LanguageCode[];
  payment_required?: boolean;
  payment_status?: string;
  payment_instructions_configured?: boolean;
  image_url: string | null;
  gallery_urls?: string[];
  external_gallery_urls?: string[];
  uploaded_gallery?: {id:number;url:string;position?:number;is_cover?:boolean}[];
  gallery_cover_url?:string|null;
  video_url?: string | null;
  starts_at: string | null;
  reminder_text?: string | null;
  reminder_minutes_before?: number | null;
  publication?: {status:"draft"|"scheduled"|"published";publish_at:string|null;visible:boolean};
  is_cancelled: boolean;
  cancellation_reason?: string | null;
};

export type DemoGuest = {
  id: number;
  access_token: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  visits: number;
};

export type DemoTicket = {
  id: number;
  code: string;
  event_id: number;
  guest_id: number;
  qr_token: string;
  ticket_status: string;
  payment_status: string;
  payment_provider: string;
  payment_amount: string;
  currency: string;
  created_at: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
  event: TicketTreatEvent | null;
  guest: DemoGuest | null;
};

export type DemoCheckoutResponse = {
  status: "paid" | "already_paid" | "registered" | "already_registered";
  ticket: DemoTicket;
  demo_payment: boolean;
  real_money_charged: boolean;
};

export type AdminEventTickets = {
  event: TicketTreatEvent;
  tickets: DemoTicket[];
  waitlist: Array<{
    id: number;
    guest_id: number;
    status: string;
    created_at: string;
    promoted_at: string | null;
    guest: DemoGuest;
  }>;
};

export type WebAccount = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  instagram: string | null;
  contact_preference: "email" | "phone" | "telegram" | "instagram";
  country_code: string | null;
  city: string | null;
  created_at: string;
  role: "participant" | "organizer" | "global_admin";
};

export type WebProfile = {
  account: WebAccount;
  guest: DemoGuest;
  email_verified: boolean;
  admin_claim_available?: boolean;
};

export type WebAuthResult = {
  token: string;
  profile: WebProfile;
};

export type TelegramAuthResult = {
  guest: DemoGuest;
  telegram: {id: number; first_name: string; username: string | null};
  bot_registrations: TicketTreatEvent[];
  accounts_linked: boolean;
};

export type ManageIdentity = {
  account_id: number;
  email: string;
  role: "participant" | "organizer" | "global_admin";
};
export type ManageEvent = TicketTreatEvent & {owner_account_id: number | null;payment_instructions?:string};
export type OrganizerIdentity = {account_id: number;name: string;email: string};
