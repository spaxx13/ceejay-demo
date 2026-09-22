-- Finer-grained tracking for each Pickup & Delivery leg — a rider can now
-- mark "on the way" before they actually have the device, and "delivered to
-- shop" once the pickup leg is truly done (rather than treating "picked up
-- from the customer" and "handed off at the shop" as the same moment).
-- out_for_delivery_at (0064) already covers the equivalent "on the way"
-- moment for the delivery leg — this just adds a rider action for it.

alter table home_service_requests
  add column pickup_started_at timestamptz,
  add column received_at_shop_at timestamptz;
