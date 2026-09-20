export type Role = "owner_admin" | "branch_admin" | "technician";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  technicianId: string | null; // set when role === "technician"
  assignedBranchIds: string[]; // branches this account is allowed to access (branch_admin scoping) — empty means no restriction, sees all
  canManageRequests: boolean; // whether this account can access/manage Home Service Requests (branch_admin scoping)
  canDeleteRequests: boolean; // whether this account can permanently delete Home Service Requests (branch_admin scoping) — owner_admin always can regardless
  canViewAllBranches: boolean; // whether this account can see combined "All Branches" sales figures (branch_admin scoping) — false means own branch(es) only
  canAccessCrm: boolean; // whether this account can access the CRM (leads/customers) section (branch_admin scoping) — owner_admin always can regardless
  canManageWalkIns: boolean; // whether this account can access/manage Walk-In Registrations (branch_admin scoping) — independent of canManageRequests, defaults to false for new/existing branch admins
  canWaiveServiceFee: boolean; // whether this account can waive a Home Service request's visit fee (branch_admin scoping) — independent of canManageRequests, defaults to false
  phone: string; // optional — set by the account holder to opt into SMS alerts (new requests, technician status updates); blank means not opted in
  active: boolean;
};

// One browser/device a staff account has enabled web push notifications
// on — a user can have several (phone + desktop). endpoint uniquely
// identifies the subscription in the browser's push service.
export type PushSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

// Owner-managed business expenses (rent, utilities, tools, etc.) — separate
// from the per-ticket parts/labor/other cost fields on repair records and
// service agreements. Each expense is deducted from exactly one Sales total.
export type ExpenseTarget = "owner_final_total_sales" | "owner_total_sales" | "technician_final_total_sales";

export type Expense = {
  id: string;
  description: string;
  amount: number;
  target: ExpenseTarget;
  technicianName: string | null; // required when target === "technician_final_total_sales"
  branchId: string | null; // optional: ties an owner-level expense to one branch's card instead of every visible branch
  expenseDate: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string;
};

// Singleton record backing the editable copy on the public landing page
// (app/(site)/page.tsx). Admin-managed from Admin > Landing Page, so the
// hero/CTA copy is never hardcoded in the component.
export type SiteContent = {
  heroKicker: string;
  heroHeadlinePrefix: string;
  heroHeadlineHighlight: string;
  heroHeadlineSuffix: string;
  heroSubtext: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  ctaBannerTitle: string;
  ctaBannerSubtitle: string;
  ctaBannerButtonLabel: string;
};

// Singleton record backing the copy on the public Home Service Request form
// that ISN'T a field — page header and submit/confirmation text. Everything
// field-level (labels, placeholders, required-ness, order, whether a field
// exists at all) lives in CustomFormField below instead, so both the
// built-in fields and admin-added ones are edited, reordered, and removed
// through the exact same list. Admin-managed from Admin > Request Form.
export type RequestFormContent = {
  pageKicker: string;
  pageTitle: string;
  pageSubtitle: string;
  submitButtonLabel: string;
  successTitle: string;
  successBody: string;
  nearAreaEnabled: boolean; // whether "near" (Metro Manila/Laguna/Batangas/Quezon/Rizal/Bulacan/Cavite/Pampanga) is offered on the area picker
  farAreaEnabled: boolean; // whether "far" (Other Provinces) is offered on the area picker
};

// The 13 fields the form ships with. Each has bespoke rendering (device
// brand/model are coupled, address gets optional Places autocomplete,
// photo gets the upload/compress widget) but is otherwise just another row
// in the same field list as admin-added custom fields — relabel,
// reorder, require, or switch off (functionally "delete" from the public
// form; kept as `active: false` rather than a hard delete so historical
// requests that captured it stay intelligible).
export type SystemFieldKey =
  | "name"
  | "phone"
  | "email"
  | "device_brand"
  | "device_model"
  | "service_type"
  | "issue"
  | "photo"
  | "street"
  | "city"
  | "province"
  | "landmark"
  | "datetime";

