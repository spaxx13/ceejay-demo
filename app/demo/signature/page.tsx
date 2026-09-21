import SignaturePad from "@/components/SignaturePad";

export const metadata = {
  title: "Signature Pad Demo",
};

export default function SignatureDemoPage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Signature Pad Demo</h1>
        <p className="text-sm text-slate-500">
          Standalone test page for the full-screen signing feature — no login or repair request needed.
          Tap &quot;Full screen&quot; to expand the pad, sign, then &quot;Done&quot; to collapse it back.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SignaturePad name="customerSignature" label="Customer Signature" />
        <SignaturePad name="technicianSignature" label="Technician's Signature" />
      </div>
    </main>
  );
}
