-- One more transit checkpoint on the pickup leg: the rider now confirms
-- "on the way to the branch" as its own step, distinct from "picked up from
-- the customer" (picked_up_at) and "actually at the shop" (received_at_shop_at).

alter table home_service_requests
  add column heading_to_shop_at timestamptz;
