-- New per-account permission (branch_admin scoped, owner_admin always
-- allowed) controlling who can edit the Repair Price/Parts Cost on a
-- completed Home Service job's Revenue Split card — separate from
-- can_manage_repair_pricing (0061), which only gates the Repair Pricing
-- catalog, not editing an individual completed job's agreed price.
-- Defaults to false: a deliberate per-account grant, not inherited from
-- existing "Can Manage Requests" access. Technicians keep their own,
-- separately capped edit flow (service_agreements.price_edit_count)
-- regardless of this flag.
alter table users add column if not exists can_edit_repair_price boolean not null default false;
