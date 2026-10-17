-- Courier Service "self-book" mode: Option 2 of Pickup & Delivery, where the
-- customer books and pays a Lalamove / Grab driver themselves, both to bring
-- the device to the branch and to bring it back after the repair. It reuses
-- the courier_requests lifecycle (awaiting_unit -> ... -> shipped ->
-- delivered); only the wording and the hand-over check differ.
--   delivery_mode: 'courier'   = mail-in by J&T / LBC / etc. (the original flow)
--                  'self_book' = customer-booked Lalamove / Grab, both ways
--   handover_code: short code the customer shows the driver and the branch
--                  checks (with the plate number) before releasing the device.
alter table courier_requests
  add column delivery_mode text not null default 'courier',
  add column handover_code text not null default '',
  add constraint courier_requests_delivery_mode_check check (delivery_mode in ('courier','self_book'));
