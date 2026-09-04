"use client";

import { useRef, useState } from "react";
import { parsePanicLog, type PanicLogSummary } from "@/lib/panicLog";

export default function PanicLogChecker() {
  const [raw, setRaw] = useState("");
  const [summary, setSummary] = useState<PanicLogSummary | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function analyze(text: string) {
    setRaw(text);
    setSummary(text.trim() ? parsePanicLog(text) : null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => analyze(String(reader.result ?? ""));
    reader.onerror = () => setFileError("Couldn't read that file — try pasting the log text instead.");
    reader.readAsText(file);
  }

  function reset() {
    setRaw("");
    setSummary(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Upload or Paste a Panic Log</h3>
          <p className="mt-1 text-xs text-slate-400">
            From the device: Settings &gt; Privacy &amp; Security &gt; Analytics &amp; Improvements &gt; Analytics Data — look for a file
            starting with &quot;panic-full&quot; or &quot;Panic&quot;. Everything below runs in your browser — the log is never uploaded
            anywhere.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ips,.txt,.log,text/plain,application/json"
          onChange={onFileChange}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {fileError && <p className="text-xs text-red-600">{fileError}</p>}
        <p className="text-xs text-slate-400">— or paste the log text directly —</p>
        <textarea
          value={raw}
          onChange={(e) => analyze(e.target.value)}
          rows={6}
          className="input font-mono text-xs"
          placeholder="Paste panic log contents here..."
        />
        {(raw || summary) && (
          <button type="button" onClick={reset} className="btn-secondary !px-3 !py-1.5 text-xs">
            Clear
          </button>
        )}
      </div>

      {summary && !summary.looksLikePanicLog && (
        <div className="card border-amber-200 bg-amber-50/60 text-sm text-amber-800">
          This doesn&apos;t look like a recognizable panic log — showing what could be found below, but double-check you selected the
          right file.
        </div>
      )}

      {summary && (
        <div className="card space-y-4 border-2 border-blue-300 bg-blue-50/40">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-blue-900">Diagnostic Result</h3>
            {summary.diagnosis && (
              <span className="shrink-0 rounded-full bg-blue-200 px-2.5 py-1 text-xs font-bold text-blue-900">
                {summary.diagnosis.confidence}% confidence
              </span>
            )}
          </div>
          {summary.diagnosis ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">1. Detected Problem</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{summary.diagnosis.detectedProblem}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">2. Primary Cause</p>
                <p className="mt-0.5 text-sm text-slate-700">{summary.diagnosis.primaryCause}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">3. Possible Affected Parts</p>
                <ul className="mt-0.5 space-y-1 text-sm text-slate-700">
                  {summary.diagnosis.affectedParts.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5">
                      <span>{p.part}</span>
                      {p.likelihood !== null && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {p.likelihood}%
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">4. Diagnostic Recommendation</p>
                <p className="mt-0.5 text-sm text-slate-700">{summary.diagnosis.recommendation}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No specific problem could be determined automatically from this log. Review the raw log below for details.
            </p>
          )}
          <p className="border-t border-blue-200 pt-2 text-[11px] text-slate-500">
            Confidence and likelihood figures are the shop&apos;s own estimates from known panic patterns — a helpful starting point, not
            a confirmed diagnosis. Always verify with a physical inspection.
          </p>
        </div>
      )}

      {summary && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Log Details</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Device</dt>
              <dd className="text-slate-800">
                {summary.deviceName ? (
                  <>
                    {summary.deviceName} <span className="text-xs text-slate-400">({summary.device})</span>
                  </>
                ) : (
                  (summary.device ?? "—")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">OS Version</dt>
              <dd className="text-slate-800">{summary.osVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Build</dt>
              <dd className="text-slate-800">{summary.buildVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Incident Date</dt>
              <dd className="text-slate-800">{summary.incidentDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Panic Type</dt>
              <dd className="text-slate-800">{summary.panicType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Incident ID</dt>
              <dd className="truncate text-slate-800" title={summary.incidentId ?? undefined}>
                {summary.incidentId ?? "—"}
              </dd>
            </div>
          </dl>

          {summary.panicString && (
            <div>
              <p className="text-xs font-medium text-slate-500">Panic String</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-slate-50 p-2.5 text-xs whitespace-pre-wrap text-slate-700">
                {summary.panicString}
              </pre>
            </div>
          )}

          <div>
            <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs font-medium text-blue-500 hover:underline">
              {showRaw ? "Hide raw log" : "Show raw log"}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-slate-50 p-2.5 text-[11px] whitespace-pre-wrap text-slate-600">
                {summary.raw}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
