import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ChecklistItem } from "./types";
import { SERVICE_AGREEMENT_TERMS } from "./checklist";
import { LOGO_PNG_BASE64 } from "./logoAsset";

const MARGIN = 40;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

// 1in = 72pt. Signatures are deliberately small on the printed/emailed
// receipt — just enough to confirm a signature was captured.
const SIG_W = 1.5 * 72;
const SIG_H = 0.75 * 72;

// Terms and Conditions items that get a highlighted background on the
// receipt (1-indexed in the source list, per the shop's request).
const HIGHLIGHTED_TERMS = new Set([1, 3, 7]);

// Contact numbers shown at the top of every receipt — the shop's fixed
// branch/home-service lines, not admin-editable data.
const CONTACT_LINES = [
  ["Home Service", "0926 012 0007"],
  ["Cubao Branch", "0945 506 0002"],
  ["Greenhills Branch", "0915 212 7000"],
  ["Malolos Branch", "0967 310 0077"],
] as const;

const INK = rgb(0.12, 0.16, 0.23);
const MUTED = rgb(0.42, 0.47, 0.55);
const RULE = rgb(0.85, 0.87, 0.9);
const PASS = rgb(0.02, 0.45, 0.2);
const FAIL = rgb(0.75, 0.11, 0.11);
const NA = rgb(0.2, 0.35, 0.75);
const HIGHLIGHT_BG = rgb(0.9, 0.95, 1);
const HIGHLIGHT_BORDER = rgb(0.55, 0.72, 0.96);
const HIGHLIGHT_TEXT = rgb(0.06, 0.22, 0.5);
const TERM_HIGHLIGHT_BG = rgb(1, 0.97, 0.85);
const TERM_HIGHLIGHT_BORDER = rgb(0.9, 0.75, 0.35);

const RESULT_LABEL: Record<string, string> = { pass: "PASS", fail: "FAIL", na: "N/A" };
const RESULT_COLOR: Record<string, ReturnType<typeof rgb>> = { pass: PASS, fail: FAIL, na: NA };

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; isPng: boolean } | null {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const [header, base64] = dataUrl.split(",");
  if (!base64) return null;
  return { bytes: Uint8Array.from(Buffer.from(base64, "base64")), isPng: header.includes("image/png") };
}

class Writer {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  logoImg: Awaited<ReturnType<PDFDocument["embedJpg"]>>;
  y = PAGE_H - MARGIN;

