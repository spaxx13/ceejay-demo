-- Backs the floating "Message us on Facebook" button shown on every public
-- page (app/(site)/layout.tsx) — editable from Admin > Landing Page instead
-- of hardcoded, same convention as every other public-facing string in
-- site_content. Seeded with the shop's current Page so the button works
-- immediately; the owner can change it any time from the admin.
alter table site_content add column if not exists facebook_url text not null default '';
update site_content set facebook_url = 'https://www.facebook.com/CeeJayAppleServices' where id = 1 and facebook_url = '';
