-- Pickup & Delivery "Phase 4" (packaging step, FINAL FLOW spec item 12):
-- an optional security seal number, recorded by the rider alongside the
-- device-condition checklist/photos when marking a unit "Picked Up". The
-- package's QR code itself isn't stored — it's generated on the fly from
-- the request's existing reference (Job ID), see lib/qrcode.ts.

alter table home_service_requests
  add column pickup_security_seal text;
