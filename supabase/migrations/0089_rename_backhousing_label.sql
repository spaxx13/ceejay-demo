-- Clarify the whole-shell replacement service type's label for customers —
-- "Backhousing(Whole shell including backglass)" read awkwardly on the
-- public/home service forms. Same price category ('backhousing' in
-- service_prices, via lib/servicePricing.ts) and same underlying repair,
-- just a clearer label. This is also the service type now offered on home
-- service instead of "Back Glass" (glass-only) — see
-- lib/homeServiceFees.ts's EXCLUDED_FROM_HOME_SERVICE.
update lookups set label = 'Backglass (Whole Shell Including Glass)' where kind = 'service_type' and label = 'Backhousing(Whole shell including backglass)';
