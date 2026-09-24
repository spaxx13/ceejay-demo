import { jobQrDataUrl } from "@/lib/qrcode";
import { SITE_URL } from "@/lib/config";

// Package label QR — encodes a link straight to this request's admin
// detail page (see lib/qrcode.ts). Shown once a device is picked up, for
// the rider to attach to the package, and again on the admin/staff side to
// re-print or re-scan it.
export default async function JobQrCode({ requestId, reference }: { requestId: string; reference: string }) {
  const url = `${SITE_URL}/admin/requests/${requestId}`;
  const dataUrl = await jobQrDataUrl(url);
  return (
    <div className="inline-flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR code for ${reference}`} className="h-32 w-32" />
      <p className="font-mono text-[11px] text-slate-500">{reference}</p>
    </div>
  );
}
