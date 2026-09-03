import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ChecklistItem } from "./types";

const MARGIN = 40;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.12, 0.16, 0.23);
const MUTED = rgb(0.42, 0.47, 0.55);
const RULE = rgb(0.85, 0.87, 0.9);
const PASS = rgb(0.02, 0.45, 0.2);
const FAIL = rgb(0.75, 0.11, 0.11);
const NA = rgb(0.2, 0.35, 0.75);

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
  y = PAGE_H - MARGIN;

  private constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
  }

  static async create() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new Writer(doc, font, bold);
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }

  heading(text: string) {
    this.ensureSpace(26);
    this.y -= 4;
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 12, font: this.bold, color: INK });
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 14;
  }

  row(label: string, value: string, opts: { boldValue?: boolean; valueSize?: number } = {}) {
    const size = opts.valueSize ?? 10;
    const lines = wrapText(this.font, value || "—", size, CONTENT_W - 150);
    const lineHeight = size + 4;
    this.ensureSpace(lines.length * lineHeight + 4);
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
    this.y -= lines.length * lineHeight + 4;
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

  checklistTable(items: ChecklistItem[]) {
    const rowGap = 3;
    for (const item of items) {
      const labelLines = wrapText(this.bold, item.label, 9.5, CONTENT_W - 90);
      const noteLines = item.notes ? wrapText(this.font, item.notes, 8.5, CONTENT_W - 10) : [];
      const blockHeight = labelLines.length * 13 + noteLines.length * 11 + rowGap * 2;
      this.ensureSpace(blockHeight);
      labelLines.forEach((line, i) => {
        this.page.drawText(line, { x: MARGIN, y: this.y - i * 13, size: 9.5, font: this.bold, color: INK });
      });
      const resultLabel = RESULT_LABEL[item.result ?? ""] ?? "—";
      const resultColor = RESULT_COLOR[item.result ?? ""] ?? MUTED;
      this.page.drawText(resultLabel, { x: MARGIN + CONTENT_W - 40, y: this.y, size: 9.5, font: this.bold, color: resultColor });
      this.y -= labelLines.length * 13 + rowGap;
      noteLines.forEach((line, i) => {
        this.page.drawText(line, { x: MARGIN + 10, y: this.y - i * 11, size: 8.5, font: this.font, color: MUTED });
      });
      this.y -= noteLines.length * 11 + rowGap;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: MARGIN + CONTENT_W, y: this.y },
        thickness: 0.5,
        color: RULE,
      });
      this.y -= 8;
    }
  }

  async signatureBox(x: number, width: number, label: string, dataUrl: string | null) {
    const boxHeight = 90;
    this.ensureSpace(boxHeight + 20);
    const topY = this.y;
    const decoded = dataUrl ? dataUrlBytes(dataUrl) : null;
    if (decoded) {
      const embedded = decoded.isPng ? await this.doc.embedPng(decoded.bytes) : await this.doc.embedJpg(decoded.bytes);
      const maxW = width - 10;
      const maxH = boxHeight - 10;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1) || 1;
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      this.page.drawImage(embedded, { x: x + (width - w) / 2, y: topY - boxHeight + (boxHeight - h) / 2, width: w, height: h });
    } else {
      this.page.drawText("Not signed", { x: x + 10, y: topY - boxHeight / 2, size: 9, font: this.font, color: MUTED });
    }
    this.page.drawLine({
      start: { x: x, y: topY - boxHeight },
      end: { x: x + width, y: topY - boxHeight },
      thickness: 0.75,
      color: RULE,
    });
    this.page.drawText(label, { x, y: topY - boxHeight - 12, size: 8.5, font: this.font, color: MUTED });
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
}): Promise<Uint8Array> {
  const w = await Writer.create();
  const peso = (n: number) => `PHP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  w.page.drawText("Ceejay Cellphone Repair Shop", { x: MARGIN, y: w.y, size: 16, font: w.bold, color: INK });
  w.y -= 20;
  w.page.drawText(`Repair Receipt — ${opts.reference}`, { x: MARGIN, y: w.y, size: 11, font: w.font, color: MUTED });
  w.y -= 24;

  w.heading("Service Details");
  w.row("Customer Name", opts.customerName, { boldValue: true });
  w.row("Date of Repair", opts.serviceDate);
  w.row("Type of Device", opts.deviceLabel);
  w.row("Nature of Repair", opts.natureOfRepair);
  w.row("Technician", opts.technicianName || "—");
  w.row("Warranty Coverage", opts.warrantyCoverage);
  w.row("Amount", peso(opts.cost), { boldValue: true, valueSize: 12 });

  if (opts.postNotes) {
    w.heading("Notes (Post-Repair)");
    w.paragraph(opts.postNotes);
  }

  w.heading("Pre-Repair Checklist");
  w.checklistTable(opts.preItems);

  w.heading("Post-Repair Checklist");
  w.checklistTable(opts.postItems);

  w.heading("Signatures");
  const colWidth = (CONTENT_W - 20) / 2;
  w.ensureSpace(110);
  // signatureBox draws at a fixed 90pt-tall box plus a label below it, but
  // never advances the writer's y cursor itself (it's called twice per row,
  // side by side, both starting from the same y) — so the row height below
  // must be tracked here explicitly, not left for signatureBox to handle.
  const SIGNATURE_ROW_HEIGHT = 130;
  const rowTopY = w.y;
  await w.signatureBox(MARGIN, colWidth, "Pre-Repair — Customer Signature", opts.preCustomerSignature);
  w.y = rowTopY;
  await w.signatureBox(MARGIN + colWidth + 20, colWidth, "Pre-Repair — Technician Signature", opts.preTechnicianSignature);
  w.y = rowTopY - SIGNATURE_ROW_HEIGHT;
  w.ensureSpace(110);
  const rowTopY2 = w.y;
  await w.signatureBox(MARGIN, colWidth, "Post-Repair — Customer Signature", opts.postCustomerSignature);
  w.y = rowTopY2;
  await w.signatureBox(MARGIN + colWidth + 20, colWidth, "Post-Repair — Technician Signature", opts.postTechnicianSignature);
  w.y = rowTopY2 - SIGNATURE_ROW_HEIGHT;

  if (opts.receiptPhoto) {
    const decoded = dataUrlBytes(opts.receiptPhoto);
    if (decoded) {
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

  return w.save();
}
