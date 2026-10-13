// Checks the "Use my current location" plumbing without a browser:
//   node scripts/test-current-location.mjs   (Node 22.18+)
// Covers the case that used to hang the booking form — a geolocation call
// that never calls back (Messenger's in-app browser on Android).
import assert from "node:assert/strict";
import {
  GEO_DENIED_MESSAGE,
  GEO_FAILURE_MESSAGE,
  chromeIntentUrl,
  detectFacebookInAppBrowser,
  geoFailureMessage,
  requestCurrentPosition,
} from "../lib/currentLocation.ts";

function run(geolocation, watchdogMs, waitMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const out = { calls: 0, ms: 0 };
    const done = () => {
      out.calls++;
      out.ms = Date.now() - started;
    };
    requestCurrentPosition(
      (pos) => {
        out.pos = pos;
        done();
      },
      (fail) => {
        out.fail = fail;
        done();
      },
      { geolocation, watchdogMs }
    );
    setTimeout(() => resolve(out), waitMs);
  });
}

const position = { coords: { latitude: 14.62, longitude: 121.05 } };
const error = (code) => ({ code });

// 1. Never calls back -> our watchdog reports a timeout, once.
let r = await run({ getCurrentPosition: () => {} }, 300, 700);
assert.deepEqual([r.fail, r.calls], ["timeout", 1]);
assert.ok(r.ms >= 290 && r.ms < 600, `watchdog fired at ${r.ms}ms`);
assert.equal(geoFailureMessage(r.fail), GEO_FAILURE_MESSAGE);

// 2. Answers only after the watchdog -> the late answer is ignored.
r = await run({ getCurrentPosition: (ok) => void setTimeout(() => ok(position), 500) }, 300, 800);
assert.deepEqual([r.fail, r.pos, r.calls], ["timeout", undefined, 1]);

// 3. Normal success -> pin, and the watchdog stays quiet afterwards.
r = await run({ getCurrentPosition: (ok) => void setTimeout(() => ok(position), 50) }, 300, 700);
assert.deepEqual([r.pos, r.fail, r.calls], [{ lat: 14.62, lng: 121.05 }, undefined, 1]);

// 4. Browser errors map to the right message.
r = await run({ getCurrentPosition: (_ok, fail) => fail(error(1)) }, 300, 50);
assert.equal(r.fail, "denied");
assert.equal(geoFailureMessage(r.fail), GEO_DENIED_MESSAGE);
r = await run({ getCurrentPosition: (_ok, fail) => fail(error(3)) }, 300, 50);
assert.equal(r.fail, "timeout");
r = await run({ getCurrentPosition: (_ok, fail) => fail(error(2)) }, 300, 50);
assert.equal(r.fail, "unavailable");

// 5. No geolocation at all, or one that throws -> failure, not a hang.
r = await run(null, 300, 50);
assert.equal(r.fail, "unsupported");
r = await run({ getCurrentPosition: () => { throw new Error("blocked"); } }, 300, 50);
assert.equal(r.fail, "unavailable");

// 6. The browser is asked with the options we expect.
let seen;
await run({ getCurrentPosition: (_ok, _fail, o) => void (seen = o) }, 50, 100);
assert.deepEqual(seen, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

// 7. In-app browser detection and the Chrome link.
const messengerAndroid =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/465.0.0.47.109;]";
const facebookIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/470.0.0.37.108;]";
const chromeAndroid = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
assert.deepEqual(detectFacebookInAppBrowser(messengerAndroid), { platform: "android" });
assert.deepEqual(detectFacebookInAppBrowser(facebookIos), { platform: "ios" });
assert.equal(detectFacebookInAppBrowser(chromeAndroid), null);
assert.equal(
  chromeIntentUrl({ host: "www.ceejayrepair.com", pathname: "/home-service", search: "?ref=fb" }),
  "intent://www.ceejayrepair.com/home-service?ref=fb#Intent;scheme=https;package=com.android.chrome;end"
);

console.log("current-location: all checks passed");
