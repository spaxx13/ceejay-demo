-- Live "technician on the way" tracking for Home Service requests.
--
-- tracking_token is the unguessable id in the customer's tracking link
-- (/track-technician/<token>), minted the first time the request's status
-- becomes "En Route" and emailed to the customer. tech_lat/tech_lng/
-- tech_location_at hold the assigned technician's latest GPS fix, pushed
-- from their phone while the job is En Route.
alter table home_service_requests add column if not exists tracking_token text;
alter table home_service_requests add column if not exists tech_lat double precision;
alter table home_service_requests add column if not exists tech_lng double precision;
alter table home_service_requests add column if not exists tech_location_at timestamptz;
create unique index if not exists hsr_tracking_token_idx on home_service_requests (tracking_token) where tracking_token is not null;
