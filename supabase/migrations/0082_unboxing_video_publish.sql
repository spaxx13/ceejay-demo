-- An uploaded unboxing video starts as a draft the technician/admin can
-- review, retake or delete; it only becomes visible to the customer (and
-- triggers their notification) once explicitly sent — this timestamp.
alter table home_service_requests add column if not exists unboxing_video_published_at timestamptz;
