export const OTP_GATE_ENABLED = true;

// Used to build absolute links in outbound emails (e.g. the booking
// confirmation link) — this app has no per-environment base URL setup, so
// it's always the live production domain regardless of which environment
// sent the email.
export const SITE_URL = "https://www.ceejayrepair.com";

// How long a customer has to click the confirmation link in their
// quotation email before their Home Service Request is auto-voided (see
// app/api/cron/void-unconfirmed-requests).
export const BOOKING_CONFIRMATION_WINDOW_HOURS = 2;

// Cap on how many times a technician can self-correct the Repair Price /
// Labor-Service Cost on their own completed Post-Repair checklist.
export const MAX_PRICE_EDITS = 3;

// Price (pesos) charged for the public iCloud ON/OFF checker (lib/paymongo.ts,
// lib/sickw.ts) — see app/(site)/check-icloud.
export const ICLOUD_CHECK_PRICE_PESOS = 10;
