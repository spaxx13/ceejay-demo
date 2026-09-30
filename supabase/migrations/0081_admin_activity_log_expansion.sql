-- Widens activity_log to cover the admin-side actions it never tracked
-- before (Settings, POS, Sales/Expenses, iCloud tools) — see the new
-- Admin > Activity Log page (owner-only) and the many new logActivity()
-- calls added across lib/actions.ts alongside this migration.
alter type activity_entity_type add value if not exists 'branch';
alter type activity_entity_type add value if not exists 'technician';
alter type activity_entity_type add value if not exists 'rider';
alter type activity_entity_type add value if not exists 'user';
alter type activity_entity_type add value if not exists 'catalog';
alter type activity_entity_type add value if not exists 'site_content';
alter type activity_entity_type add value if not exists 'repair_record';
alter type activity_entity_type add value if not exists 'expense';
alter type activity_entity_type add value if not exists 'icloud_check';
