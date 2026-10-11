-- Courier Service (mail-in repair) rows log to the activity log under
-- their own entity type. Kept in its own migration: a new enum value
-- can't be used in the same transaction that adds it.
alter type activity_entity_type add value if not exists 'courier_request';
