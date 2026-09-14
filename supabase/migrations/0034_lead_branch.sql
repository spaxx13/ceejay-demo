-- Ties a lead to the branch the inquiry is about, so branch admins only see
-- leads for their assigned branch(es) (same scoping as home_service_requests
-- and repair_records). Nullable since existing leads predate this field and
-- manually-added leads (Admin > CRM > Add Lead) don't require a branch.

alter table leads add column if not exists branch_id uuid references branches(id) on delete set null;
