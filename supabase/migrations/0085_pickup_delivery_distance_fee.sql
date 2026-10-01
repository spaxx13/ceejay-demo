-- Distance-tiered Pickup & Delivery fee (lib/homeServiceFees.ts
-- pickupDeliveryQuote): what was computed at booking from the customer's
-- map pin to the nearest pinned branch, kept so staff can see the basis
-- for the amount and reports don't have to recompute it.
alter table home_service_requests add column if not exists pickup_delivery_fee_pesos numeric;
alter table home_service_requests add column if not exists pickup_delivery_distance_km numeric;
alter table home_service_requests add column if not exists pickup_delivery_nearest_branch_id uuid;
