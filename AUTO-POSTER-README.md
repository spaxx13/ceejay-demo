# Ceejay Facebook Auto-Poster

Drops repair photos from 4 Google Drive folders (Cubao, Greenhills, Malolos,
Home Service) into one daily album post per branch on the shop's Facebook
Page, with an AI-written caption. Full background/spec:
https://claude.ai/artifact/CqiQFoZaBxmHciivmkWrXi

## Folder layout

```
lib/
  autoposter-config.js  branch/service config (folder env var names, address, contact)
  image.js        magic-byte format sniffing, HEIC decode, resize + JPEG encode
  googleDrive.js  OAuth token refresh, list/download files, day-grouping
  caption.js      Claude API call that writes the Facebook caption
  facebook.js     Graph API: upload photos, publish album post
  supabase.js     tracks which (branch, day) has already been posted
  pipeline.js     orchestrates the above, end to end, for one branch
api/
  post-cubao.js         \  thin wrappers Vercel Cron calls on schedule —
  post-greenhills.js     > each just calls runPipeline() for its branch
  post-malolos.js        /
  post-homeservice.js   /
vercel.json       cron schedule (times in UTC; PH is UTC+8)
supabase/migration.sql   the one table this needs
.env.example      every variable below, without values
```

## Integrating into the existing `spaxx13/ceejay-demo` repo

1. Copy `lib/` and `api/` into the repo (rename if `api/` already has files —
   Vercel just needs each route reachable at its path).
2. Merge the `crons` array in `vercel.json` into the existing `vercel.json`
   if one already exists, rather than overwriting it.
3. Run `supabase/migration.sql` once against the existing Supabase project
   (SQL editor in the Supabase dashboard, or `supabase db push`).
4. `npm install @supabase/supabase-js` (only new dependency; everything else
   uses the built-in `fetch`/`FormData`/`Blob` available in Node 18+, which
   Vercel's Node runtime provides).
5. In the Vercel project settings, add every variable from `.env.example`
   with its real value (see the spec doc's "Facebook credentials" and
   "Google Drive OAuth" sections for the actual values — they're not
   repeated here since this file may end up in Git).
6. Deploy. Vercel Cron will call each `api/post-*` route automatically at
   its scheduled PH time.

## Testing before relying on the cron schedule

Each route can be called manually to test, e.g.:

```
curl https://<your-deployment>.vercel.app/api/post-cubao
```

It's safe to call repeatedly in the same day — if there's no new closed
(i.e. finished, past 11:59 PM) day of photos to post, it responds with
`{"posted": false, "reason": "..."}"` and does nothing. Add `?dryRun=1` to
exercise download + conversion + caption without posting anything.

## Known limits / things to revisit

- The Google OAuth refresh token is long-lived (the app is published to
  "In production"), but Google can still revoke it after ~6 months of the
  app going unused, or if the app's OAuth consent screen configuration
  changes. If Drive calls start failing with `invalid_grant`, redo the
  OAuth Playground exchange described in the spec doc.
- Facebook Page Access Tokens generated this way don't expire under normal
  use, but a password change or app review status change could invalidate
  it — same fix, regenerate via Graph API Explorer.
- `MAX_PHOTOS_PER_POST` in `lib/autoposter-config.js` caps a single day's
  post at 10 photos and caption generation looks at the first 4 of those
  (`MAX_CAPTION_IMAGES` in `lib/caption.js`, image/vision cost control).
  Raise either if a branch tends to have busier days.
- Every photo is normalized to JPEG (max 1600px long edge, under 5 MB) by
  `lib/image.js` before it reaches Claude or Facebook. The real format is
  sniffed from magic bytes, not Drive's `mimeType`; HEIC/HEIF from iPhones
  is decoded with `heic-decode` (pure JS/WASM libheif) because the prebuilt
  `sharp` binary has no HEVC decoder. A photo that can't be converted is skipped
  with a `skipping <filename>` warning in the function logs and is not
  posted; the rest of the day still goes out. Same for a photo Facebook
  rejects. If no photo of a day can be converted, the day is recorded with
  no photos so the branch moves on to the next day instead of failing on
  the same day forever. Claude API calls retry twice on 429/5xx/network
  errors, and a failed call logs the full response body.
- Any route accepts `?dryRun=1` (e.g. `/api/post-cubao?dryRun=1`): it
  downloads, converts and writes the caption for the next unposted day but
  posts nothing and records nothing, and the response includes per-stage
  timings plus a read-only `facebook` preflight (`ok`, `pageName`, or the
  Graph API `error` if the Page token / FB_PAGE_ID is wrong). Use it to test
  after a deploy without touching the Facebook Page.
