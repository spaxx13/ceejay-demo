// The Pickup & Delivery Agreement a customer must accept before submitting
// a Pickup & Delivery booking (components/HomeServiceForm.tsx). Fixed
// legal text kept in code, like SERVICE_AGREEMENT_TERMS in lib/checklist.ts
// — bump VERSION whenever the wording changes, so each booking records
// which text the customer actually agreed to
// (home_service_requests.pickup_delivery_agreement_version).
export const PICKUP_DELIVERY_AGREEMENT_VERSION = "2026-10-03.1";

export const PICKUP_DELIVERY_AGREEMENT_TERMS: { title: string; body: string }[] = [
  {
    title: "Booking, Diagnostic & Delivery Fee",
    body: "The fee covers the rider's pickup trip, the initial diagnosis, and delivery of the device back to you, and depends on the distance of your pickup address from our nearest branch: ₱500 for 1–5 km, ₱700 for 6–10 km, ₱800 for 11–15 km, ₱1,000 for 16–20 km, ₱1,200 for 21–25 km, ₱1,400 for 26–30 km, and ₱1,600 for 31 km and above. Pickup & Delivery is available in Metro Manila and in Cainta, Antipolo, and Taytay, Rizal only. The amount is shown on the booking form once you pin your address. It is non-refundable once a rider has been dispatched, and is separate from the repair cost.",
  },
  {
    title: "Repair cost approval",
    body: "The quotation is an estimate. The final repair cost will be confirmed after diagnosis; no repair work starts until you approve it. If you decline the repair, the device is delivered back to you with no additional charge beyond the fee above.",
  },
  {
    title: "Device condition at pickup",
    body: "Our rider will inspect your device with you, complete a condition checklist and take photos before taking it. Pre-existing damage noted at pickup is not covered by any warranty.",
  },
  {
    title: "Unboxing video",
    body: "When the device reaches the shop, our technician records an unboxing/inspection video which you can view on your tracking page — this is our shared record of how the device arrived.",
  },
  {
    title: "Remove your SIM card & accessories before pickup",
    body: "Before the rider arrives, remove your SIM card, memory card, case, screen protector and any accessories. The rider takes the device only. Ceejay Cellphone Repair Shop is not responsible for any SIM card, memory card or accessory left in or with the device, including any charges made on a SIM that was not removed.",
  },
  {
    title: "Your data",
    body: "Please back up your device before pickup. Ceejay Cellphone Repair Shop is not liable for loss of data, and you are responsible for removing locks or providing passcodes needed to test the device (Face ID/Touch ID can be re-enrolled after repair).",
  },
  {
    title: "No guarantee that every repair will succeed",
    body: "We will do our best, but not every device can be repaired and we do not promise a 100% successful repair. This is especially true for logic board problems, water-damaged units, devices that will not power on, and devices previously opened or repaired elsewhere, where the fault may be worse than it first appears or further damage may already exist. If a repair cannot be completed, or the device does not survive a logic board or water damage repair attempt, the device is delivered back to you in its current condition; only the Booking, Diagnostic & Delivery Fee applies and no repair cost is charged for the unsuccessful work. By booking a logic board or water damage repair, you accept this risk.",
  },
  {
    title: "Transit",
    body: "The device is sealed and tracked while with our rider. Our liability for loss or damage in transit is limited to the cost of repair or replacement of the device as assessed by the shop.",
  },
  {
    title: "Delivery & identification",
    body: "The device will only be released to you or a person you authorize, who must present a valid ID and the booking reference. If no one is available on two delivery attempts, the device will be held at the branch for pickup.",
  },
  {
    title: "Unclaimed devices",
    body: "Devices not claimed or re-delivered within 30 days of being ready are subject to storage fees and, after 90 days, may be disposed of in accordance with the law.",
  },
  {
    title: "Warranty",
    body: "Repair warranties follow the shop's standard Service Agreement terms (e.g., 3-day warranty on LCD/OLED for ghost-touch/non-responsive issues only; 1-month battery warranty for quick-discharge issues).",
  },
  {
    title: "Contact & consent",
    body: "By booking, you agree to receive SMS/email/app notifications about this repair.",
  },
];
