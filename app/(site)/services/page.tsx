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

// Kept selectable on the Home Service request form (they're not in that
// form's own exclusion list), but not shown here on the public Services
// page — they're near-duplicates of "Camera" and "Backhousing(...)" above,
// which already cover the in-branch/general listing.
const HIDDEN_FROM_PUBLIC = new Set(["Camera replacement", "Back Housing (whole shell)"]);

export default async function ServicesPage() {
  const lookups = await getLookups();
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active && !HIDDEN_FROM_PUBLIC.has(l.label))
    .sort((a, b) => a.order - b.order);

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
              {/* min-h reserves 2 lines' worth of space so a long label
                  (e.g. "Backhousing(...)") wrapping to a second line doesn't
                  push its description out of alignment with the shorter,
                  single-line titles next to it in the same grid row. */}
              <p className="min-h-12 font-semibold text-slate-800">{s.label}</p>
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
