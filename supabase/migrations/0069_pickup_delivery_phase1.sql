-- Pickup & Delivery "Phase 1" (see FINAL FLOW spec, 2026-09-24): rider
-- accept/decline before a trip starts, and a structured device-condition
-- checklist + multiple labeled photos at pickup (replacing the single
-- pickup_photo_data_url captured before). The per-request transaction
-- timeline the spec asks for is already the existing activity_log table
-- (logActivity()/getActivity(), shown on Admin > Requests > Activity Log)
-- — no new column needed, just new log entries at the new event points.

alter table home_service_requests
  add column pickup_rider_accepted_at timestamptz,
  add column delivery_rider_accepted_at timestamptz,
  add column pickup_condition_checklist jsonb,
  add column pickup_photos jsonb;
