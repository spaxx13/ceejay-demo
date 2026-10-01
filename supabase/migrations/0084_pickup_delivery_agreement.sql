-- When (and which version of) the Pickup & Delivery Agreement the customer
-- accepted at booking — see lib/pickupDeliveryAgreement.ts. Null for
-- on-site bookings and for bookings made before the agreement existed.
alter table home_service_requests add column if not exists pickup_delivery_agreed_at timestamptz;
alter table home_service_requests add column if not exists pickup_delivery_agreement_version text;
