-- Seeds the full Apple iPhone (6 through 17 Pro Max) and iPad (5th through
-- 11th generation) model range. The walk-in/home-service "Device Model"
-- field falls back to free text whenever a brand has no rows in
-- device_models (see components/site/WalkInForm.tsx, components/
-- HomeServiceForm.tsx) — this fills that in for Apple so it renders as a
-- proper dropdown instead. Safe to re-run: only adds names not already
-- present for the Apple brand, and order_num continues after whatever's
-- already there (see 0013_device_model_order.sql) so existing entries keep
-- their position.

do $$
declare
  apple_id uuid;
  base_order int;
begin
  select id into apple_id from lookups where kind = 'device_brand' and label = 'Apple' limit 1;
  if apple_id is null then
    return;
  end if;

  select coalesce(max(order_num), -1) + 1 into base_order from device_models where brand_id = apple_id;

  with new_models(name, seq) as (
    values
      ('iPhone 6', 0), ('iPhone 6 Plus', 1), ('iPhone 6s', 2), ('iPhone 6s Plus', 3),
      ('iPhone SE (1st generation)', 4),
      ('iPhone 7', 5), ('iPhone 7 Plus', 6), ('iPhone 8', 7), ('iPhone 8 Plus', 8),
      ('iPhone X', 9), ('iPhone XR', 10), ('iPhone XS', 11), ('iPhone XS Max', 12),
      ('iPhone 11', 13), ('iPhone 11 Pro', 14), ('iPhone 11 Pro Max', 15),
      ('iPhone SE (2nd generation)', 16),
      ('iPhone 12 mini', 17), ('iPhone 12', 18), ('iPhone 12 Pro', 19), ('iPhone 12 Pro Max', 20),
      ('iPhone 13 mini', 21), ('iPhone 13', 22), ('iPhone 13 Pro', 23), ('iPhone 13 Pro Max', 24),
      ('iPhone SE (3rd generation)', 25),
      ('iPhone 14', 26), ('iPhone 14 Plus', 27), ('iPhone 14 Pro', 28), ('iPhone 14 Pro Max', 29),
      ('iPhone 15', 30), ('iPhone 15 Plus', 31), ('iPhone 15 Pro', 32), ('iPhone 15 Pro Max', 33),
      ('iPhone 16', 34), ('iPhone 16 Plus', 35), ('iPhone 16 Pro', 36), ('iPhone 16 Pro Max', 37), ('iPhone 16e', 38),
      ('iPhone 17', 39), ('iPhone 17 Plus', 40), ('iPhone 17 Pro', 41), ('iPhone 17 Pro Max', 42),
      ('iPad (5th generation)', 43), ('iPad (6th generation)', 44), ('iPad (7th generation)', 45),
      ('iPad (8th generation)', 46), ('iPad (9th generation)', 47), ('iPad (10th generation)', 48),
      ('iPad (11th generation)', 49)
  )
  insert into device_models (brand_id, name, order_num)
  select apple_id, nm.name, base_order + nm.seq
  from new_models nm
  where not exists (
    select 1 from device_models dm where dm.brand_id = apple_id and dm.name = nm.name
  );
end $$;
