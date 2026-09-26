"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { registerStaffPushToken } from "@/lib/actions";

// Silent, invisible — mounted in the Admin layout so a signed-in staff
// member's device gets registered for notifications (new bookings,
// walk-ins, etc.). No-ops entirely outside the native app shell.
export default function StaffPushNotificationRegistrar() {
  const router = useRouter();

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

  // Routes to the notification's target page on tap, instead of just
  // opening the app to wherever it happened to be — see the `url` param on
  // lib/pushNotifications.ts's sendPushToTokens. Registered unconditionally
  // (not inside the effect above) so a tap that cold-starts the app past
  // the permission-request flow still fires this listener.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const url = (event.notification.data as { url?: string } | undefined)?.url;
      if (url) router.push(url);
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [router]);

  return null;
}
