-- Device models were always listed alphabetically, which is fine for
-- generic names but scrambles chronological model names (e.g. "iPhone 11"
-- sorting before "iPhone 6"). Adds an explicit order, same pattern as
-- lookups.order_num, so a brand's models can be seeded/displayed in a
-- sensible (release) order.

alter table device_models add column if not exists order_num integer not null default 0;
