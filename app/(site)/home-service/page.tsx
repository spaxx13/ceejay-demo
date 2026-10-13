import Link from "next/link";
import type { Metadata } from "next";
import HomeServiceVideo from "@/components/site/HomeServiceVideo";
import { HOME_SERVICE_VIDEO_URL } from "@/lib/homeServiceVideo";

export const metadata: Metadata = {
  title: "Cellphone Repair at Your Doorstep | Ceejay Home Service",
  description: "Book a technician to fix your phone at home. Same repair quality, zero travel.",
};

const STEPS = [
  { n: "1", title: "Book online", body: "Fill out the short form — tell us your device, problem and address." },
  { n: "2", title: "We confirm", body: "You get a quotation and your technician is assigned to your area." },
  { n: "3", title: "Repaired at your door", body: "Our technician arrives and fixes your phone right in front of you." },
];

const BENEFITS = ["No travel, no queueing", "Repair done in front of you", "Daily service, nationwide", "Free diagnostic"];

export default function HomeServiceLandingPage() {
  return (
    <main>
      <section className="grid-bg px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="kicker">Home Service</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Phone broken? <span className="brand-gradient-text">We come to you.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-base">
            Book a Ceejay technician to your doorstep. Same repair quality, zero travel.
          </p>
          <div className="mt-6">
            <HomeServiceVideo url={HOME_SERVICE_VIDEO_URL} />
          </div>
          <div className="mt-6 flex justify-center">
            <Link href="/request" className="btn-primary w-full sm:w-auto">
              Book home service
            </Link>
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
            {BENEFITS.map((b) => (
              <li key={b}>✓ {b}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="kicker">How it works</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Three easy steps</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{s.n}</span>
              <p className="mt-3 font-semibold text-slate-800">{s.title}</p>
              <p className="mt-1 text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link href="/request" className="btn-primary w-full sm:w-auto">
            Book home service now
          </Link>
        </div>
      </section>
    </main>
  );
}
