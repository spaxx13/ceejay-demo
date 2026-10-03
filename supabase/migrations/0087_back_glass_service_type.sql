-- Rename the "Back Housing (whole shell)" service type to "Back Glass" —
-- it's the rear-glass-only replacement, distinct from
-- "Backhousing(Whole shell including backglass)" which stays as is.
-- Existing bookings keep their service_type_id, so they simply read as
-- "Back Glass" from now on. Its repair price now has its own column
-- (Repair Pricing > Back Glass, category 'back_glass' in service_prices).
update lookups set label = 'Back Glass' where kind = 'service_type' and label = 'Back Housing (whole shell)';
