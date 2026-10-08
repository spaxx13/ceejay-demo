import "server-only";
import { Resend } from "resend";
import type { ChecklistItem } from "./types";
import { generateRepairReceiptPdf, generateQuotationPdf } from "./receiptPdf";
import { SITE_URL } from "./config";
import { PICKUP_DELIVERY_AGREEMENT_TERMS } from "./pickupDeliveryAgreement";

const FROM = "Ceejay Cellphone Repair Shop <noreply@ceejayrepair.com>";

// Every send is capped (Resend's SDK has no request timeout of its own):
// an email provider that stalls must surface as a failed email — which the
// callers already handle (logged, noted on the activity log) — rather than
// hold a server action like the post-repair checklist open until the
// serverless function is killed and the technician's screen sits on
// "Saving…" forever.
const SEND_TIMEOUT_MS = 20_000;
function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const resend = new Resend(key);
  type SendArgs = Parameters<typeof resend.emails.send>;
  type SendResult = Awaited<ReturnType<typeof resend.emails.send>>;
  return {
    emails: {
      send: (...args: SendArgs): Promise<SendResult> =>
        new Promise<SendResult>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Email send timed out after ${SEND_TIMEOUT_MS / 1000}s`)), SEND_TIMEOUT_MS);
          resend.emails.send(...args).then(
            (r) => {
              clearTimeout(timer);
              resolve(r);
            },
            (e) => {
              clearTimeout(timer);
              reject(e);
            }
          );
        }),
    },
  };
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendRepairReceiptEmail(
  to: string,
  opts: {
    customerName: string;
    reference: string;
    serviceDate: string;
    deviceLabel: string;
    natureOfRepair: string;
    warrantyCoverage: string;
    postNotes: string;
    repairCost: number;
    serviceFee: number;
    technicianName: string;
    preItems: ChecklistItem[];
    postItems: ChecklistItem[];
    preCustomerSignature: string | null;
    preTechnicianSignature: string | null;
    postCustomerSignature: string | null;
    postTechnicianSignature: string | null;
    receiptPhoto: string | null;
    photoLabel?: string;
  }
) {
  const client = getClient();
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = opts.repairCost + opts.serviceFee;

  const pdfBytes = await generateRepairReceiptPdf(opts);

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
      <h2 style="margin: 4px 0 16px;">Your repair receipt is ready</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(opts.customerName)}, thanks for choosing Ceejay Cellphone Repair Shop. Your receipt for
        <strong>${escapeHtml(opts.reference)}</strong> (${escapeHtml(opts.deviceLabel || "your device")}, ${peso(total)}) is attached as a PDF —
        it includes the full pre- and post-repair checklist results and both signed copies.
      </p>
      <p style="font-size: 13px; color: #64748b;">If anything looks off, just reply to this email or contact the branch you visited.</p>
    </div>
  `;

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your repair receipt — ${opts.reference}`,
    html,
    attachments: [{ filename: `receipt-${opts.reference}.pdf`, content: Buffer.from(pdfBytes) }],
  });
  if (error) throw new Error(error.message);
}

export type QuotationDevice = {
  reference: string;
  deviceLabel: string;
  serviceType: string;
  issueDescription: string;
  repairCost: number | null;
};

// One email covers the whole booking, not one per device — the service
// fee is for the technician's single visit to one address, so it's shown
// (and totalled) exactly once here regardless of how many devices are in
// `devices`; each device still gets its own line with its own repair cost.
export async function sendQuotationEmail(
  to: string,
  opts: {
    customerName: string;
    referenceList: string;
    requestDate: string;
    devices: QuotationDevice[];
    preferredDate: string;
    address: string;
    serviceFee: number | null;
    confirmationUrl: string | null;
    confirmationWindowMinutes: number;
    downpaymentRequired: boolean;
    downpaymentAmount: number | null;
    fulfillmentMode: "on_site" | "pickup_delivery";
    // Used to build a "Track This Request" link for a single-device Pickup &
    // Delivery booking (/track needs both reference and phone to look it
    // up) — same condition the on-screen success page uses. Multi-device
    // bookings create one request row per device, so there's no single
    // reference to link to; an on-site booking has no usable tracker yet
    // either (its own tracking link is emailed later, once a technician
    // actually heads out — see startTechnicianTrackingIfOnTheWay).
    phone: string;
  }
) {
  const client = getClient();
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pdfBytes = await generateQuotationPdf(opts);
  const allCostsKnown = opts.devices.every((d) => d.repairCost !== null);
  const totalRepairCost = opts.devices.reduce((sum, d) => sum + (d.repairCost ?? 0), 0);
  const pickupDelivery = opts.fulfillmentMode === "pickup_delivery";
  const feePhrase = pickupDelivery ? "the Booking, Diagnostic &amp; Delivery Fee" : "one service fee for the visit";
  const totalLine =
    allCostsKnown && opts.serviceFee !== null
      ? `an estimated total of <strong>${peso(totalRepairCost + opts.serviceFee)}</strong> (repair cost${opts.devices.length > 1 ? "s" : ""} + ${feePhrase})`
      : "an estimate — our technician will confirm the exact repair cost upon inspection";
  const bookingPhrase = pickupDelivery
    ? "thanks for booking Pickup &amp; Delivery with us — a rider will pick up your device, we'll repair it at the shop, then a rider brings it back to you"
    : "thanks for booking a home service repair with us";
  const trackingUrl =
    pickupDelivery && opts.devices.length === 1 && opts.phone
      ? `${SITE_URL}/track?reference=${encodeURIComponent(opts.devices[0].reference)}&phone=${encodeURIComponent(opts.phone)}`
      : null;

  const deviceLines = opts.devices
    .map(
      (d) => `
        <li style="margin-bottom: 6px;">
          <strong>${d.deviceLabel || "Device"}</strong> — ${d.serviceType} (${d.reference})
          <br/><span style="color: #64748b;">${d.repairCost !== null ? peso(d.repairCost) : "Cost confirmed upon inspection"}</span>
        </li>
      `
    )
    .join("");

  const confirmationBlock = opts.confirmationUrl
    ? `
      <div style="margin: 20px 0; padding: 16px; border: 2px solid #f59e0b; border-radius: 8px; background: #fffbeb; text-align: center;">
        <p style="font-size: 14px; font-weight: 700; color: #92400e; margin: 0 0 4px;">Action required</p>
        <p style="font-size: 13px; color: #78350f; margin: 0 0 12px; line-height: 1.5;">
          Please confirm your booking within <strong>${opts.confirmationWindowMinutes} minutes</strong>, or it will be automatically
          cancelled.
        </p>
        <a
          href="${opts.confirmationUrl}"
          style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 999px;"
        >
          Confirm My Booking
        </a>
      </div>
    `
    : "";

  const downpaymentBlock =
    opts.downpaymentRequired && opts.downpaymentAmount !== null
      ? opts.fulfillmentMode === "pickup_delivery"
        ? `
      <div style="margin: 16px 0; padding: 16px; border: 2px solid #f59e0b; border-radius: 8px; background: #fffbeb;">
        <p style="font-size: 14px; font-weight: 700; color: #92400e; margin: 0 0 6px;">💳 ${peso(opts.downpaymentAmount)} down payment required to confirm your booking</p>
        <p style="font-size: 13px; color: #78350f; margin: 0; line-height: 1.5;">
          Pay the ${peso(opts.downpaymentAmount)} down payment via QR Ph to confirm your booking and have a rider assigned.
          ${opts.serviceFee !== null && opts.serviceFee > opts.downpaymentAmount ? `It counts toward your ${peso(opts.serviceFee)} Booking, Diagnostic &amp; Delivery Fee (pickup trip, diagnosis, and delivery back to you) — the remaining ${peso(opts.serviceFee - opts.downpaymentAmount)} is paid together with the repair cost when your repaired device is delivered.` : "It covers your Booking, Diagnostic &amp; Delivery Fee."}
        </p>
      </div>
    `
        : `
      <div style="margin: 16px 0; padding: 16px; border: 2px solid #f59e0b; border-radius: 8px; background: #fffbeb;">
        <p style="font-size: 14px; font-weight: 700; color: #92400e; margin: 0 0 6px;">💳 Down payment required to secure your slot</p>
        <p style="font-size: 13px; color: #78350f; margin: 0 0 8px; line-height: 1.5;">
          We require a ${peso(opts.downpaymentAmount)} down payment — equivalent to the service fee — to secure your slot on your
          preferred date. This will be deducted from your final bill on the day of service.
        </p>
        <p style="font-size: 13px; color: #78350f; margin: 0; line-height: 1.5;">
          If you cancel on the day of service for any reason, the down payment is non-refundable since your slot has already been
          secured. If you need to reschedule instead, you may still use your down payment — please contact us at least 2 days before
          your scheduled date.
        </p>
      </div>
    `
      : "";

  // The customer's copy of the agreement they accepted on the booking form.
  const agreementBlock = pickupDelivery
    ? `
      <div style="margin: 20px 0; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <p style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Pickup &amp; Delivery Agreement (accepted at booking)</p>
        <ol style="font-size: 12px; color: #475569; padding-left: 18px; margin: 0; line-height: 1.5;">
          ${PICKUP_DELIVERY_AGREEMENT_TERMS.map((t) => `<li style="margin-bottom: 6px;"><strong>${escapeHtml(t.title)}.</strong> ${escapeHtml(t.body)}</li>`).join("")}
        </ol>
      </div>
    `
    : "";

  const trackingBlock = trackingUrl
    ? `
      <p style="margin: 16px 0; text-align: center;">
        <a href="${trackingUrl}" style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 600;">
          Track This Request
        </a>
      </p>
    `
    : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
      <h2 style="margin: 4px 0 16px;">Your repair quotation is ready</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(opts.customerName)}, ${bookingPhrase}. Your quotation for
        <strong>${escapeHtml(opts.referenceList)}</strong> is attached as a PDF — ${totalLine}.
      </p>
      <ul style="font-size: 13px; padding-left: 18px; margin: 12px 0;">${deviceLines}</ul>
      ${downpaymentBlock}
      ${confirmationBlock}
      ${trackingBlock}
      ${agreementBlock}
      <p style="font-size: 13px; color: #64748b;">
        This is an estimate based on our standard price list. Final pricing will be confirmed by our technician before any repair work
        begins.
      </p>
    </div>
  `;

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your repair quotation — ${opts.referenceList}`,
    html,
    attachments: [{ filename: `quotation-${opts.devices[0]?.reference ?? "request"}.pdf`, content: Buffer.from(pdfBytes) }],
  });
  if (error) throw new Error(error.message);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The public /quote page's price is never rendered on screen — this email
// is the only place the customer ever sees the number, so it doubles as
// both the "here's your quote" message and the record they can keep.
export async function sendPublicQuoteEmail(
  to: string,
  opts: {
    customerName: string;
    deviceLabel: string;
    serviceTypeLabel: string;
    screenQuality?: string;
    repairCost: number;
    serviceMode: "walk_in" | "home_service";
    branchName?: string;
    address?: string;
    serviceFee?: number | null;
  }
) {
  const client = getClient();
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fee = opts.serviceMode === "home_service" ? (opts.serviceFee ?? 0) : 0;
  const total = opts.repairCost + fee;
  const qualityLabel = opts.screenQuality === "original" ? "Original" : opts.screenQuality === "high_quality" ? "High Quality (compatible)" : "";

  const rows: string[] = [
    row("Device", escapeHtml(opts.deviceLabel)),
    row("Repair Type", `${escapeHtml(opts.serviceTypeLabel)}${qualityLabel ? ` (${qualityLabel})` : ""}`),
    row("Repair Cost", peso(opts.repairCost)),
  ];
  if (opts.serviceMode === "home_service") {
    rows.push(row("Service Mode", "Home Service"));
    rows.push(row("Home Service Fee", opts.serviceFee !== null ? peso(fee) : "To be confirmed"));
    rows.push(row("Address", escapeHtml(opts.address ?? "")));
  } else {
    rows.push(row("Service Mode", "Walk-in"));
    rows.push(row("Branch", escapeHtml(opts.branchName ?? "")));
  }
  rows.push(
    `<tr><td style="padding:8px 0 0;font-weight:700;border-top:1px solid #e2e8f0;">Total</td><td style="padding:8px 0 0;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">${peso(total)}</td></tr>`
  );

  function row(label: string, value: string) {
    return `<tr><td style="padding:4px 0;color:#64748b;">${label}</td><td style="padding:4px 0;text-align:right;">${value}</td></tr>`;
  }

  // Next step depends on which mode they quoted for — a Walk-in quote
  // points at pre-registering that visit, a Home Service quote points at
  // actually booking the technician.
  const ctaHref = opts.serviceMode === "walk_in" ? `${SITE_URL}/walk-in` : `${SITE_URL}/request?area=near`;
  const ctaLabel = opts.serviceMode === "walk_in" ? "Pre-Register My Walk-In" : "Book Home Service";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
      <h2 style="margin: 4px 0 16px;">Your repair quotation</h2>
      <p style="font-size: 14px; line-height: 1.5;">Hi ${escapeHtml(opts.customerName || "there")}, here's the quote you requested:</p>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin: 12px 0;">${rows.join("")}</table>
      <p style="font-size: 13px; color: #64748b;">
        This is an estimate based on our standard price list. Final pricing will be confirmed upon inspection
        ${opts.serviceMode === "walk_in" ? "at the branch" : "by our technician"}.
      </p>
      <div style="margin: 20px 0; text-align: center;">
        <a
          href="${ctaHref}"
          style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 999px;"
        >
          ${ctaLabel}
        </a>
      </div>
    </div>
  `;

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your repair quotation — ${opts.deviceLabel}`,
    html,
  });
  if (error) throw new Error(error.message);
}

export async function sendLeadReplyEmail(to: string, opts: { customerName: string; message: string }) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Reply from Ceejay Cellphone Repair Shop`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">Hi ${escapeHtml(opts.customerName)},</h2>
        <p style="font-size: 14px; line-height: 1.5; white-space: pre-line;">${escapeHtml(opts.message)}</p>
        <p style="font-size: 13px; color: #64748b;">If you have any questions, just reply to this email.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

export async function sendBroadcastEmail(to: string, opts: { subject: string; message: string; photos?: string[] }) {
  const client = getClient();
  const photosHtml = (opts.photos ?? [])
    .map((src) => `<img src="${src}" alt="" style="max-width: 100%; border-radius: 8px; margin-top: 12px; display: block;" />`)
    .join("");
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: opts.subject,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <p style="font-size: 14px; line-height: 1.5; white-space: pre-line;">${escapeHtml(opts.message)}</p>
        ${photosHtml}
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

export async function sendAppointmentReminderEmail(to: string, opts: { customerName: string; reference: string; preferredDatetime: string }) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Reminder: your Ceejay appointment is tomorrow — ${opts.reference}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">See you tomorrow!</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Hi ${escapeHtml(opts.customerName)}, this is a reminder that your home service appointment
          <strong>${escapeHtml(opts.reference)}</strong> is scheduled for <strong>${escapeHtml(opts.preferredDatetime)}</strong>.
        </p>
        <p style="font-size: 13px; color: #64748b;">If you need to reschedule or have any questions, just reply to this email or contact the branch you visited.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

// Walk-In Registration's anti-spam gate (see lib/actions.ts's
// sendWalkInOtp/verifyWalkInOtp and supabase/migrations/0052_email_otp_codes.sql)
// — a plain 6-digit code we generate ourselves and email, since (unlike
// Semaphore's SMS route used for Home Service's phone OTP) Resend has no
// dedicated OTP feature that generates the code for us.
export async function sendWalkInOtpEmail(to: string, code: string) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your Ceejay verification code: ${code}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">Your verification code</h2>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 0 0 16px;">${code}</p>
        <p style="font-size: 14px; line-height: 1.5;">Enter this code to continue. This code expires in 10 minutes.</p>
        <p style="font-size: 13px; color: #64748b;">If you didn&apos;t request this, you can safely ignore this email.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

export async function sendCancellationEmail(to: string, opts: { customerName: string; reference: string; reason: string }) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your repair ${opts.reference} has been cancelled`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">Your repair has been cancelled</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Hi ${escapeHtml(opts.customerName)}, your repair <strong>${escapeHtml(opts.reference)}</strong> has been cancelled.
          ${opts.reason ? `<br/><br/><strong>Reason:</strong> ${escapeHtml(opts.reason)}` : ""}
        </p>
        <p style="font-size: 13px; color: #64748b;">If you have any questions, just reply to this email or contact the branch you visited.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

// Sent twice per Pickup & Delivery pickup leg — once when the rider marks
// "On The Way" (heading to the customer), again when they mark "On The Way
// to Branch" (heading to the shop with the device) — each time pointing at
// the same /track page, which shows whichever leg is actually live right
// now rather than needing two different URLs.
export async function sendTrackingLinkEmail(
  to: string,
  opts: {
    customerName: string;
    reference: string;
    phone: string;
    stage: "heading_to_pickup" | "heading_to_shop" | "unboxing_ready" | "repair_update" | "out_for_delivery" | "delivered";
  }
) {
  const client = getClient();
  const trackingUrl = `${SITE_URL}/track?reference=${encodeURIComponent(opts.reference)}&phone=${encodeURIComponent(opts.phone)}`;
  const copy = {
    heading_to_pickup: {
      heading: "Your rider is on the way!",
      body: "A rider is heading to your address now to pick up your device. You can follow their live location on the tracking page below.",
    },
    heading_to_shop: {
      heading: "Your device is on its way to the shop!",
      body: "Your rider has your device and is on the way to the shop. You can follow their live location on the tracking page below.",
    },
    unboxing_ready: {
      heading: "Your device has arrived at the shop!",
      body: "Our technician recorded a short video of your device being unboxed and inspected at the shop, so you can see exactly how it arrived. Watch it on the tracking page below.",
    },
    repair_update: {
      heading: "New update on your repair",
      body: "Our technician posted an update on your repair — notes and photos/videos of your device as the work progresses. See it on the tracking page below.",
    },
    out_for_delivery: {
      heading: "Your repaired device is on its way back to you!",
      body: "Your repair is done and a rider is now on the way to deliver your device back to your address. You can follow their live location on the tracking page below. Please have a valid ID and your booking reference ready — the rider will only release the device to you or a person you authorized.",
    },
    delivered: {
      heading: "Your device has been delivered",
      body: "Our rider has handed your repaired device back to you. Thank you for choosing Ceejay Cellphone Repair Shop! If anything doesn't look right, reply to this email or contact the branch right away.",
    },
  }[opts.stage];
  const heading = copy.heading;
  const body = copy.body;

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `${heading} — ${opts.reference}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">${heading}</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Hi ${escapeHtml(opts.customerName)}, ${body}
        </p>
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Track My Request
          </a>
        </p>
        <p style="font-size: 13px; color: #64748b;">Reference: <strong>${escapeHtml(opts.reference)}</strong></p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

// Sent once when a Pickup & Delivery booking's Booking & Diagnostic Fee
// clears (see confirmBookingRows in lib/paymentProcessing.ts) — the FINAL
// FLOW spec's "Ceejay Repair Booking Confirmed" email. The quotation email
// sent at submission time already asked for this payment; this one
// confirms it went through and hands over the tracking link.
export async function sendPickupDeliveryBookingConfirmedEmail(
  to: string,
  opts: {
    customerName: string;
    reference: string;
    phone: string;
    deviceLabel: string;
    preferredDate: string;
    address: string;
    amountPaid: number;
    // The full Booking, Diagnostic & Delivery Fee, to state the balance
    // still due on delivery when only a down payment was paid.
    serviceFee?: number | null;
  }
) {
  const client = getClient();
  const trackingUrl = `${SITE_URL}/track?reference=${encodeURIComponent(opts.reference)}&phone=${encodeURIComponent(opts.phone)}`;
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Ceejay Repair Booking Confirmed — ${opts.reference}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">Your booking is confirmed!</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Hi ${escapeHtml(opts.customerName)}, your ${peso(opts.amountPaid)} payment went through and your Pickup &amp; Delivery booking is
          confirmed. We're assigning a rider now — you'll get another email once they're on the way.
        </p>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
          ${
            opts.serviceFee != null && opts.serviceFee > opts.amountPaid
              ? `This ${peso(opts.amountPaid)} is a down payment toward your ${peso(opts.serviceFee)} Booking, Diagnostic &amp; Delivery Fee. The remaining ${peso(opts.serviceFee - opts.amountPaid)} is paid together with the repair cost when your repaired device is delivered back to you.`
              : "This payment covers pickup, diagnosis, and delivery back to you — nothing more to pay when your repaired device comes back."
          }
        </p>
        <table style="width: 100%; font-size: 13px; margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: #64748b;">Job ID</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${escapeHtml(opts.reference)}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Device</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(opts.deviceLabel)}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Pickup Schedule</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(opts.preferredDate)}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Pickup Address</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(opts.address)}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Amount Paid</td><td style="padding: 4px 0; text-align: right;">${peso(opts.amountPaid)}</td></tr>
        </table>
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Track My Request
          </a>
        </p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

// Sent once, the first time a Home Service request's status becomes
// "En Route" — links the customer to the live /track-technician map.
export async function sendTechnicianOnTheWayEmail(
  to: string,
  opts: { customerName: string; reference: string; technicianName: string; trackingUrl: string }
) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `Your technician is on the way — ${opts.reference}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <h2 style="margin: 4px 0 16px;">Your technician is on the way 🛵</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Hi ${escapeHtml(opts.customerName)}, ${escapeHtml(opts.technicianName)} is now heading to your pinned location
          for your home service <strong>${escapeHtml(opts.reference)}</strong>.
        </p>
        <p style="margin: 24px 0;">
          <a href="${opts.trackingUrl}" style="display: inline-block; background: #0071e3; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 9999px; font-weight: 600;">
            Track your technician
          </a>
        </p>
        <p style="font-size: 13px; color: #64748b;">The map updates live while your technician is on the way. If the button doesn't work, open this link: ${opts.trackingUrl}</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}