// Admin-defined field on the Home Service Request form. Built-in fields
// (systemKey set) and custom ones (systemKey null, fully admin-added) share
// this one table, one order, one required flag, and — critically — the same
// editable `type`, so any field can be reshaped, not just the custom ones.
// A handful of built-ins (device brand/model, service type) keep their
// catalog-backed picker when type === "select" (their natural default)
// since that's where their real options live; switching them to any other
// type falls through to a plain input instead. Photo always renders the
// upload widget regardless of type, since a photo can't become text.
// Custom-field values are stored per-request in
// HomeServiceRequest.customFields, keyed by `key`; built-in field values
// stay on their own named HomeServiceRequest properties (phone, street,
// etc.) as before, whatever widget is currently rendering them.
export type CustomFieldType = "text" | "textarea" | "select" | "checkbox" | "date" | "datetime";

export type CustomFormField = {
  id: string;
  key: string;
  systemKey: SystemFieldKey | null;
  label: string;
  placeholder: string;
  type: CustomFieldType;
  required: boolean;
  options: string[]; // only used when type === "select"
  order: number;
  active: boolean;
};

// "near"/"far" mark the two address-less backend branches used purely as
// Home Service queue buckets — near = Metro Manila/Laguna/Batangas/Quezon,
// far = Other Provinces. Null on every real (address-having) branch.
export type HomeServiceQueue = "near" | "far";

export type Branch = {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  homeServiceQueue: HomeServiceQueue | null;
  active: boolean;
};

export type EmploymentStatus = "full_time" | "part_time" | "contractor";

export type Technician = {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  employmentStatus: EmploymentStatus;
  branchIds: string[];
  active: boolean;
  // This technician's cut of their own Net Profit, as a percent (e.g. 50,
  // 70, 100 for an owner-technician who keeps everything) — set per
  // technician on Settings > Technicians, used everywhere a technician's
  // earnings are computed (Branch Sales, Sales by Technician, My Earnings).
  // Falls back to 50 for a technician name with no matching record (e.g. a
  // typo, or a name no longer in the system).
  earningsSharePercent: number;
};

export type CustomerSource = string; // admin-addable lookup value ("Walk-in", "Home Service", "Referral", ...)

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  street: string;
  province: string;
  landmark: string;
  source: CustomerSource;
  createdAt: string;
  notes: string;
};

// Generic admin-managed lookup entity backing every "type/category/status"
// list in the system (lead status, request status, service type, etc.) so
// none of them are hardcoded enums in the UI.
export type LookupKind =
  | "lead_status"
  | "request_status"
  | "walkin_status"
  | "service_type"
  | "customer_source"
  | "device_brand"
  | "payment_method";

export type LookupItem = {
  id: string;
  kind: LookupKind;
  label: string;
  order: number;
  active: boolean;
  // for device_brand only: nothing extra needed, models reference brand id
};

export type DeviceModel = {
  id: string;
  brandId: string;
  name: string;
  order: number;
  active: boolean;
};

// Owner-editable repair price used to compute the automatic quotation
// emailed after a Home Service Request is submitted (lib/servicePricing.ts).
// `category` groups the fixed set of repairs this applies to — Battery
// Replacement, Backhousing (both duplicate labels), Back Camera (both
// duplicate labels), Front Camera, Camera Lens, and Screen Repair.
// `quality` is only meaningful for category "screen" ("high_quality" |
// "original"); empty string otherwise.
export type PriceCategory = "battery" | "backhousing" | "back_camera" | "front_camera" | "camera_lens" | "screen";
export type ServicePrice = {
  id: string;
  category: PriceCategory;
  deviceModelId: string;
  quality: string;
  price: number;
  updatedAt: string;
};

export type Lead = {
  id: string;
  customerId: string | null; // null until converted / linked
  name: string;
  phone: string;
  email: string;
  source: string; // LookupItem label (customer_source)
  statusId: string; // LookupItem id (lead_status)
  assignedTo: string | null; // User id
  followUpDate: string | null;
  notes: string;
  branchId: string | null; // which branch the inquiry is about (set on website contact-form leads; branch_admin scoping) — null means visible to every branch admin
  createdAt: string;
};

