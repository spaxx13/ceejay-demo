export type Role = "owner_admin" | "branch_admin" | "technician";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  technicianId: string | null; // set when role === "technician"
  assignedBranchIds: string[]; // branches this account is allowed to access (branch_admin scoping) — empty means no restriction, sees all
  canManageRequests: boolean; // whether this account can access/manage Home Service Requests (branch_admin scoping)
  canViewAllBranches: boolean; // whether this account can see combined "All Branches" sales figures (branch_admin scoping) — false means own branch(es) only
  active: boolean;
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

export type Branch = {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
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
  createdAt: string;
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
  lat: number | null;
  lng: number | null;
  preferredDatetime: string;
  statusId: string; // LookupItem id (request_status)
  assignedTechnicianId: string | null;
  autoAssigned: boolean;
  branchId: string | null;
  adminNotes: string;
  createdAt: string;
  statusHistory: { statusId: string; at: string }[];
  customFields: Record<string, string | boolean>; // keyed by CustomFormField.key
  vlogConsent: boolean;
  vlogBlurPreference: "blurred" | "not_blurred" | ""; // only meaningful when vlogConsent is true
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
};

export type ActivityLog = {
  id: string;
  entityType: "customer" | "lead" | "home_service_request";
  entityId: string;
  message: string;
  actor: string; // user name or "System"
  at: string;
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
  type: "request_in_progress" | "checklist_completed";
  requestId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};
