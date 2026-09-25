"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { registerStaffPushToken } from "@/lib/actions";

// Silent, invisible — mounted in the Admin layout so a signed-in staff
// member's device gets registered for notifications (new bookings,
// walk-ins, etc.). No-ops entirely outside the native app shell.
export default function StaffPushNotificationRegistrar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        let status = await FirebaseMessaging.checkPermissions();
        if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
          status = await FirebaseMessaging.requestPermissions();
        }
        if (cancelled || status.receive !== "granted") return;
        const { token } = await FirebaseMessaging.getToken();
        if (cancelled || !token) return;
        await registerStaffPushToken(token);
      } catch {
        // Best-effort — a device that can't register still uses the app
        // fine, just without push notifications.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
