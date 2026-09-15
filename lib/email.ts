import "server-only";
import { Resend } from "resend";
import type { ChecklistItem } from "./types";
import { generateRepairReceiptPdf, generateQuotationPdf } from "./receiptPdf";

const FROM = "Ceejay Cellphone Repair Shop <noreply@ceejayrepair.com>";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
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
        Hi ${opts.customerName}, thanks for choosing Ceejay Cellphone Repair Shop. Your receipt for
        <strong>${opts.reference}</strong> (${opts.deviceLabel || "your device"}, ${peso(total)}) is attached as a PDF —
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

export async function sendOtpEmail(to: string, code: string) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `${code} is your Ceejay verification code`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto;">
        <p>Your verification code for the Ceejay Cellphone Repair Shop home service request is:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${code}</p>
        <p style="color: #667; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
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
    confirmationWindowHours: number;
  }
) {
  const client = getClient();
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pdfBytes = await generateQuotationPdf(opts);
  const allCostsKnown = opts.devices.every((d) => d.repairCost !== null);
  const totalRepairCost = opts.devices.reduce((sum, d) => sum + (d.repairCost ?? 0), 0);
  const totalLine =
    allCostsKnown && opts.serviceFee !== null
      ? `an estimated total of <strong>${peso(totalRepairCost + opts.serviceFee)}</strong> (repair cost${opts.devices.length > 1 ? "s" : ""} + one service fee for the visit)`
      : "an estimate — our technician will confirm the exact repair cost upon inspection";

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
          Please confirm your booking within <strong>${opts.confirmationWindowHours} hours</strong>, or it will be automatically
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

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
      <h2 style="margin: 4px 0 16px;">Your repair quotation is ready</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        Hi ${opts.customerName}, thanks for booking a home service repair with us. Your quotation for
        <strong>${opts.referenceList}</strong> is attached as a PDF — ${totalLine}.
      </p>
      <ul style="font-size: 13px; padding-left: 18px; margin: 12px 0;">${deviceLines}</ul>
      ${confirmationBlock}
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

export async function sendBroadcastEmail(to: string, opts: { subject: string; message: string }) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: opts.subject,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
        <p style="font-size: 14px; line-height: 1.5; white-space: pre-line;">${escapeHtml(opts.message)}</p>
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
          Hi ${opts.customerName}, your repair <strong>${opts.reference}</strong> has been cancelled.
          ${opts.reason ? `<br/><br/><strong>Reason:</strong> ${opts.reason}` : ""}
        </p>
        <p style="font-size: 13px; color: #64748b;">If you have any questions, just reply to this email or contact the branch you visited.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}
