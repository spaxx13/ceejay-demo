"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { registerPushToken } from "@/lib/customerActions";

// Silent, invisible — mounted on /my so a signed-in customer's device gets
// registered for "on the way" pushes. No-ops entirely in a regular browser
// (Capacitor.isNativePlatform() is false there), so this is safe to render
// on every visit regardless of platform.
export default function PushNotificationRegistrar() {
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
        await registerPushToken(token);
      } catch {
        // Best-effort — a device that can't register still uses the app
        // fine, just without push notifications.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Routes to the notification's target page on tap (e.g.
  // /track-technician/<token>) instead of just opening the app to wherever
  // it happened to be — see the `url` param on lib/pushNotifications.ts's
  // sendPushToTokens.
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
