-- Unboxing video for Pickup & Delivery: recorded in-app by the technician
-- when the package is opened at the shop, uploaded straight from the
-- browser to Supabase Storage (bucket below). Only the object path and
-- who/when live on the request; the customer watches it on /track via a
-- short-lived signed URL (lib/storage.ts).
alter table home_service_requests add column if not exists unboxing_video_path text;
alter table home_service_requests add column if not exists unboxing_video_content_type text;
alter table home_service_requests add column if not exists unboxing_video_recorded_at timestamptz;
alter table home_service_requests add column if not exists unboxing_video_recorded_by text;

-- Private bucket (no public reads — every playback URL is signed and
-- expires). 50MB cap per object; the in-app recorder targets ~11MB/min at
-- 720p and stops at 2 minutes, so a real recording stays well under it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('unboxing-videos', 'unboxing-videos', false, 52428800)
on conflict (id) do nothing;
