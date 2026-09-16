"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

// Standalone-only detection via useSyncExternalStore rather than a
// useEffect+useState render-gate — matchMedia is exactly the kind of
// external browser source that hook exists for, and it avoids the
// server/client mismatch flash a plain effect would cause.
function subscribe(callback: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getSnapshot() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}
function getServerSnapshot() {
  return false;
}

// A browser tab already shows unread state in its favicon/title and the
// sidebar badge is always in view, so this bar only adds value — and only
// appears — inside the installed (standalone) PWA, where there's no
// browser chrome to carry that signal.
export default function PwaNotificationBar({ unreadCount }: { unreadCount: number }) {
  const standalone = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!standalone || unreadCount === 0) return null;

  return (
    <Link
      href="/admin/notifications"
      className="flex items-center justify-center gap-1.5 bg-blue-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-600 print:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", paddingBottom: "8px" }}
    >
      🔔 {unreadCount} new notification{unreadCount === 1 ? "" : "s"} →
    </Link>
  );
}
