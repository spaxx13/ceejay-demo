-- Lets a customer booking Screen Repair choose Original vs High Quality
-- (compatible) glass up front. Empty for every other service type — the
-- form only shows/requires this when Service Type = "Screen Repair".
alter table home_service_requests add column if not exists screen_quality text not null default '';
