"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/lib/actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "unsupported" | "checking" | "off" | "on" | "denied" | "ios-need-install";

// iOS only allows web push for a site that's been "Added to Home Screen"
// and opened from there (standalone display mode) — a plain Safari tab
// never exposes PushManager at all, on any iOS version. Detect that case
// specifically so an iPhone admin sees install instructions instead of the
// button just silently not appearing.
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PushSubscribe({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isIos() && !isStandalone()) {
      setStatus("ios-need-install");
      return;
    }
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("unsupported"));
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setStatus("on");
    } catch {
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported" || status === "checking") return null;

  if (status === "denied") {
    return <p className="px-3 text-[11px] text-slate-400">Notifications blocked — enable them in your browser&apos;s site settings.</p>;
  }

  if (status === "ios-need-install") {
    return (
      <p className="px-3 text-[11px] text-slate-400">
        To get notifications on iPhone: tap <span className="font-medium text-slate-500">Share</span> →{" "}
        <span className="font-medium text-slate-500">Add to Home Screen</span>, then open Ceejay Admin from your Home Screen and enable
        notifications from there.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={status === "on" ? disable : enable}
      disabled={busy}
      className="btn-secondary w-full !py-1.5 text-xs"
    >
      {status === "on" ? "🔔 Notifications on" : "🔕 Enable notifications"}
    </button>
  );
}
