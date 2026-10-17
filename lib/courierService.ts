import type { CourierDeliveryMode, CourierStatus } from "./types";

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
// Shown after booking (screen + email): the company only knows the device
// is on its way once the customer enters the courier's tracking number.
export const COURIER_TRACKING_REMINDER =
  "Pagkatapos mong ipadala ang unit sa courier, kailangan mong ilagay ang tracking number na ibinigay ng courier sa \"Track This Request\" para malaman namin na naipadala mo na ito.";
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

// ---------- Self-book mode (Pickup & Delivery option 2) ----------
// The customer books and pays a Lalamove / Grab driver themselves, both to
// bring the device to the branch and to bring it back. Same request
// lifecycle as above; only the wording and the hand-over check differ.

export const SELF_BOOK_COURIER_OPTIONS = ["Lalamove", "Grab Express", "Other"];
export const SELF_BOOK_COURIER_LIST = SELF_BOOK_COURIER_OPTIONS.filter((c) => c !== "Other");
export const SELF_BOOK_LINKS = [
  { label: "Lalamove", href: "https://www.lalamove.com/en-ph" },
  { label: "GrabExpress", href: "https://www.grab.com/ph/express/" },
];

// Status labels for self-book requests (the stored statuses are the same).
export const SELF_BOOK_STATUS_LABELS: Record<CourierStatus, string> = {
  ...COURIER_STATUS_LABELS,
  awaiting_unit: "Waiting for Your Driver to Bring the Device",
  ready_to_ship: "Ready — Book Your Return Driver",
  shipped: "Released to Your Driver",
};

export function courierStatusLabel(mode: CourierDeliveryMode, status: CourierStatus): string {
  return (mode === "self_book" ? SELF_BOOK_STATUS_LABELS : COURIER_STATUS_LABELS)[status];
}

export const SELF_BOOK_NOTICE =
  "Ikaw mismo ang magbo-book ng Lalamove o Grab driver, at ikaw ang magbabayad nito. Hindi kami ang magbo-book para sa iyo. Gamitin ang address ng branch bilang drop-off, at ilagay sa notes ang reference number at pangalan mo.";
export const SELF_BOOK_TRACKING_REMINDER =
  "Pagkatapos mong mag-book, ilagay ang tracking link o booking number, pangalan ng driver, at plate number sa \"Track This Request\" para alam namin kung sino ang darating.";
export const SELF_BOOK_RETURN_NOTICE =
  "Bayad na! Mag-book ng Lalamove o Grab driver na kukuha ng device sa branch at maghahatid sa iyo. Ilagay dito ang booking details para ma-verify ng branch ang driver bago ilabas ang device.";

export const SELF_BOOK_PACKING_TIPS = [
  "Isulat ang reference number mo sa notes ng booking sa Lalamove / Grab.",
  "Ilagay ang device sa maliit na box o padded pouch, at huwag ipasa nang walang takip.",
  "I-off ang Find My iPhone / Find My Device at tanggalin ang SIM, memory card at case.",
  "Mag-declare ng value ng device sa booking kung may option ito.",
  "Ibigay ng driver ang pangalan at plate number niya sa booking, ilagay ito sa tracking page.",
];

export const SELF_BOOK_AGREEMENT_TERMS = [
  "I will book and pay a Lalamove or Grab driver myself to bring my device to the branch, and again to bring it back to me after the repair.",
  "I will pack my device securely and declare its value when booking. Ceejay is not responsible for loss or damage while the device is with the driver.",
  "I have turned off Find My iPhone / Google Find My Device and removed my SIM card, memory card and case, and I will keep a copy of my data — repairs can erase it.",
  "The repair cost is confirmed by the branch after diagnosis and must be paid by InstaPay QR, GCash, or bank transfer (with a screenshot of the receipt) before the device is released to my driver.",
  "The branch will only release the device to a driver whose plate number and hand-over code match my booking.",
  "If I decide not to proceed with the repair after diagnosis, I will book a driver to collect my device from the branch.",
];

export function formatPesos(n: number | null): string {
  return n === null ? "—" : `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
