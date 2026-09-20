insert into lookups (kind, label, order_num, active)
select 'walkin_status', v.label, v.order_num, true
from (values
  ('Pending Visit', 0),
  ('Arrived', 1),
  ('Completed', 2),
  ('No-Show', 3),
  ('Cancelled', 4)
) as v(label, order_num)
where not exists (select 1 from lookups where kind = 'walkin_status' and label = v.label);
