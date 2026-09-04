import Link from "next/link";
import PanicLogChecker from "@/components/PanicLogChecker";

export default function PanicLogCheckerPage() {
  return (
    <main>
      <section className="grid-bg px-4 py-14 text-center sm:px-6">
        <p className="kicker">Free Diagnostic Tool</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">iPhone Panic Log Checker</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">
          Your iPhone keeps a log every time it unexpectedly restarts or freezes. Upload or paste it here for a quick, free read on
          what likely caused it — everything runs right in your browser, nothing is uploaded to us.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <PanicLogChecker />

        <div className="card mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Where to find the panic log</h3>
          <p className="text-sm text-slate-500">
            On the iPhone: <span className="text-slate-700">Settings → Privacy &amp; Security → Analytics &amp; Improvements → Analytics
            Data</span> — look for a recent file starting with &quot;panic-full&quot; or &quot;Panic&quot;. Tap it, then Share to
            AirDrop/save it to yourself, and upload or paste it above.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 text-center sm:px-6">
        <p className="text-lg font-semibold text-slate-800">Not sure what the results mean, or need a hands-on look?</p>
        <p className="mt-1 text-sm text-slate-400">Bring it in for a free diagnostic, or have a technician come to you.</p>
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
