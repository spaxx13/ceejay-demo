-- Lets a customer booking Back Housing (whole shell) specify the color
-- they want. Empty for every other service type — the form only
-- shows/requires this when Service Type = "Back Housing (whole shell)".
alter table home_service_requests add column if not exists back_housing_color text not null default '';