// A customer who pre-registered online that they're bringing their device
// into a branch in person — its own module (own reference number, own
// status pipeline) rather than a Lead, since it needs to be immediately
// visible to branch staff the way Home Service Requests is, not mixed into
// the general inquiry pipeline.
export type WalkInRequest = {
  id: string;
  reference: string; // WI-<year>-<seq>
  customerId: string | null;
  name: string;
  phone: string;
  email: string;
  branchId: string | null; // which branch the customer plans to visit
  deviceBrandId: string | null;
  deviceModelId: string | null;
  deviceOther: string;
  serviceTypeId: string | null;
  issueDescription: string;
  photoDataUrl: string | null;
  preferredDate: string | null;
  statusId: string; // LookupItem id (walkin_status)
  deletedAt: string | null;
  createdAt: string;
};

// Created the moment a Home Service visit fee is waived, and lands
// straight in Trash (deletedAt set immediately) rather than an "active"
// list — Trash is the only place this is ever managed from: Restore
// un-waives the fee and clears the entry, Delete Permanently just
// removes this tracking record (the fee stays waived on the request).
export type ServiceFeeWaiver = {
  id: string;
  requestId: string;
  queueBranchId: string | null; // snapshot of the request's queueBranchId, for branch-scoped Trash visibility
  reference: string; // snapshot of the request's reference, readable even if the request is later deleted
  customerName: string; // snapshot, same reasoning
  amount: number; // the waived fee amount, snapshot at time of waiving
  waivedBy: string;
  waivedAt: string;
  deletedAt: string | null;
};

export type HomeServiceRequest = {
  id: string;
  reference: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  email: string;
  deviceBrandId: string | null;
  deviceModelId: string | null;
  deviceOther: string;
  serviceTypeId: string;
  issueDescription: string;
  photoDataUrl: string | null; // base64 data URL — no file storage in this in-memory demo
  street: string;
  landmark: string;
  province: string;
  city: string; // raw city/municipality text as typed/selected by the customer
  barangay: string; // populated by either queue's cascading Province -> City -> Barangay picker
  lat: number | null;
  lng: number | null;
  preferredDatetime: string;
  statusId: string; // LookupItem id (request_status)
  assignedTechnicianId: string | null;
  autoAssigned: boolean;
  branchId: string | null;
  queueBranchId: string | null; // set once at submission from the customer's chosen area (HomeServiceQueue) — never changes; distinct from branchId, which tracks the assigned technician's actual branch
  adminNotes: string;
  createdAt: string;
  statusHistory: { statusId: string; at: string }[];
  customFields: Record<string, string | boolean>; // keyed by CustomFormField.key
  vlogConsent: boolean;
  vlogBlurPreference: "blurred" | "not_blurred" | ""; // only meaningful when vlogConsent is true
  screenQuality: "original" | "high_quality" | ""; // only meaningful/required when the chosen service type is "Screen Repair"
  backHousingColor: string; // only meaningful/required when the chosen service type is "Back Housing (whole shell)"
  reminderSentAt: string | null; // set once the daily appointment-reminder cron has texted this customer
  confirmationToken: string | null; // null when no email was captured to send the confirm link to
  confirmationExpiresAt: string | null; // 2 hours after submission — the void-unconfirmed-requests cron cancels the request once this passes with confirmedAt still null
  confirmedAt: string | null; // set when the customer clicks the confirm link in their quotation email
  bookingGroupId: string | null; // shared by every device from the same "+ Add Another Device" submission — one technician assignment cascades to the whole group, since it's one visit to one address
  downpaymentRequired: boolean; // true for DOWNPAYMENT_PROVINCES (lib/homeServiceFees.ts) — the booking can't be confirmed until downpaymentStatus is "paid"
  downpaymentAmount: number | null; // pesos, snapshotted at submission time — equal to the service fee for the booking's province/city
  downpaymentStatus: "not_required" | "pending" | "paid";
  paymongoCheckoutSessionId: string | null;
  paymongoCheckoutUrl: string | null;
  paymongoPaymentId: string | null;
  downpaymentPaidAt: string | null;
  deletedAt: string | null; // set when moved to Trash — null again once restored
  serviceFeeWaived: boolean; // set by a staff account with canWaiveServiceFee — treats the province-computed visit fee (lib/homeServiceFees.ts) as ₱0 wherever it's quoted/displayed, without changing the underlying province fee table
};

