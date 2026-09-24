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

// Public-site gate for the Pickup & Delivery fulfillment mode — still being
// tested internally, so it stays OFF (unset) on production: the public
// request form shows it as a disabled "Soon" option instead of hiding it
// outright. Set NEXT_PUBLIC_PICKUP_DELIVERY_ENABLED=true in a local/preview
// .env to make it fully bookable there for testing. This only gates the
// public entry point — Admin > Riders, Admin > Pickup & Delivery, and the
// Rider app all work regardless, for any request already in that mode.
export const PICKUP_DELIVERY_PUBLIC_ENABLED = process.env.NEXT_PUBLIC_PICKUP_DELIVERY_ENABLED === "true";

// TEMPORARY testing toggle — set PICKUP_DELIVERY_SKIP_PAYMENT=true (Preview
// only) to skip the PayMongo Booking & Diagnostic Fee gate for Pickup &
// Delivery bookings entirely, so a test booking goes straight to "Pending"
// (ready for admin to assign a rider) without a real PayMongo transaction.
// Turn back off (or unset) once done testing the rest of the flow — the
// live keys are shared with the rest of the app, so this is the only way
// to test repeatedly without moving real money each time.
export const PICKUP_DELIVERY_SKIP_PAYMENT = process.env.PICKUP_DELIVERY_SKIP_PAYMENT === "true";
