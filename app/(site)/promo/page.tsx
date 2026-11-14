import type { Metadata } from "next";
import { getBranches, getSiteContent } from "@/lib/db";
import PromoCta from "@/components/site/PromoCta";
import PromoVideoCard from "@/components/site/PromoVideoCard";
import AppStoreButton from "@/components/site/AppStoreButton";
import { PROMO_VIDEOS } from "@/lib/promoVideos";

// Landing page for Facebook/Instagram ads — point the ad's "Website URL" here
// (see docs/facebook-ads.md for ready-made ad copy and UTM links). One goal:
// get the customer into the shop (or booked for home service). The Meta Pixel
// from the (site) layout already records the PageView.
export const metadata: Metadata = {
  title: "Cellphone Repair — Free Diagnostic, Same-Day Repair | Ceejay Repair",
  description: "Cracked screen? Battery draining? Walk in for a free diagnostic and same-day repair, or book a technician to your home.",
  robots: { index: false },
};

// Same slug trick as ContactWidget: facebook.com/<slug> -> m.me/<slug>.
function toMessengerUrl(facebookUrl: string): string {
  try {
    const slug = new URL(facebookUrl).pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return slug ? `https://m.me/${slug}` : facebookUrl;
  } catch {
    return facebookUrl;
  }
}

// This ad drives customers to one branch only. Matched against the branch
// name or address (case-insensitive); if nothing matches — e.g. the branch
// was renamed — every branch is shown instead of an empty section.
const PROMO_BRANCH_KEYWORD = "cubao";

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const FIXES = [
  "Basag na screen",
  "Palit battery",
  "Charging port",
  "No power / ayaw mag-on",
  "Water damage",
  "Logic board / board problem",
  "Back glass / Reglass",
  "Back housing",
  "Camera (front & back)",
  "Camera lens",
  "Software / boot loop",
  "Data recovery",
  "Speaker & microphone",
  "Face ID / Touch ID",
  "Power & volume button",
  "Diagnostic checkup",
];
const STEPS = [
  {
    title: "Dalhin ang phone",
    body: "Walk-in lang. Walang appointment, deretso ka lang sa shop.",
    // phone
    icon: "M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3Zm4 15.5h.01",
  },
  {
    title: "Libreng diagnostic",
    body: "Titingnan namin ang sira at sasabihin kung ano ito. Ikaw ang magdedesisyon.",
    // magnifier
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.5-4.5",
  },
  {
    title: "Same-day repair",
    body: "Karamihan ng repair, tapos na the same day. Uwi ka na may gumaganang phone!",
    // check circle
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9.5 3 3 5-6",
  },
];

export default async function PromoPage() {
  const [allBranches, sc] = await Promise.all([getBranches(), getSiteContent()]);
  const open = allBranches.filter((b) => b.active && b.address.trim());
  const matched = open.filter((b) => `${b.name} ${b.address}`.toLowerCase().includes(PROMO_BRANCH_KEYWORD));
  const branches = matched.length > 0 ? matched : open;
  const single = matched.length === 1;
  const messenger = sc.facebookUrl ? toMessengerUrl(sc.facebookUrl) : "";

  return (
    <main>
      <section className="grid-bg px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="kicker">Ceejay Cellphone Repair</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Basag o sira ang phone? <span className="brand-gradient-text">Ayusin na today.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-500 sm:text-base">
            Libreng diagnostic at same-day repair sa shop namin. Walk-in lang, walang appointment.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PromoCta href="#branches" event="FindLocation" label="Hero - Find a branch" className="btn-primary">
              Pumunta sa shop
            </PromoCta>
            {messenger && (
              <PromoCta href={messenger} external event="Contact" label="Hero - Messenger" className="btn-secondary">
                Mag-message sa Facebook
              </PromoCta>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">Ano ang aayusin namin?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {FIXES.map((f) => (
            <span key={f} className="badge border-blue-200 bg-blue-50 text-blue-700">
              {f}
            </span>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="kicker">Ganito kadali</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">3 hakbang, tapos na</h2>
        </div>
        <ol className="mt-8 grid grid-cols-1 gap-y-8 sm:grid-cols-3 sm:gap-x-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
              {/* connector line to the next step */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-7 top-16 h-[calc(100%-2rem)] w-0.5 bg-gradient-to-b from-blue-300 to-blue-100 sm:left-[calc(50%+2.5rem)] sm:top-7 sm:h-0.5 sm:w-[calc(100%-5rem+1.5rem)] sm:bg-gradient-to-r"
                />
              )}
              <div className="relative shrink-0">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={step.icon} />
                  </svg>
                </span>
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-xs font-bold text-slate-900">
                  {i + 1}
                </span>
              </div>
              <div className="pt-1 sm:pt-0">
                <p className="text-lg font-bold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-slate-200 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">Panoorin kung paano kami mag-ayos</h2>
          <div className="mx-auto mt-6 grid max-w-xs grid-cols-1 gap-5 sm:max-w-none sm:grid-cols-3">
            {PROMO_VIDEOS.map((v) => (
              <PromoVideoCard key={v.id} video={v} />
            ))}
          </div>
        </div>
      </section>

      <section id="branches" className="scroll-mt-4 border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">Pumunta sa shop</h2>
          <div className={single ? "mx-auto mt-6 max-w-md" : "mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2"}>
            {branches.map((b) => (
              <div key={b.id} className="card space-y-3">
                <div>
                  {single ? (
                    <p className="text-lg font-semibold text-slate-800">{b.address}</p>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-slate-800">{b.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{b.address}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <PromoCta href={mapsUrl(b.address)} external event="FindLocation" label={`Directions - ${b.name}`} className="btn-primary text-center">
                    Get directions
                  </PromoCta>
                  {b.contactNumber && (
                    <PromoCta href={`tel:${b.contactNumber.replace(/\s+/g, "")}`} external event="Contact" label={`Call - ${b.name}`} className="btn-secondary text-center">
                      Call {b.contactNumber}
                    </PromoCta>
                  )}
                </div>
              </div>
            ))}
            {branches.length === 0 && <p className="text-center text-sm text-slate-400">Walang branch na nakalista pa.</p>}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">I-download ang Ceejay app</p>
        <p className="mt-1 text-sm text-slate-400">Mag-book at i-track ang repair mo sa phone.</p>
        <div className="mt-5 flex justify-center">
          <AppStoreButton />
        </div>
      </section>

      <section className="px-4 py-12 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">Hindi makapunta sa branch?</p>
        <p className="mt-1 text-sm text-slate-400">Pupunta ang technician namin sa bahay mo.</p>
        <div className="mt-5">
          <PromoCta href="/request" event="Schedule" label="Book home service" className="btn-secondary">
            Mag-book ng Home Service
          </PromoCta>
        </div>
      </section>
    </main>
  );
}
