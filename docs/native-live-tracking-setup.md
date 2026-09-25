# Native background location — setup checklist

This repo now ships true background location sharing for technicians and
riders (`@capacitor-community/background-geolocation`, wired up in
`lib/useLiveLocationSharing.ts`). It keeps reporting location while the
app is backgrounded or the screen is locked — the web/PWA version can
only do this while the page stays open in the foreground.

The code side is done and pushed. What's left needs your own Mac (for
iOS) and a first look at the generated Android project — neither can be
done from this sandbox.

## iOS (needs your Mac + Xcode)

1. `npx cap add ios` (only if you haven't already — check for an `ios/`
   folder in the repo first).
2. Open `ios/App/App.xcworkspace` in Xcode (not the `.xcodeproj`).
3. Select the `App` target → **Signing & Capabilities**:
   - Set your Team (Apple Developer account).
   - Click **+ Capability** → add **Background Modes** → check
     **Location updates**.
4. Edit `ios/App/App/Info.plist` — add (or edit if already present):
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Ceejay uses your location so customers can see their technician/rider on the map while a job is on the way.</string>
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>Ceejay uses your location so customers can see their technician/rider on the map, including while your phone is locked, while a job is on the way.</string>
   <key>UIBackgroundModes</key>
   <array>
     <string>location</string>
   </array>
   <key>NSCameraUsageDescription</key>
   <string>Ceejay uses your camera to attach a photo of the device or issue to a job.</string>
   <key>NSPhotoLibraryUsageDescription</key>
   <string>Ceejay uses your photo library so you can attach an existing photo to a job.</string>
   <key>NSPhotoLibraryAddUsageDescription</key>
   <string>Ceejay saves photos you take to your photo library.</string>
   ```
   The camera/photo-library keys are required by `@capacitor/camera` (see
   `lib/nativePhotoCapture.ts`) — without them, iOS kills the app the
   instant it tries to open the camera or photo picker, instead of showing
   a permission prompt.
5. `npx cap sync ios` (re-run this after any `npm install` that touches
   Capacitor packages, or after editing `capacitor.config.ts`).
6. Build to your own device (not the Simulator — location sharing needs a
   real GPS) and test: start a job, background the app, lock the screen,
   and confirm `/track-technician/<token>` (or `/track` for Pickup &
   Delivery) still updates.
7. **Distribute via TestFlight**, not a public App Store listing — this
   app is for your own technicians/riders, not customers. Needs the paid
   Apple Developer Program ($99/yr); no App Store review, just a much
   lighter TestFlight beta review.

## Android (I can start this, you drive the first build)

The `android/` project is already generated and committed
(`npx cap add android` was already run). Its manifest doesn't need manual
edits — the background-geolocation plugin's own Android library declares
the permissions and foreground service it needs, and Gradle merges those
in automatically.

1. Open `android/` in Android Studio and let it sync Gradle the first
   time (needed once, to download the Android SDK/build tools this
   sandbox doesn't have).
2. Build to a real device (not just the emulator) and test the same
   background/lock-screen scenario as iOS above.
3. On Android 13+, the persistent "sharing your location" notification
   needs the `POST_NOTIFICATIONS` runtime permission. The plugin's own
   manifest already declares it; if the notification doesn't appear,
   request it once (e.g. via `@capacitor/local-notifications`'s
   `checkPermissions`/`requestPermissions`, or Android's system prompt
   the first time a notification is shown) — flag this to me if you hit
   it and I'll wire up the explicit prompt.
4. **Distribute via a Play Console internal testing track**, same
   reasoning as TestFlight above — no public Play Store listing needed
   for your own staff. Needs a Google Play Console account ($25 once).
   Google's review for internal testing is much lighter than a public
   listing, but background location usage still gets a data-safety
   questionnaire — answer it honestly (location is used only to show a
   technician/rider's live position to the customer they're currently
   serving, only while a job is active).

## Push notifications (Firebase Cloud Messaging)

The native admin/technician/rider apps can't receive standard Web Push the
way a browser tab can (a Capacitor app's WKWebView doesn't support the
Push API) — notifying them goes through **Firebase Cloud Messaging**
instead, relayed to APNs on iOS. This is wired up server-side already
(`lib/fcm.ts`, `components/FcmRegister.tsx`) using the official
`@capacitor-firebase/messaging` plugin — no custom native code needed,
`npx cap sync ios`/`android` installs it automatically.

1. In the [Firebase console](https://console.firebase.google.com), open
   your project → **Project Settings** (gear icon) → **Service Accounts**
   tab → **Generate New Private Key**. This downloads a JSON file — don't
   commit it to the repo.
2. From that JSON file, set these on Vercel (**Settings → Environment
   Variables**) and in your local `.env` for testing:
   - `FIREBASE_PROJECT_ID` — the `project_id` field
   - `FIREBASE_CLIENT_EMAIL` — the `client_email` field
   - `FIREBASE_PRIVATE_KEY` — the `private_key` field, pasted as-is
     (`lib/fcm.ts` un-escapes the `\n` line breaks for you)
3. Make sure `ios/App/App/GoogleService-Info.plist` is present (from the
   Firebase console → your iOS app → download this file) — same file your
   existing admin-app project already had.
4. `npx cap sync ios` (and `android`) after `npm install` picks up
   `@capacitor-firebase/messaging`'s native dependencies automatically.
5. Rebuild and run on a real device — `FcmRegister.tsx` registers this
   device's token with the server automatically on login, no button to
   tap. Push notifications (new job assigned, new request, etc.) should
   then reach the native app the same way they already reach the
   browser/PWA build.

If your `ceejay-admin-app`/`ceejay-technician-app`/`ceejay-rider-app`
Xcode projects were built separately from this repo (with their own
hand-written `FirebaseMessaging.swift`), they won't pick this up — the
straightforward path is to regenerate their `ios/` folder from *this*
repo (`npx cap add ios` here, then open that project in Xcode) so it uses
the plugin instead of custom native code.

## Compatibility note

`@capacitor-community/background-geolocation`'s README only lists
support through Capacitor v7; this repo is on Capacitor v8
(`@capacitor/core@^8.5.2`). The plugin's `package.json` declares a loose
peer dependency (`@capacitor/core >=3.0.0`) so `npm install` accepted it
without complaint, and nothing in its native code looks
version-specific, but it hasn't been verified against v8 by the plugin's
own maintainers. Test it for real on both platforms before relying on it
— if it misbehaves on v8, the fallback is pinning `@capacitor/core` back
to v7 for this plugin's sake, or switching to a different background
geolocation plugin.
