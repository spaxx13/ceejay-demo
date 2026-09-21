"use client";

import { useState } from "react";
import { isCheckInOpen, formatTime } from "@/lib/format";

// Manila is UTC+8 year-round (no DST), so any fixed reference date works —
// isCheckInOpen only reads the hour back out through the Asia/Manila
// timezone conversion, the same way the real Check In widget does.
function manilaTimeToDate(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 0, 1, (hour - 8 + 24) % 24, minute));
}

const PRESETS = [
  { label: "12:00 AM", hour: 0, minute: 0 },
  { label: "5:59 AM", hour: 5, minute: 59 },
  { label: "6:00 AM", hour: 6, minute: 0 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "11:59 PM", hour: 23, minute: 59 },
];

export default function CheckInDemoPage() {
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);

  const simulated = manilaTimeToDate(hour, minute);
  const open = isCheckInOpen(simulated);
  const timeValue = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  function setTime(h: number, m: number) {
    setHour(h);
    setMinute(m);
    setCheckedIn(false);
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Check-In Time Gate Demo</h1>
        <p className="text-sm text-slate-500">
          Standalone test page for the 6:00 AM check-in window — no login needed. Pick a Philippine-time clock reading
          below to see exactly what a technician or branch admin sees at that moment; it calls the same{" "}
          <code className="text-xs">isCheckInOpen()</code> the real Check In widget uses.
        </p>
      </div>

      <div className="card space-y-3">
        <p className="text-xs font-medium text-slate-500">Simulated time (Asia/Manila)</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTime(p.hour, p.minute)}
              className={`btn-secondary !px-3 !py-1 text-xs ${hour === p.hour && minute === p.minute ? "!bg-blue-200 !text-blue-300" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="time"
          value={timeValue}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            setTime(h, m);
          }}
          className="input w-full"
        />
        <p className="text-sm text-slate-600">
          Clock reads <span className="font-semibold">{timeValue}</span> — check-in is{" "}
          <span className={open ? "font-semibold text-green-700" : "font-semibold text-red-700"}>{open ? "OPEN" : "CLOSED"}</span>.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">What the technician/branch admin sees:</p>
        {checkedIn ? (
          <div className="card flex items-center gap-2 border-green-200 bg-green-50">
            <span className="text-xl">✅</span>
            <p className="text-sm text-green-800">
              Checked in today at <span className="font-semibold">{formatTime(simulated)}</span> — Cubao Branch
            </p>
          </div>
        ) : !open ? (
          <div className="card text-sm text-slate-400">Check-in opens at 6:00 AM.</div>
        ) : (
          <div className="card flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-slate-800">Check in for today</p>
            <button type="button" onClick={() => setCheckedIn(true)} className="btn-primary !px-4 !py-1.5 text-sm">
              Check In at Cubao Branch
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
