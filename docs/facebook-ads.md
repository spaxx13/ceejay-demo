# Facebook / Instagram ads → `/promo` landing page

Landing page: `https://www.ceejayrepair.com/promo` (page: `app/(site)/promo/page.tsx`).
The Meta Pixel is already installed site-wide. The page fires these events on
click, so you can optimise/report on them in Ads Manager:

| Click | Pixel event |
| --- | --- |
| Find a branch / Get directions | `FindLocation` |
| Messenger / Call | `Contact` |
| Book home service (button) | `Schedule` |
| Submitted booking (form) | `Lead` (existing) |

## Ads Manager setup
- **Objective:** Traffic (start) → later Leads, optimising for `Lead`/`Contact`.
- **Location:** 3–5 km radius around the Cubao branch (the page only shows the branch whose name/address contains "Cubao" — see `PROMO_BRANCH_KEYWORD` in `app/(site)/promo/page.tsx`). **Age:** 18–55. Placements: Advantage+.
- **Daily budget:** start ₱150–300/branch, run 3–4 days before changing anything.
- **Website URL** (UTM so you can see which ad worked):
  `https://www.ceejayrepair.com/promo?utm_source=facebook&utm_medium=paid&utm_campaign=repair-nov&utm_content=ad1`
- **CTA button:** "Get Directions" or "Learn More".

## Ad copy (edit prices/promos you can really honour)
**Ad 1 — Basag screen**
- Primary text: Basag ang screen? 📱 Libreng diagnostic + same-day repair sa Ceejay. Walk-in lang, walang appointment!
- Headline: Basag Screen? Ayusin Today
- Description: Libreng diagnostic

**Ad 2 — Battery**
- Primary text: Mabilis na malowbat o biglang namamatay ang phone? Palit-battery na! Dalhin lang sa pinakamalapit na Ceejay branch.
- Headline: Palit Battery Same-Day
- Description: Libreng check-up

**Ad 3 — Home service**
- Primary text: Ayaw lumabas? Kami na ang pupunta. Technician sa bahay mo para sa repair ng phone mo.
- Headline: Repair sa Bahay Mo
- Description: Book online

**Creative:** a short vertical video (10–15 s) of a repair or a before/after photo of the screen; add the branch name/area in the first line.

## Videos and App Store link on `/promo`
- 3 videos (simple repair, board problem, reglass) — tap-to-play, vertical 9:16.
  Upload to `public/videos/` as `promo-simple-repair.mp4`, `promo-board-repair.mp4`,
  `promo-reglass.mp4`, **or** set `NEXT_PUBLIC_PROMO_VIDEO_SIMPLE_URL`,
  `NEXT_PUBLIC_PROMO_VIDEO_BOARD_URL`, `NEXT_PUBLIC_PROMO_VIDEO_REGLASS_URL` to an
  .mp4 / YouTube / Facebook video link. Missing videos are hidden automatically.
  Keep each file small (compress to ~5 MB) so it loads fast on mobile data.
- First play of each video fires the custom Pixel event `PromoVideoPlay`.
- The App Store button uses `APP_STORE_URL` in `lib/config.ts`.
