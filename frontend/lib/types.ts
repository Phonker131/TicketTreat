export type LanguageCode = "en" | "cs" | "ru" | "uk";

export type CrowdlyEvent = {
  id: number;
  title: string;
  organizer: string | null;
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
  payment_instructions_configured?: boolean;
  image_url: string | null;
  starts_at: string | null;
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
  event: CrowdlyEvent | null;
  guest: DemoGuest | null;
};

export type DemoCheckoutResponse = {
  status: "paid" | "already_paid";
  ticket: DemoTicket;
  demo_payment: boolean;
  real_money_charged: boolean;
};

export type AdminEventTickets = {
  event: CrowdlyEvent;
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

export type ManageIdentity = {
  account_id: number;
  email: string;
  role: "participant" | "organizer" | "global_admin";
};
export type ManageEvent = CrowdlyEvent & {owner_account_id: number | null};
export type OrganizerIdentity = {account_id: number;name: string;email: string};
