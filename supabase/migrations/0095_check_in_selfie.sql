-- A live selfie taken at the moment of check-in, to confirm the person
-- physically there is who they say they are — not just that someone has
-- their login. Required going forward (enforced in the checkIn action, not
-- NOT NULL here, so existing rows stay valid).
alter table check_ins add column if not exists photo_data_url text;
