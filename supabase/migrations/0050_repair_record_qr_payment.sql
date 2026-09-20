-- Lets staff generate a PayMongo QR Ph checkout for a Repair Record's Cost,
-- for a customer who wants to pay online instead of in person — see
-- startRepairRecordQrPayment/processRepairRecordQrPayment in lib/actions.ts.
alter table repair_records add column if not exists qr_payment_status text not null default 'none';
alter table repair_records add constraint repair_records_qr_payment_status_check
  check (qr_payment_status in ('none', 'pending', 'paid'));
alter table repair_records add column if not exists qr_payment_amount numeric;
alter table repair_records add column if not exists paymongo_checkout_session_id text;
alter table repair_records add column if not exists paymongo_checkout_url text;
alter table repair_records add column if not exists paymongo_payment_id text;
alter table repair_records add column if not exists qr_paid_at timestamptz;
