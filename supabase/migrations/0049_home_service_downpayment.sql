-- Laguna/Batangas/Pampanga Home Service bookings require a QR Ph down
-- payment (via PayMongo), equal to the service fee, before the booking can
-- be confirmed — see startHomeServiceDownpayment/processHomeServiceDownpayment
-- in lib/actions.ts. Every device row in a booking shares these columns
-- (keyed off confirmation_token), same as confirmation_token/confirmed_at,
-- since the down payment is for the technician's one visit, not per device.
alter table home_service_requests add column if not exists downpayment_required boolean not null default false;
alter table home_service_requests add column if not exists downpayment_amount numeric;
alter table home_service_requests add column if not exists downpayment_status text not null default 'not_required';
alter table home_service_requests add constraint home_service_requests_downpayment_status_check
  check (downpayment_status in ('not_required', 'pending', 'paid'));
alter table home_service_requests add column if not exists paymongo_checkout_session_id text;
alter table home_service_requests add column if not exists paymongo_checkout_url text;
alter table home_service_requests add column if not exists paymongo_payment_id text;
alter table home_service_requests add column if not exists downpayment_paid_at timestamptz;
