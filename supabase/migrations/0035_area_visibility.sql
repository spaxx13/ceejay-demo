-- Lets the owner hide the "near" (Metro Manila/Laguna/Batangas/Quezon/
-- Rizal/Bulacan/Cavite/Pampanga) or "far" (Other Provinces) area from the
-- public "Where would you like your service?" picker, e.g. when that
-- queue's technicians are temporarily unavailable. Both default to true so
-- existing behavior (both shown) is unchanged until the owner turns one off.
alter table request_form_content add column if not exists near_area_enabled boolean not null default true;
alter table request_form_content add column if not exists far_area_enabled boolean not null default true;
