-- Every device in one "+ Add Another Device" submission shares a
-- booking_group_id (set once per submission, including single-device
-- ones) — lets the admin UI show which requests came from the same visit
-- and lets assigning a technician to one cascade to the rest of the group,
-- since one technician does the whole visit to one address.
alter table home_service_requests add column if not exists booking_group_id uuid;
create index if not exists hsr_booking_group_idx on home_service_requests (booking_group_id);
