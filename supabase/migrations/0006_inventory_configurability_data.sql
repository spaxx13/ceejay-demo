alter table inventory_items add column if not exists supplier text not null default '';
alter table inventory_items add column if not exists unit text not null default 'pcs';

insert into lookups (kind, label, order_num) values
  ('unit', 'pcs', 0),
  ('unit', 'box', 1),
  ('unit', 'set', 2),
  ('unit', 'pair', 3);
