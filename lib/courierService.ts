import type { CourierStatus } from "./types";

// Courier Service — mail-in repair, nationwide. The customer ships the
// device to a branch by courier, the branch repairs it, then ships it
// back. No riders or technician visits, so it has its own small status
// flow instead of the Pickup & Delivery stages.
//
//   awaiting_unit -> received -> in_repair -> ready_to_ship -> shipped -> delivered
//                                                 (cancelled at any point before shipped)

export const COURIER_STATUS_LABELS: Record<CourierStatus, string> = {
  awaiting_unit: "Awaiting Your Device",
  received: "Received at Branch",
  in_repair: "In Repair",
  ready_to_ship: "Ready to Ship Back",
  shipped: "Shipped Back to You",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Order shown on the customer's tracking timeline (cancelled is off-line).
export const COURIER_STATUS_ORDER: CourierStatus[] = ["awaiting_unit", "received", "in_repair", "ready_to_ship", "shipped", "delivered"];

export function isCourierStatus(v: string): v is CourierStatus {
  return v === "cancelled" || (COURIER_STATUS_ORDER as string[]).includes(v);
}

// Couriers offered in the dropdown; "Other" falls back to free text.
export const COURIER_OPTIONS = ["J&T Express", "LBC", "JRS Express", "Lalamove / Grab Express", "2GO", "Ninja Van", "Flash Express", "Other"];

// Devices are only shipped to this branch (name as in Admin > Branches,
// case-insensitive). The booking form shows its address instead of a branch
// picker, and the booking action rejects any other branch.
export const COURIER_RECEIVING_BRANCH_NAME = "Cubao";
export function isCourierReceivingBranch(name: string): boolean {
  return name.trim().toLowerCase() === COURIER_RECEIVING_BRANCH_NAME.toLowerCase();
}

// Shown after booking (screen + email): the customer arranges and pays for
// the shipment to us themselves — we don't book a courier for them.
export const COURIER_SELF_SHIP_NOTICE =
  "Ikaw mismo ang magpapadala ng device sa branch namin. Hindi kami ang magbo-book ng courier para sa iyo. Pumili ng courier sa baba, ibigay ang address ng branch, at ikaw ang magbabayad ng shipping.";
export const COURIER_LIST = COURIER_OPTIONS.filter((c) => c !== "Other");

export const COURIER_AGREEMENT_VERSION = "2026-10";

// Shown on the booking form (and stored as accepted via agreed_at) —
// a mail-in repair shifts transit risk and shipping costs onto the
// customer, so they're spelled out before booking.
export const COURIER_AGREEMENT_TERMS = [
  "I will pay the courier fee for shipping my device to the branch, and the return shipping fee for sending it back to me.",
  "I will pack my device securely and ship it with a declared (insured) value. Ceejay is not responsible for loss or damage while the device is in transit with the courier.",
  "I have turned off Find My iPhone / Google Find My Device and removed my SIM card, memory card and case before shipping, and I will keep a copy of my data — repairs can erase it.",
  "The repair cost and return shipping fee are confirmed by the branch after diagnosis, and must be paid by InstaPay QR, GCash, or bank transfer (with a screenshot of the receipt) before the device is shipped back.",
  "If I decide not to proceed with the repair after diagnosis, I will pay the return shipping fee to have my device sent back.",
];

export const COURIER_PACKING_TIPS = [
  "Write your reference number on a note inside the package and on the outside of the parcel.",
  "Wrap the device in bubble wrap and use a sturdy box — no loose envelopes.",
  "Turn off Find My iPhone / Find My Device and remove SIM, memory card, case and accessories.",
  "Declare the device's value for insurance when you ship.",
  "After you ship, enter the tracking number you got from the courier on the tracking page. We need it to watch for your parcel.",
];

// How the customer pays the repair cost + return shipping fee: GCash or
// bank transfer, then they upload a screenshot of the receipt on the
// tracking page and staff verify it. Fill in the real accounts here — the
// payment section on the tracking page lists whatever is set.
// Static InstaPay / QR Ph code the customer scans from any bank or e-wallet
// app. Put the image in /public and set its path here, e.g.
// "/courier-payment-qr.png". The site can't tell when a static QR has been
// paid, so the customer still uploads a receipt for staff to verify.
export const COURIER_PAYMENT_QR_IMAGE = "/courier-payment-qr.jpg";

export const COURIER_PAYMENT_METHODS = ["GCash", "Bank Transfer", "InstaPay QR"] as const;
export const COURIER_PAYMENT_ACCOUNTS: { method: (typeof COURIER_PAYMENT_METHODS)[number]; accountName: string; accountNumber: string; bank?: string }[] = [
  // { method: "GCash", accountName: "…", accountNumber: "09xx xxx xxxx" },
  { method: "Bank Transfer", bank: "Banco De Oro (BDO)", accountName: "Ceejay", accountNumber: "008066001024" },
];

export function formatPesos(n: number | null): string {
  return n === null ? "—" : `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
