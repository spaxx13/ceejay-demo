-- New in-app notification fired when a customer submits the public Home
-- Service Request form, alongside the existing request_in_progress and
-- checklist_completed types.
alter type notification_type add value if not exists 'new_request';
