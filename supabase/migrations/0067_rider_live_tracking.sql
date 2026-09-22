-- Live rider tracking for the Pickup & Delivery pickup leg: a lat/lng
-- snapshot the rider's browser pings while "On The Way" or "On The Way to
-- Branch", a required proof-of-pickup photo, and which branch the device
-- was actually dropped off at once the rider marks "Delivered to Branch".

alter table home_service_requests
  add column rider_lat double precision,
  add column rider_lng double precision,
  add column rider_location_updated_at timestamptz,
  add column pickup_photo_data_url text,
  add column delivered_branch_id uuid references branches(id) on delete set null;
