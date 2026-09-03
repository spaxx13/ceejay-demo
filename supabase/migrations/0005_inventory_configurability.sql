-- Suppliers and units become admin-configurable lookups, same pattern as
-- payment methods, service types, etc. Split from the data migration below
-- because ALTER TYPE ... ADD VALUE can't be used in the same transaction
-- as statements referencing the new value.

alter type lookup_kind add value 'supplier';
alter type lookup_kind add value 'unit';
