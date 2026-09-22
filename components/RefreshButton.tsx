"use client";

import { useState, useSyncExternalStore } from "react";

// display-mode never changes over a page's lifetime, so there's nothing to
// subscribe to — this only exists to read window.matchMedia without a
// server/client render mismatch (the server has no window at all).
function subscribeNever() {
  return () => {};
}
function getStandaloneSnapshot() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}
function getServerStandaloneSnapshot() {
  return false;
}

// A standalone (installed-to-Home-Screen) PWA has no browser chrome, so it
// also has no visible reload button — pull-to-refresh (PullToRefresh.tsx)
// covers the gesture, but a stuck/errored page (e.g. after a failed form
// submission) can leave nothing on screen to pull down on. This is the
// fallback: a small always-there button that just reloads the page. Only
// shown in standalone mode, same check as PullToRefresh — inside a normal
// browser tab there's already a reload button in the chrome.
export default function RefreshButton() {
  const standalone = useSyncExternalStore(subscribeNever, getStandaloneSnapshot, getServerStandaloneSnapshot);
  const [refreshing, setRefreshing] = useState(false);

  if (!standalone) return null;

  return (
    <button
      type="button"
      aria-label="Refresh"
      disabled={refreshing}
      onClick={() => {
        setRefreshing(true);
        window.location.reload();
      }}
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-300 shadow-lg transition-transform active:scale-95 disabled:opacity-60 print:hidden"
    >
      {refreshing ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-300" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      )}
    </button>
  );
}
