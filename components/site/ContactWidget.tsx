"use client";

import Link from "next/link";
import { useState } from "react";

type MenuItem = { label: string; href: string; internal?: boolean };

// Floating "contact us" widget shown on every public page, bottom-right —
// mimics a live-chat launcher (Tawk.to, which this replaced): a round
// button that expands into a short menu instead of jumping straight to one
// destination. "Our Branches" and "Home Service" always show since they're
// internal links needing no config; "Inquiries" (Facebook) drops out if no
// Page URL is set (Admin > Landing Page) instead of linking nowhere.
export default function ContactWidget({ facebookUrl }: { facebookUrl: string }) {
  const [open, setOpen] = useState(false);

  const items: MenuItem[] = [
    { label: "Our Branches", href: "/branches", internal: true },
    { label: "Home Service", href: "/request", internal: true },
    ...(facebookUrl ? [{ label: "Inquiries", href: facebookUrl }] : []),
  ];

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="fixed bottom-20 right-4 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl print:hidden">
            <div className="bg-[#1877F2] px-4 py-3">
              <p className="text-sm font-semibold text-white">How can we help?</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((item) =>
                item.internal ? (
                  <li key={item.label}>
                    <Link href={item.href} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {item.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={open ? "Close contact menu" : "Contact us"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 print:hidden"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
          </svg>
        )}
      </button>
    </>
  );
}
