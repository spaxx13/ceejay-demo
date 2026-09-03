alter table sales alter column payment_method type text using payment_method::text;

update sales set payment_method = case payment_method
  when 'cash' then 'Cash'
  when 'card' then 'Card'
  when 'gcash' then 'GCash'
  else payment_method
end;

alter table sales alter column payment_method set default 'Cash';

drop type if exists payment_method;

insert into lookups (kind, label, order_num) values
  ('payment_method', 'Cash', 0),
  ('payment_method', 'Card', 1),
  ('payment_method', 'GCash', 2);
