import { getLookups, getDeviceModels, getServicePrices, getBranches } from "@/lib/db";
import QuotationForm from "@/components/QuotationForm";

export default async function QuotePage() {
  const [lookups, deviceModels, servicePrices, branches] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getServicePrices(),
    getBranches(),
  ]);

  const brands = lookups
    .filter((l) => l.kind === "device_brand" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const models = deviceModels
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, brandId: m.brandId, name: m.name }));
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  // Real, address-having branches only — the near/far Home Service queues
  // are address-less placeholder branches, never something a walk-in
  // customer should be able to "prefer".
  const realBranches = branches
    .filter((b) => b.active && b.address)
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <p className="kicker">Get a Quote</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Get Your Free Repair Quotation</h1>
          <p className="mt-2 text-sm text-slate-400">
            Pick your device, service, and delivery method — we&apos;ll email you an estimated price right away.
          </p>
        </div>
        <QuotationForm brands={brands} models={models} serviceTypes={serviceTypes} prices={servicePrices} branches={realBranches} />
      </div>
    </main>
  );
}
