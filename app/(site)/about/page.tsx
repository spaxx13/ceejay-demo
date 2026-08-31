import Link from "next/link";
import { getBranches, getTechnicians } from "@/lib/db";

const VALUES = [
  { title: "Apple Specialists", body: "Our technicians train specifically on Apple hardware, alongside broad multi-brand experience." },
  { title: "Transparent Pricing", body: "Every repair starts with a free diagnostic and an upfront quote — no surprise charges." },
  { title: "Home Service", body: "Can't get to a branch? A technician comes to you, fully equipped for on-site repairs." },
  { title: "Genuine-Quality Parts", body: "We use quality-tested replacement parts and stand behind every repair we complete." },
];

export default async function AboutPage() {
  const [branches, technicians] = await Promise.all([getBranches(), getTechnicians()]);
  const branchCount = branches.filter((b) => b.active).length;
  const techCount = technicians.filter((t) => t.active).length;

  return (
    <main>
      <section className="grid-bg px-4 py-14 text-center sm:px-6">
        <p className="kicker">Our Story</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">About Ceejay Cellphone Repair Shop</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">
          We started as a single repair counter with one promise: fix it right, explain it clearly, and don&apos;t
          keep customers waiting. Today that promise covers {branchCount} branches and a home service team that
          brings the repair counter to your door.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="card">
              <p className="font-semibold text-slate-800">{v.title}</p>
              <p className="mt-2 text-sm text-slate-400">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-slate-900">{branchCount}</p>
            <p className="mt-1 text-xs text-slate-400">Branches</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{techCount}</p>
            <p className="mt-1 text-xs text-slate-400">Technicians</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">Apple</p>
            <p className="mt-1 text-xs text-slate-400">Primary Focus</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">Yes</p>
            <p className="mt-1 text-xs text-slate-400">Home Service</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">Have a device that needs attention?</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/request" className="btn-primary">
            Book Home Service
          </Link>
          <Link href="/contact" className="btn-secondary">
            Get in Touch
          </Link>
        </div>
      </section>
    </main>
  );
}
