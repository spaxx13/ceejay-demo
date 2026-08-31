# Ceejay Cellphone Repair Shop — Management System (Demo)

Home Service Request intake, zone-based technician auto-assignment, CRM, and the
Admin Panel foundation described in the Phase 1 build spec — plus POS and Parts
Inventory (Phase 2 of the roadmap), pulled forward into this demo.

## Running the demo

```bash
cp .env.example .env.local   # fill in SEED_ADMIN_PASSWORD etc., or leave
                              # blank to get a random one printed to the
                              # console on first run
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Public home service form:** `/request` — no login required.
- **Staff / Admin login:** `/login`

Demo accounts are seeded in `lib/store.ts` (plaintext in-memory auth, no DB —
see assumptions below). Passwords come from the `SEED_ADMIN_PASSWORD` /
`SEED_BRANCH_PASSWORD` / `SEED_TECH_PASSWORD` env vars (see `.env.example`)
rather than being committed, since this repo is public — set them in
`.env.local` for local dev and in your Vercel project settings for the
deployed instance.

### Suggested demo flow

1. Log in as **admin@ceejay.ph**, go to **Zones**, add a zone (e.g. "North Quezon
   City" with City = "Quezon City") and check off a technician to cover it.
2. Open `/request` in a new tab (simulating a customer, no login) and submit a
   request with City = "Quezon City" — it auto-matches the zone and
   round-robin-assigns the technician you just set up.
3. Back in the admin, check **Dashboard** and **Home Service Requests** — the
   new request shows up already "Assigned," with its zone and technician.
4. Submit a second request with a city that has no matching zone (e.g. "Baguio")
   — it's still saved, flagged **Unzoned**, and lands in the **Unassigned
   Queue** for manual triage instead of blocking the customer.
5. Log in as **marco@ceejay.ph** (technician) to see only requests assigned to
   him, and update status / add a job note.
6. Explore **CRM** (leads → convert to customer, activity log), **Device
   Catalog**, **Service Types**, and **Statuses** to see the generic
   Add/Edit/Deactivate lookup pattern reused everywhere.
7. Go to **Inventory** — note the low-stock banner (a few seeded items start
   below their reorder level). Use **Adjust Stock** on any item to log a
   restock or manual deduction, and watch quantityOnHand and the Recent Stock
   Movements list update.
8. Go to **POS → New Sale**, pick a branch, add an inventory item (price
   auto-fills, stock is checked) and a custom service/labor line, then charge
   the sale. You land on a receipt view — check **Inventory** again to see the
   item's stock decremented and the movement logged against the sale
   reference, and **CRM** if you entered a phone number (POS sales create/
   match a Customer record the same way Home Service does).

## Assumptions & notes for this demo build

- **No database, by design for this demo.** All data lives in an in-memory
  store (`lib/store.ts`) seeded on server start and kept alive across
  Next.js dev hot-reloads via `globalThis`. **Restarting the dev server resets
  all data** back to the seed (3 branches, Apple/Samsung device catalog, one
  admin/branch-admin/technician user, zero zones). This trades persistence for
  zero setup — there's nothing to install or migrate to try the demo. Moving
  to Phase 2+ (or any real usage) should swap `lib/store.ts` for a real
  database (Postgres + Prisma per the original spec) behind the same
  function signatures in `lib/actions.ts`; the data model in `lib/types.ts`
  was written to map directly onto normalized tables for that migration.
- **Auth is intentionally minimal for the demo.** Login checks a plaintext
  password against the in-memory `users` seed and sets an httpOnly session
  cookie holding the user id — there's no hashing, rate limiting, or password
  reset flow. This is not production-ready auth; it exists only to
  demonstrate role gating (`owner_admin` / `branch_admin` / `technician`)
  across the Admin Panel and Technician view.
- **No Google Maps API key is configured in this environment.** The address
  step on the public form (`components/AddressFields.tsx`) degrades
  gracefully to plain manual entry (street, city/municipality, province,
  landmark) when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset, and zone matching
  runs off the typed city text. Setting that env var enables Places
  Autocomplete and lat/lng capture automatically — no code changes needed.
- **Zones start empty**, per the spec — no Philippine location list is
  hardcoded anywhere. The demo flow above walks through creating the first
  zone.
- **Every "type/category/status" list is a generic `LookupItem` row**
  (`kind: lead_status | request_status | service_type | customer_source |
  device_brand`), not a hardcoded enum, so the Admin Panel can add new values
  to any of them without a code change. Device *models* are a separate table
  referencing brand id, for the same reason.
- **SMS/email are stubbed.** Nothing in this phase sends real messages —
  reminders are explicitly out of scope for Phase 1 (see spec §6), so there's
  no stub to log yet either.
- **POS and Parts Inventory (Phase 2) are now included**, ahead of the
  original phasing, by explicit request. POS supports mixed sales — inventory
  line items (stock-checked and auto-decremented on charge) and free-form
  service/labor lines — with cash/card/GCash payment methods, an optional
  link to a Home Service Request, and a receipt view. Inventory items live
  per branch with admin-editable categories (same generic `LookupItem`
  pattern as everything else), a reorder-level low-stock indicator, and a
  `StockMovement` audit trail for every in/out/adjustment, including sales.
  This reuses the same in-memory store and Add/Edit/Deactivate conventions as
  Phase 1 — no new architecture was introduced.
- **Still not built:** walk-in technician rotation, digital waivers/
  e-signatures, QR payments, automated SMS/email reminders, and BIR tax
  tooling (Phase 3–4). The schema and admin lookup-table pattern remain
  generic enough that these can be added without reworking existing tables.

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS, in-memory data layer (no
database dependency). See assumptions above for the path back to
Postgres + Prisma when this moves past demo stage.
