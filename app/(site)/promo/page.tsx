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

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const FIXES = ["Cracked screen", "Battery replacement", "Charging port", "Water damage", "Camera", "Back glass"];
const STEPS = [
  ["1", "Dalhin ang phone", "Walk in sa pinakamalapit na branch — walang appointment."],
  ["2", "Libreng diagnostic", "Sasabihin namin kung ano ang sira bago ka mag-decide."],
  ["3", "Same-day repair", "Karamihan ng repair, tapos na the same day."],
];

export default async function PromoPage() {
  const [allBranches, sc] = await Promise.all([getBranches(), getSiteContent()]);
  const branches = allBranches.filter((b) => b.active && b.address.trim());
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
            Libreng diagnostic at same-day repair sa branch namin. Walk-in lang, walang appointment.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PromoCta href="#branches" event="FindLocation" label="Hero - Find a branch" className="btn-primary">
              Hanapin ang pinakamalapit na branch
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
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map(([n, title, body]) => (
            <div key={n} className="card text-center">
              <p className="text-2xl font-bold text-blue-500">{n}</p>
              <p className="mt-1 font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{body}</p>
            </div>
          ))}
        </div>
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
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {branches.map((b) => (
              <div key={b.id} className="card space-y-3">
                <div>
                  <p className="text-lg font-semibold text-slate-800">{b.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{b.address}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <PromoCta href={mapsUrl(b.address)} external event="FindLocation" label={`Directions - ${b.name}`} className="btn-primary flex-1 text-center">
                    Get directions
                  </PromoCta>
                  {b.contactNumber && (
                    <PromoCta href={`tel:${b.contactNumber.replace(/\s+/g, "")}`} external event="Contact" label={`Call - ${b.name}`} className="btn-secondary flex-1 text-center">
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
