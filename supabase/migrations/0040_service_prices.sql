-- Owner-editable repair price list, used to compute the automatic
-- quotation emailed to a customer after they submit a Home Service
-- Request (see getRepairQuote in lib/servicePricing.ts). Replaces the
-- previously-hardcoded table in that file so the owner can add/update
-- prices from Admin > Settings > Repair Pricing without a code deploy.
--
-- category: which repair the price is for — 'battery' | 'backhousing' |
--   'back_camera' | 'screen'. Two service_type labels share the
--   'backhousing' category (and two share 'back_camera') per the owner's
--   confirmation that both labels use the same price list — that mapping
--   lives in code (lib/servicePricing.ts), not this table.
-- quality: only meaningful for category='screen' ('high_quality' |
--   'original'); empty string for every other category.
create table if not exists service_prices (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  device_model_id uuid not null references device_models(id) on delete cascade,
  quality text not null default '',
  price numeric(12,2) not null,
  updated_at timestamptz not null default now(),
  unique (category, device_model_id, quality)
);
create index if not exists service_prices_model_idx on service_prices (device_model_id);