  private constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, logoImg: Awaited<ReturnType<PDFDocument["embedJpg"]>>) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.logoImg = logoImg;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
  }

  static async create() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const logoImg = await doc.embedJpg(Uint8Array.from(Buffer.from(LOGO_PNG_BASE64, "base64")));
    return new Writer(doc, font, bold, logoImg);
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }

  // Unconditional page break — used at fixed section boundaries (end of
  // Pre-Repair, end of Terms and Conditions) so those sections' headers
  // never share a page and risk mixing with the next section's content.
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  // Shop logo top-left, branch/home-service contact numbers top-right,
  // both anchored to the same top edge, followed by a rule.
  header(reference: string, subtitle: string) {
    const logoH = 46;
    const logoScale = logoH / this.logoImg.height;
    const logoW = this.logoImg.width * logoScale;
    const topY = this.y;
    this.page.drawImage(this.logoImg, { x: MARGIN, y: topY - logoH, width: logoW, height: logoH });

    const contactSize = 8.5;
    const lineHeight = 11;
    let cy = topY - 2;
    for (const [label, number] of CONTACT_LINES) {
      const text = `${label}: ${number}`;
      const textWidth = this.font.widthOfTextAtSize(text, contactSize);
      this.page.drawText(text, { x: MARGIN + CONTENT_W - textWidth, y: cy - contactSize, size: contactSize, font: this.font, color: MUTED });
      cy -= lineHeight;
    }

    this.y = topY - Math.max(logoH, lineHeight * CONTACT_LINES.length + 4) - 8;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 14;

    this.page.drawText("Ceejay Apple Services", { x: MARGIN, y: this.y, size: 15, font: this.bold, color: INK });
    this.y -= 14;
    this.page.drawText(`${subtitle} — ${reference}`, { x: MARGIN, y: this.y, size: 10, font: this.font, color: MUTED });
    this.y -= 18;
  }

  heading(text: string) {
    this.ensureSpace(24);
    this.y -= 3;
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 12, font: this.bold, color: INK });
    this.y -= 5;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 11;
  }

  row(label: string, value: string, opts: { boldValue?: boolean; valueSize?: number } = {}) {
    const size = opts.valueSize ?? 10;
    const lines = wrapText(this.font, value || "—", size, CONTENT_W - 150);
    const lineHeight = size + 3;
    this.ensureSpace(lines.length * lineHeight + 3);
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 9, font: this.font, color: MUTED });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN + 150,
        y: this.y - i * lineHeight,
        size,
        font: opts.boldValue ? this.bold : this.font,
        color: INK,
      });
    });
    this.y -= lines.length * lineHeight + 3;
  }

  // Repair Cost / Service Fee breakdown, ending in a highlighted Total row —
  // the one figure the customer actually needs to notice.
  costBreakdown(repairCost: number, serviceFee: number, total: number) {
    const peso = (n: number) => `PHP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const lineSize = 10;
    const lineHeight = 14;
    this.ensureSpace(lineHeight * 2 + 36);

    const drawLine = (label: string, value: string, bold = false) => {
      this.page.drawText(label, { x: MARGIN, y: this.y, size: lineSize, font: bold ? this.bold : this.font, color: bold ? INK : MUTED });
      const vw = this.font.widthOfTextAtSize(value, lineSize);
      this.page.drawText(value, { x: MARGIN + CONTENT_W - vw, y: this.y, size: lineSize, font: bold ? this.bold : this.font, color: INK });
      this.y -= lineHeight;
    };

    drawLine("Repair Cost", peso(repairCost));
    drawLine("Service Fee", peso(serviceFee));
    this.y -= 2;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.5, color: RULE });
    this.y -= 10;

    const boxHeight = 26;
    this.ensureSpace(boxHeight + 8);
    const boxTop = this.y;
    const boxY = boxTop - boxHeight;
    this.page.drawRectangle({ x: MARGIN, y: boxY, width: CONTENT_W, height: boxHeight, color: HIGHLIGHT_BG, borderColor: HIGHLIGHT_BORDER, borderWidth: 1.25 });
    this.page.drawText("Total Amount", { x: MARGIN + 12, y: boxY + boxHeight / 2 - 4, size: 11, font: this.bold, color: HIGHLIGHT_TEXT });
    const valueSize = 14;
    const valueText = peso(total);
    const valueWidth = this.bold.widthOfTextAtSize(valueText, valueSize);
    this.page.drawText(valueText, { x: MARGIN + CONTENT_W - 12 - valueWidth, y: boxY + boxHeight / 2 - 5, size: valueSize, font: this.bold, color: HIGHLIGHT_TEXT });
    this.y = boxY - 8;
  }

  paragraph(text: string, size = 10) {
    const lines = wrapText(this.font, text, size, CONTENT_W);
    const lineHeight = size + 4;
    this.ensureSpace(lines.length * lineHeight);
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font: this.font, color: INK });
      this.y -= lineHeight;
    }
  }

  // Lean checklist: item label + PASS/FAIL/N/A on one line, an optional
  // note line only when the technician actually left one.
  checklistTable(items: ChecklistItem[]) {
    const rowGap = 2;
    for (const item of items) {
      const labelLines = wrapText(this.bold, item.label, 9.5, CONTENT_W - 90);
      const noteLines = item.notes ? wrapText(this.font, item.notes, 8.5, CONTENT_W - 10) : [];
      const blockHeight = labelLines.length * 12 + noteLines.length * 10 + rowGap * 2;
      this.ensureSpace(blockHeight);
      labelLines.forEach((line, i) => {
        this.page.drawText(line, { x: MARGIN, y: this.y - i * 12, size: 9.5, font: this.bold, color: INK });
      });
      const resultLabel = RESULT_LABEL[item.result ?? ""] ?? "—";
      const resultColor = RESULT_COLOR[item.result ?? ""] ?? MUTED;
      this.page.drawText(resultLabel, { x: MARGIN + CONTENT_W - 40, y: this.y, size: 9.5, font: this.bold, color: resultColor });
      this.y -= labelLines.length * 12 + rowGap;
      noteLines.forEach((line, i) => {
        this.page.drawText(line, { x: MARGIN + 10, y: this.y - i * 10, size: 8.5, font: this.font, color: MUTED });
      });
      this.y -= noteLines.length * 10 + rowGap;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: MARGIN + CONTENT_W, y: this.y },
        thickness: 0.5,
        color: RULE,
      });
      this.y -= 5;
    }
  }

  // A single small (1.5in x 0.75in) signature box.
  async signatureBox(x: number, label: string, dataUrl: string | null) {
    const topY = this.y;
    const decoded = dataUrl ? dataUrlBytes(dataUrl) : null;
    this.page.drawRectangle({ x, y: topY - SIG_H, width: SIG_W, height: SIG_H, borderColor: RULE, borderWidth: 0.75 });
    if (decoded) {
      const embedded = decoded.isPng ? await this.doc.embedPng(decoded.bytes) : await this.doc.embedJpg(decoded.bytes);
      const pad = 4;
      const maxW = SIG_W - pad * 2;
      const maxH = SIG_H - pad * 2;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1) || 1;
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      this.page.drawImage(embedded, { x: x + (SIG_W - w) / 2, y: topY - SIG_H + (SIG_H - h) / 2, width: w, height: h });
    } else {
      this.page.drawText("Not signed", { x: x + 8, y: topY - SIG_H / 2 - 3, size: 8, font: this.font, color: MUTED });
    }
    this.page.drawText(label, { x, y: topY - SIG_H - 11, size: 8, font: this.font, color: MUTED });
  }

  // Customer + technician signatures, side by side, right after the
  // checklist they belong to — not collected at the bottom of the receipt.
  async signatureRow(customerDataUrl: string | null, technicianDataUrl: string | null) {
    const ROW_HEIGHT = SIG_H + 30; // box + label line + clearance before whatever comes next
    this.ensureSpace(ROW_HEIGHT);
    const topY = this.y;
    await this.signatureBox(MARGIN, "Customer Signature", customerDataUrl);
    this.y = topY;
    await this.signatureBox(MARGIN + SIG_W + 24, "Technician Signature", technicianDataUrl);
    this.y = topY - ROW_HEIGHT;
  }

  // Terms and Conditions, numbered, with select items (1-indexed) called
  // out in a highlighted box per the shop's request.
  termsAndConditions(terms: string[], highlighted: Set<number>) {
    const size = 8.75;
    const lineHeight = size + 3.5;
    terms.forEach((term, i) => {
      const n = i + 1;
      const isHi = highlighted.has(n);
      const prefix = `${n}. `;
      const maxWidth = CONTENT_W - (isHi ? 16 : 0) - this.font.widthOfTextAtSize(prefix, size);
      const lines = wrapText(this.font, term, size, maxWidth);
      const blockHeight = lines.length * lineHeight + (isHi ? 8 : 4);
      this.ensureSpace(blockHeight);

      if (isHi) {
        const boxTop = this.y + 4;
        const boxHeight = lines.length * lineHeight + 6;
        this.page.drawRectangle({
          x: MARGIN - 4,
          y: boxTop - boxHeight,
          width: CONTENT_W + 8,
          height: boxHeight,
          color: TERM_HIGHLIGHT_BG,
          borderColor: TERM_HIGHLIGHT_BORDER,
          borderWidth: 1,
        });
      }

      const textX = MARGIN + this.font.widthOfTextAtSize(prefix, size);
      this.page.drawText(prefix, { x: MARGIN, y: this.y, size, font: isHi ? this.bold : this.font, color: isHi ? HIGHLIGHT_TEXT : INK });
      lines.forEach((line, li) => {
        this.page.drawText(line, { x: textX, y: this.y - li * lineHeight, size, font: isHi ? this.bold : this.font, color: isHi ? HIGHLIGHT_TEXT : INK });
      });
      this.y -= blockHeight;
    });
  }

  // Faint centered logo watermark and a small "Ceejay Apple Services —
  // Receipt {reference}" footer, stamped on every page of the finished
  // document — including ones added after header() already ran.
  stampAllPages(reference: string) {
    const wmH = 260;
    const wmScale = wmH / this.logoImg.height;
    const wmW = this.logoImg.width * wmScale;
    const footerText = `Ceejay Apple Services — Receipt ${reference}`;
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      page.drawImage(this.logoImg, { x: (PAGE_W - wmW) / 2, y: (PAGE_H - wmH) / 2, width: wmW, height: wmH, opacity: 0.06 });
      page.drawText(footerText, { x: MARGIN, y: 22, size: 8, font: this.font, color: MUTED });
      const pageLabel = `Page ${i + 1} of ${pages.length}`;
      const pageLabelWidth = this.font.widthOfTextAtSize(pageLabel, 8);
      page.drawText(pageLabel, { x: MARGIN + CONTENT_W - pageLabelWidth, y: 22, size: 8, font: this.font, color: MUTED });
    });
  }

  async save() {
    return this.doc.save();
  }
}

export async function generateRepairReceiptPdf(opts: {
  reference: string;
  customerName: string;
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
}): Promise<Uint8Array> {
  const w = await Writer.create();

  w.header(opts.reference, "Repair Receipt");

  w.heading("Service Details");
  w.row("Customer Name", opts.customerName, { boldValue: true });
  w.row("Date of Repair", opts.serviceDate);
  w.row("Type of Device", opts.deviceLabel);
  w.row("Nature of Repair", opts.natureOfRepair);
  w.row("Technician", opts.technicianName || "—");
  w.row("Warranty Coverage", opts.warrantyCoverage);

  w.heading("Cost Breakdown");
  w.costBreakdown(opts.repairCost, opts.serviceFee, opts.repairCost + opts.serviceFee);

  // Page 1: general receipt info + Pre-Repair Checklist + its signatures.
  w.heading("Pre-Repair Checklist");
  w.checklistTable(opts.preItems);
  await w.signatureRow(opts.preCustomerSignature, opts.preTechnicianSignature);

  // Page 2: Post-Repair Checklist + its signatures + Terms and Conditions.
  // Forced onto its own page so nothing from Page 1 can spill down and mix
  // with these headers, regardless of how much room was left above.
  w.newPage();
  w.heading("Post-Repair Checklist");
  w.checklistTable(opts.postItems);
  await w.signatureRow(opts.postCustomerSignature, opts.postTechnicianSignature);

  if (opts.postNotes) {
    w.heading("Notes (Post-Repair)");
    w.paragraph(opts.postNotes);
  }

  w.heading("Terms and Conditions");
  w.termsAndConditions(SERVICE_AGREEMENT_TERMS, HIGHLIGHTED_TERMS);

  // Page 3: miscellaneous items (device/receipt photo) — also forced onto
  // its own page, separate from the Terms and Conditions above it.
  if (opts.receiptPhoto) {
    const decoded = dataUrlBytes(opts.receiptPhoto);
    if (decoded) {
      w.newPage();
      w.heading(opts.photoLabel ?? "Receipt Photo");
      const embedded = decoded.isPng ? await w.doc.embedPng(decoded.bytes) : await w.doc.embedJpg(decoded.bytes);
      const maxW = CONTENT_W;
      const maxH = 320;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1) || 1;
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      w.ensureSpace(height + 10);
      w.page.drawImage(embedded, { x: MARGIN, y: w.y - height, width, height });
      w.y -= height + 10;
    }
  }

  w.stampAllPages(opts.reference);

  return w.save();
}
