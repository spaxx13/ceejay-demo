import { getLookups, getDeviceModels, getBranches } from "@/lib/db";
import QuoteForm from "@/components/site/QuoteForm";

export default async function QuotePage() {
  const [lookups, deviceModels, allBranches] = await Promise.all([getLookups(), getDeviceModels(), getBranches()]);

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
  // A branch without an address is a backend-only bucket (e.g. "Home
  // Service") rather than somewhere a customer can walk into.
  const branches = allBranches
    .filter((b) => b.active && b.address.trim())
    .map((b) => ({ id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber }));

  return (
    <main className="grid-bg px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="kicker">Get a Quote</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Instant Repair Quotation</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Tell us your device and what needs fixing — we&apos;ll email you a price estimate, no need to visit a branch first.
          </p>
        </div>

        <div className="mt-8">
          <QuoteForm brands={brands} models={models} serviceTypes={serviceTypes} branches={branches} />
        </div>
      </div>
    </main>
  );
}
