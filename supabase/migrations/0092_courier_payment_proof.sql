-- Courier Service payment: the customer pays by GCash or bank transfer and
-- uploads a screenshot of the receipt as proof; staff verify it, then record
-- the payment (paid_at, set by the existing admin step).
alter table courier_requests
  add column if not exists payment_method text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists payment_proof_data_url text,
  add column if not exists payment_proof_at timestamptz;
