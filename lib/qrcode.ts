import QRCode from "qrcode";

// The Pickup & Delivery "package label" QR (FINAL FLOW spec item 12) —
// encodes a direct link to the request's admin detail page, so any staff
// member can scan it with an ordinary phone camera and land straight on the
// full record (spec item 14: "Shop staff scans the Job QR code"). No
// separate scanner UI needed since a phone's own camera app already
// resolves a QR-encoded URL.
export async function jobQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 220 });
}
