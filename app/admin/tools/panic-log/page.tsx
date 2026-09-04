import PanicLogChecker from "@/components/PanicLogChecker";

export default function AdminPanicLogPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Panic Log Checker</h1>
        <p className="mt-1 text-sm text-slate-400">Upload or paste an iPhone panic log for a quick triage summary.</p>
      </div>
      <PanicLogChecker />
    </div>
  );
}
