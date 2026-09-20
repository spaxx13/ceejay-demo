import { getBranches, getLookups, getDeviceModels } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import MailInForm from "@/components/site/MailInForm";

export default async function MailInPage() {
  const [allBranches, lookups, deviceModels] = await Promise.all([getBranches(), getLookups(), getDeviceModels()]);

  // Only branches with a street address can actually receive a parcel.
  const branches = allBranches.filter((b) => b.active && b.address.trim()).map((b) => ({ id: b.id, name: b.name, address: b.address }));
  const brands = lookups
    .filter((l) => l.kind === "device_brand" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const models = deviceModels.filter((m) => m.active).map((m) => ({ id: m.id, brandId: m.brandId, name: m.name }));
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const available = lookups.some((l) => l.kind === "mailin_status");

  return (
    <main className="grid-bg px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="kicker">Para sa mga nasa malayong probinsya</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Repair by Courier</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Ship your phone to us with the courier of your choice (J&amp;T, LBC, Flash, Ninja Van, SPX, 2GO, AP Cargo and more). We repair it,
            you pay only after it&apos;s done, and we ship it back to you.
          </p>
        </div>

        <ol className="mx-auto mt-6 max-w-md space-y-1 text-sm text-slate-500">
          <li>1. Fill out this form. We review it and email you once approved.</li>
          <li>2. Pack your phone and ship it to our branch — you pay the courier.</li>
          <li>3. Add your courier and tracking number on your tracking page.</li>
          <li>4. We repair it and you pay by QR Ph once it&apos;s done.</li>
          <li>5. We ship it back to your address.</li>
        </ol>

        <div className="mt-8">
          {branches.length === 0 || !available ? (
            <p className="card text-center text-sm text-slate-400">Repair by Courier is temporarily unavailable. Please contact a branch directly.</p>
          ) : (
            <MailInForm branches={branches} brands={brands} models={models} serviceTypes={serviceTypes} emailAvailable={emailConfigured()} />
          )}
        </div>
      </div>
    </main>
  );
}
