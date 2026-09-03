-- Lets an Owner-level expense (owner_final_total_sales / owner_total_sales)
-- optionally be tied to a specific branch, so it's deducted only from that
-- branch's own card instead of every visible branch equally. Left null
-- means "applies broadly" — unchanged behavior for existing expenses.

alter table expenses add column if not exists branch_id uuid references branches(id);
