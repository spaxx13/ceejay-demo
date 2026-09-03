-- Payment methods become an admin-configurable lookup (like service types,
-- statuses, and sources) instead of a fixed Postgres enum, so shops can add
-- e.g. "Bank Transfer" or "PayMaya" without a code change.
--
-- Split into two files: ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction as statements that reference the new enum value.

alter type lookup_kind add value 'payment_method';
