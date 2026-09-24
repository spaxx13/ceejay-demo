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
   ```
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
