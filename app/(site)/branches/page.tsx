import Link from "next/link";
import { getBranches } from "@/lib/db";

export default async function BranchesPage() {
  const branches = (await getBranches()).filter((b) => b.active);

  return (
    <main>
      <section className="grid-bg px-4 py-14 text-center sm:px-6">
        <p className="kicker">Visit Us</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Branches</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
          Walk in for a free diagnostic, or book home service if you&apos;d rather we come to you.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="card space-y-3">
              <div>
                <p className="text-lg font-semibold text-slate-800">{b.name}</p>
                <p className="mt-1 text-sm text-slate-400">{b.address}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-500">
                  <span className="text-slate-400">Phone:</span> {b.contactNumber}
                </p>
              </div>
            </div>
          ))}
          {branches.length === 0 && <p className="text-sm text-slate-400">No branches published yet.</p>}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">Can&apos;t make it to a branch?</p>
        <p className="mt-1 text-sm text-slate-400">We&apos;ll send a technician to your home instead.</p>
        <div className="mt-5">
          <Link href="/request" className="btn-primary">
            Book Home Service
          </Link>
        </div>
      </section>
    </main>
  );
}
