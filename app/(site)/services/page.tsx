import Link from "next/link";
import { getLookups } from "@/lib/db";

const DESCRIPTIONS: Record<string, string> = {
  "Screen Repair": "Cracked, unresponsive, or discolored screens replaced with precision — most units done same-day.",
  "Battery Replacement": "Restore your device's battery life. We check for swelling and charging issues too.",
  "Water Damage": "Ultrasonic cleaning and component-level repair for liquid-damaged devices.",
  "Charging Port": "Loose, dirty, or damaged charging ports cleaned or replaced so your device charges reliably again.",
  "Software / Data Recovery": "OS issues, boot loops, and data recovery from devices that won't power on normally.",
  "Diagnostic Checkup": "Not sure what's wrong? A full diagnostic pinpoints the issue before you commit to a repair.",
  "Logic board problem": "Component-level diagnosis and repair for logic board issues — no power, short circuits, or boot failures.",
  "Camera": "Blurry photos, autofocus issues, or a cracked camera lens fixed with a genuine replacement module.",
  "Backhousing(Whole shell including backglass)": "Full back housing replacement, including the rear glass — for a cracked back or a damaged frame.",
};

const FALLBACK = "Professional service to get your device back to perfect condition, backed by our technicians.";

export default async function ServicesPage() {
  const lookups = await getLookups();
  const serviceTypes = lookups.filter((l) => l.kind === "service_type" && l.active).sort((a, b) => a.order - b.order);

  return (
    <main>
      <section className="grid-bg px-4 py-14 text-center sm:px-6">
        <p className="kicker">What We Fix</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Services</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
          From cracked screens to water damage, our technicians handle it — in-branch or at your home.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceTypes.length === 0 && <p className="text-sm text-slate-400">No services published yet.</p>}
          {serviceTypes.map((s) => (
            <div key={s.id} className="card">
              <p className="font-semibold text-slate-800">{s.label}</p>
              <p className="mt-2 text-sm text-slate-400">{DESCRIPTIONS[s.label] ?? FALLBACK}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">Ready to get your device fixed?</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/request" className="btn-primary">
            Book Home Service
          </Link>
          <Link href="/branches" className="btn-secondary">
            Find a Branch
          </Link>
        </div>
      </section>
    </main>
  );
}
