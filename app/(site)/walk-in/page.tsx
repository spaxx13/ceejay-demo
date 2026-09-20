import { getBranches, getLookups, getDeviceModels } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import WalkInForm from "@/components/site/WalkInForm";

export default async function WalkInPage() {
  const [allBranches, lookups, deviceModels] = await Promise.all([getBranches(), getLookups(), getDeviceModels()]);

  // A branch without an address is a backend-only bucket (e.g. "Home
  // Service"), not somewhere a customer can actually walk into.
  const branches = allBranches.filter((b) => b.active && b.address.trim());
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

  return (
    <main className="grid-bg px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="kicker">Visit a Branch</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Pre-Register Your Walk-In</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Planning to bring your device in? Tell us ahead of time so the branch can be ready — no appointment required, just walk in
            when it&apos;s convenient for you.
          </p>
        </div>

        <div className="mt-8">
          {branches.length === 0 ? (
            <p className="card text-center text-sm text-slate-400">Walk-in pre-registration is temporarily unavailable. Please contact a branch directly.</p>
          ) : (
            <WalkInForm branches={branches} brands={brands} models={models} serviceTypes={serviceTypes} emailAvailable={emailConfigured()} />
          )}
        </div>
      </div>
    </main>
  );
}
