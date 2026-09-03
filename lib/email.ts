import "server-only";
import { Resend } from "resend";
import type { ChecklistItem } from "./types";
import { generateRepairReceiptPdf } from "./receiptPdf";

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
    cost: number;
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

  const pdfBytes = await generateRepairReceiptPdf(opts);

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Ceejay Cellphone Repair Shop</p>
      <h2 style="margin: 4px 0 16px;">Your repair receipt is ready</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        Hi ${opts.customerName}, thanks for choosing Ceejay Cellphone Repair Shop. Your receipt for
        <strong>${opts.reference}</strong> (${opts.deviceLabel || "your device"}, ${peso(opts.cost)}) is attached as a PDF —
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