export type SaleLineItem = {
  id: string;
  kind: "inventory" | "service";
  itemId: string | null; // set when kind === "inventory"
  description: string;
  quantity: number;
  unitPrice: number;
};

export type PaymentMethod = string; // free-form label, from lookups (kind: "payment_method")

export type Sale = {
  id: string;
  reference: string;
  branchId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  homeServiceRequestId: string | null;
  lineItems: SaleLineItem[];
  discount: number;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashierName: string;
  createdAt: string;
};

// Flat repair-log record — the simple replacement for the old checkout-style
// Sale/SaleLineItem model. No branch, no payment method, no itemized pricing.
export type RepairRecord = {
  id: string;
  reference: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string;
  contactNumber: string;
  email: string;
  deviceModel: string;
  reportedProblem: string;
  servicePerformed: string;
  partsUsed: string;
  cost: number;
  partsCost: number; // what the parts cost the shop — deducted from cost on Branch Sales to show net profit
  laborCost: number; // labor/service cost paid out for this job — deducted alongside partsCost
  otherExpenses: number; // any other expense tied to this job (e.g. transportation) — deducted alongside partsCost
  technicianName: string;
  serviceDate: string;
  notes: string;
  loggedBy: string;
  createdAt: string;
  cancelled: boolean;
  cancellationReason: string;
  cancelledAt: string | null;
  deletedAt: string | null; // set when moved to Trash — null again once restored
  qrPaymentStatus: "none" | "pending" | "paid"; // "none" until staff generates a QR Ph checkout for this record's Cost
  qrPaymentAmount: number | null; // pesos, snapshotted at checkout creation — normally equals cost, but stays fixed even if cost is edited afterward
  paymongoCheckoutSessionId: string | null;
  paymongoCheckoutUrl: string | null;
  paymongoPaymentId: string | null;
  qrPaidAt: string | null;
};

export type ActivityLog = {
  id: string;
  entityType: "customer" | "lead" | "home_service_request" | "walkin_request";
  entityId: string;
  message: string;
  actor: string; // user name or "System"
  at: string;
};

// One message in a lead/customer's conversation thread — distinct from the
// single freeform "notes" field (one running blurb) and from ActivityLog
// (system-generated status-change entries): this is a chat-style timeline
// staff log every call/text/email/note against, in order.
export type ConversationMessage = {
  id: string;
  entityType: "lead" | "customer";
  entityId: string;
  channel: "note" | "call" | "sms" | "email" | "chat";
  direction: "outbound" | "inbound"; // outbound = staff -> customer, inbound = customer -> staff
  message: string;
  staffName: string; // who logged it — blank for a pure inbound entry with no clear logger
  createdAt: string;
};

// A record of every successful staff login — name/email/role are snapshots
// taken at login time, so the log stays fully readable even if the account
// is later renamed or deleted (userId just goes null, per the FK).
export type LoginLog = {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  role: Role;
  at: string;
};

// Digital pre-repair and post-repair checklists, filled out by the
// technician once a job moves to "In Progress". Mirrors the shop's paper
// "Post-Repair Checklist" / "Service Agreement" form — the same row set is
// used for both phases (one row per inspected feature, each marked
// pass/fail/n-a with optional notes); only the framing and sign-off
// requirements differ. Pre-repair documents intake condition and is signed
// by both customer and technician. Post-repair is done together with the
// customer, carries the terms acknowledgement, both signatures, and a
// required photo of the receipt, and — once submitted — auto-completes
// the job.
export type ChecklistResult = "pass" | "fail" | "na" | null;

export type ChecklistPhase = "pre_repair" | "post_repair";

export type ChecklistItem = {
  key: string;
  label: string;
  helpText: string;
  result: ChecklistResult;
  notes: string;
};

