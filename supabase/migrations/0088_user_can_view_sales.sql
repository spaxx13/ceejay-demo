-- "Can access Branch Sales" per account, so an admin can be given a single
-- section (e.g. Pickup & Delivery only) without seeing any sales/income
-- figures. Defaults to TRUE so every existing branch admin keeps what they
-- see today; the owner unchecks it per account in Settings > Staff
-- Accounts. Owner admins always have it. Gates Admin > Branch Sales (every
-- tab) and the Dashboard's income cards and sales trend.
alter table users add column if not exists can_view_sales boolean not null default true;
