import Link from "next/link";
import PanicLogChecker from "@/components/PanicLogChecker";

export default function TechnicianPanicLogPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Panic Log Checker</h1>
          <p className="text-sm text-slate-400">Upload or paste an iPhone panic log for a quick triage summary.</p>
        </div>
        <Link href="/technician" className="text-xs text-blue-500 hover:underline">
          &larr; Back
        </Link>
      </div>
      <PanicLogChecker />
    </div>
  );
}