export type ServiceAgreement = {
  id: string;
  requestId: string | null; // HomeServiceRequest.id — set for the technician/home-service flow
  repairRecordId: string | null; // RepairRecord.id — set for the admin/POS flow. Exactly one of these two is set.
  phase: ChecklistPhase;
  reference: string; // e.g. PRC-2026-0001 (pre-repair) or SA-2026-0001 (post-repair)
  customerName: string;
  deviceLabel: string;
  branchId: string | null;
  technicianId: string | null;
  technicianName: string;
  items: ChecklistItem[];
  summaryNotes: string;
  agreedToTerms: boolean; // only collected/required for phase === "post_repair"
  customerSignatureDataUrl: string | null;
  technicianSignatureDataUrl: string | null;
  receiptPhotoDataUrl: string | null; // only collected/required for phase === "post_repair"
  warrantyCoverage: string; // only collected/required for phase === "post_repair"
  cost: number; // only collected for phase === "post_repair" on the technician/home-service flow; 0/unused for repair-record checklists
  partsCost: number; // same scope as cost — what the parts cost the shop, deducted on Branch Sales for net profit
  laborCost: number; // same scope as cost — labor/service cost paid out for this job
  otherExpenses: number; // same scope as cost — any other expense tied to this job
  priceEditCount: number; // how many times the technician has self-corrected cost/laborCost after completion — capped at 3
  completedAt: string;
  sentToCustomerAt: string | null; // set once the receipt email actually sends successfully
  createdAt: string;
};

// Free-form work-in-progress notes a technician can update repeatedly while
// a job is "In Progress" — one row per request, distinct from the one-shot
// signed ServiceAgreement checklist.
export type RepairProgress = {
  id: string;
  requestId: string;
  inspectionResults: string;
  progressNotes: string;
  partsReplaced: string;
  otherDetails: string;
  updatedBy: string;
  updatedAt: string;
};

// In-app admin notification — stands in for the push/SMS/email alert a real
// deployment would send. Owner and branch admins both see these.
export type Notification = {
  id: string;
  type: "new_request" | "request_in_progress" | "checklist_completed";
  requestId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

// A CRM > Send Announcement broadcast, sent immediately or scheduled for
// later. "pending" means scheduledAt is in the future and the
// send-scheduled-broadcasts cron hasn't picked it up yet; an immediate send
// goes straight to "sent"/"failed" with scheduledAt left null.
export type CrmBroadcastStatus = "pending" | "sent" | "failed" | "cancelled";
export type CrmBroadcast = {
  id: string;
  subject: string;
  message: string;
  photos: string[]; // base64 data URLs, already compressed client-side
  scheduledAt: string | null; // null = sent immediately, no scheduling
  status: CrmBroadcastStatus;
  recipientEstimate: number; // recipient count at the time this was created/scheduled — the actual send recomputes the live list
  sentCount: number;
  failedCount: number;
  createdBy: string; // user name
  createdAt: string;
  sentAt: string | null;
};

// Public, paid "iCloud ON/OFF" (Find My iPhone) lookup — a customer pays
// online (PayMongo) for a one-off SICKW.com check on an IMEI/serial. One
// row per attempt; status is a strict forward state machine (see
// supabase/migrations/0048_icloud_checks.sql):
//   created -> payment_pending -> paid -> checked | check_failed -> refund_needed
// "paid" is only ever reached through claimIcloudCheckAsPaid's conditional
// UPDATE (lib/db.ts) — the single idempotency guard that keeps a webhook
// redelivery or a refreshed result page from spending a second SICKW
// credit on the same payment.
export type IcloudCheckStatus = "created" | "payment_pending" | "paid" | "checked" | "check_failed" | "refund_needed";
export type IcloudCheck = {
  id: string;
  imei: string;
  status: IcloudCheckStatus;
  amount: number; // pesos — this app's money fields are always plain peso numbers; centavo conversion is isolated inside lib/paymongo.ts
  paymongoCheckoutSessionId: string | null;
  paymongoPaymentId: string | null; // set once paid, from the webhook payload
  paymongoCheckoutUrl: string | null; // kept so the result page can offer a "resume payment" link while still payment_pending
  paidAt: string | null;
  sickwRawResponse: unknown | null; // always stored, even on a parse failure, so a bad lib/sickw.ts parse can be diagnosed without re-spending a credit
  icloudStatus: "ON" | "OFF" | "UNKNOWN" | null;
  resultSummary: string | null; // plain-language line shown to the customer
  failureReason: string | null;
  sickwAttemptCount: number; // bumped by Admin > Tools' Retry Check action
  adminNote: string | null; // set when an admin marks refund_needed
  checkedAt: string | null;
  customerIp: string | null; // best-effort abuse signal, not enforced
  createdAt: string;
  updatedAt: string;
};
