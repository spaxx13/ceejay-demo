export type Role = "owner_admin" | "branch_admin" | "technician" | "rider";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  technicianId: string | null; // set when role === "technician"
  riderId: string | null; // set when role === "rider"
  assignedBranchIds: string[]; // branches this account is allowed to access (branch_admin scoping) — empty means no restriction, sees all
  canManageRequests: boolean; // whether this account can access/manage Home Service Requests (branch_admin scoping)
  canDeleteRequests: boolean; // whether this account can permanently delete Home Service Requests (branch_admin scoping) — owner_admin always can regardless
  canViewAllBranches: boolean; // whether this account can see combined "All Branches" sales figures (branch_admin scoping) — false means own branch(es) only
  canAccessCrm: boolean; // whether this account can access the CRM (leads/customers) section (branch_admin scoping) — owner_admin always can regardless
  canManageWalkIns: boolean; // whether this account can access/manage Walk-In Registrations (branch_admin scoping) — independent of canManageRequests, defaults to false for new/existing branch admins
  canWaiveServiceFee: boolean; // whether this account can waive a Home Service request's visit fee (branch_admin scoping) — independent of canManageRequests, defaults to false
  canManageRepairPricing: boolean; // whether this account can access Repair Pricing (branch_admin scoping) — independent of every other flag, defaults to false
  canManageManualChecklists: boolean; // whether this account can access Manual Checklist & Receipt (technician scoping only — owner_admin/branch_admin always can), defaults to false
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
  facebookUrl: string; // backs the floating "Message us on Facebook" button shown on every public page — blank hides the button
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
  nearAreaEnabled: boolean; // whether "near" (Metro Manila/Laguna/Batangas/Rizal/Bulacan/Cavite/Pampanga) is offered on the area picker
  farAreaEnabled: boolean; // whether "far" (Other Provinces) is offered on the area picker
  farAreaContactNumber: string; // PH mobile number (e.g. 09xxxxxxxxx) — "far" has no online booking form, so picking it shows WhatsApp/Viber links built from this instead
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
// Home Service queue buckets — near = Metro Manila/Laguna/Batangas/Rizal/
// Bulacan/Cavite/Pampanga, far = Other Provinces. Null on every real
// (address-having) branch.
export type HomeServiceQueue = "near" | "far";

export type Branch = {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  homeServiceQueue: HomeServiceQueue | null;
  active: boolean;
  // Optional exact pin, copied from Google Maps (Admin > Branches) — used
  // instead of geocoding `address` for the live tracking map on /track,
  // since a plain address string sometimes resolves to the wrong nearby
  // landmark for informal local place names.
  lat: number | null;
  lng: number | null;
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

// A courier who handles the pickup/delivery legs of a Pickup & Delivery
// request — a separate role from Technician, who only ever does the repair
// itself. `branchId` is just where the rider is based for display/roster
// purposes; assignment is branch-wide and manual (Admin > Pickup & Delivery),
// not restricted to that branch's own requests.
export type VehicleType = "motorcycle" | "car" | "bicycle";
export type Rider = {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  branchId: string | null;
  vehicle: VehicleType;
  active: boolean; // account enabled/disabled, admin-controlled
  onDuty: boolean; // "available for a job right now" — rider self-toggles this from /rider
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
// duplicate labels), Front Camera, Camera Lens, Reglass, Charging Port
// (walk-in only — see EXCLUDED_FROM_HOME_SERVICE), and Screen Repair.
// `quality` is only meaningful for category "screen" ("high_quality" |
// "original"); empty string otherwise.
export type PriceCategory =
  | "battery"
  | "backhousing"
  | "back_camera"
  | "front_camera"
  | "camera_lens"
  | "reglass"
  | "charging_port"
  | "screen";
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
  confirmationExpiresAt: string | null; // BOOKING_CONFIRMATION_WINDOW_MINUTES after submission — the void-unconfirmed-requests cron cancels the request once this passes with confirmedAt still null
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
  // Live technician tracking (supabase/migrations/0069) — token for the
  // customer's /track-technician link, and the technician's latest GPS fix.
  trackingToken: string | null;
  techLat: number | null;
  techLng: number | null;
  techLocationAt: string | null;
  serviceFeeWaived: boolean; // set by a staff account with canWaiveServiceFee — treats the province-computed visit fee (lib/homeServiceFees.ts) as ₱0 wherever it's quoted/displayed, without changing the underlying province fee table
  // Pickup & Delivery — a second fulfillment mode alongside the default
  // "on_site" (technician visits the address). "pickup_delivery" reuses this
  // same request row and the same technician assignment/status machinery for
  // the repair itself; only the rider legs are new. See
  // lib/db.ts's pickupDeliveryStage() for how these fields (plus the
  // request's own statusId) collapse into one display stage.
  fulfillmentMode: "on_site" | "pickup_delivery";
  pickupRiderId: string | null;
  deliveryRiderId: string | null; // can differ from pickupRiderId — assigned separately, once the repair is done
  pickupStartedAt: string | null; // rider marked "on the way" to the customer for pickup
  pickedUpAt: string | null; // rider has the device, in hand at the customer's address
  headingToShopAt: string | null; // rider marked "on the way" to the branch with the device
  receivedAtShopAt: string | null; // rider handed the device off at the shop — pickup leg complete
  outForDeliveryAt: string | null; // rider marked "on the way" to the customer for delivery
  deliveredAt: string | null; // rider handed the device to the customer — delivery leg complete
  pickupSignatureDataUrl: string | null;
  deliverySignatureDataUrl: string | null;
  // Live location, pinged by the rider's own browser (Geolocation API) while
  // the pickup leg is "On The Way" or "On The Way to Branch" — see
  // components/RiderLocationReporter.tsx and app/api/rider/location. Stale
  // once the leg moves past those two stages; not cleared, just ignored.
  riderLat: number | null;
  riderLng: number | null;
  riderLocationUpdatedAt: string | null;
  pickupPhotoDataUrl: string | null; // required proof-of-pickup photo, captured when the rider marks "Picked Up"
  deliveredBranchId: string | null; // which branch the rider actually dropped the device off at ("Delivered to Branch")
  // Rider must Accept a job before starting the trip for it (see
  // riderAcceptPickup/riderAcceptDelivery in lib/actions.ts) — Declining
  // clears the rider assignment back to the unassigned pool instead of
  // setting a "declined" flag here.
  pickupRiderAcceptedAt: string | null;
  deliveryRiderAcceptedAt: string | null;
  // Structured device-condition checklist + labeled photos, captured by the
  // rider at the "Picked Up" step (components/DeviceConditionForm.tsx) —
  // supersedes the single pickupPhotoDataUrl above for pickup_delivery jobs.
  pickupConditionChecklist: DeviceConditionChecklist | null;
  pickupPhotos: PickupPhoto[] | null;
  // Optional security seal number the rider records when packaging the
  // device at pickup (FINAL FLOW spec item 12) — shown alongside the QR
  // code so shop staff can verify the package wasn't opened in transit.
  pickupSecuritySeal: string | null;
};

export const DEVICE_CONDITION_ITEMS = [
  "front",
  "back",
  "leftSide",
  "rightSide",
  "top",
  "bottom",
  "lcd",
  "touch",
  "camera",
  "housing",
  "buttons",
  "chargingPort",
] as const;
export type DeviceConditionItem = (typeof DEVICE_CONDITION_ITEMS)[number];
export type DeviceConditionChecklist = Partial<Record<DeviceConditionItem, "ok" | "damaged">> & { existingDamageNotes?: string };
export type PickupPhoto = { label: string; dataUrl: string };

// Pickup & Delivery "Phase 5" — Exception Handling (FINAL FLOW spec item
// 31). One generic kind of record covers every exception the spec lists —
// see REQUEST_EXCEPTION_LABELS for what each means and who can report it
// (components/ReportExceptionForm.tsx).
export const REQUEST_EXCEPTION_KINDS = [
  "reschedule",
  "contact_attempted",
  "cancel",
  "flag_damage",
  "return_device",
  "payment_hold",
  "stop_review",
  "incident",
  "stop_delivery",
] as const;
export type RequestExceptionKind = (typeof REQUEST_EXCEPTION_KINDS)[number];

export const REQUEST_EXCEPTION_LABELS: Record<RequestExceptionKind, string> = {
  reschedule: "Customer Unavailable — Rescheduled",
  contact_attempted: "Rider Couldn't Find Customer",
  cancel: "Booking Cancelled",
  flag_damage: "Additional Damage Found",
  return_device: "Customer Declined Quotation — Return Device",
  payment_hold: "Payment Issue — On Hold",
  stop_review: "Wrong Customer/Device — Needs Review",
  incident: "Rider Incident Report",
  stop_delivery: "Wrong Unit Completed — Delivery Stopped",
};

export type RequestException = {
  id: string;
  requestId: string;
  kind: RequestExceptionKind;
  reason: string;
  evidencePhotoDataUrl: string | null;
  reportedBy: string;
  reportedByRole: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
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
  entityType: "customer" | "lead" | "home_service_request" | "walkin_request" | "manual_checklist";
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

// One "I'm here" mark for a technician or branch admin's shift, at a
// specific branch. Separate from LoginLog, which fires on every login
// regardless of whether the staff member is actually at a branch — see
// 0060_check_ins.sql. At most one per user per calendar day.
export type CheckIn = {
  id: string;
  userId: string | null;
  userName: string;
  role: Role;
  branchId: string | null;
  branchName: string;
  checkedInAt: string;
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

// A standalone device-condition checklist + receipt, filled out directly by
// an admin or technician for a customer who isn't otherwise in the system
// (no online booking, no POS sale) — e.g. a quick record and printable/
// emailable proof of drop-off. Deliberately lighter than ServiceAgreement:
// one single checklist (not pre/post phases) and no pricing fields — see
// RepairRecord + ServiceAgreement for the full priced POS flow instead.
export type ManualChecklist = {
  id: string;
  reference: string; // e.g. MC-2026-0001
  branchId: string | null;
  createdByUserId: string | null;
  createdByName: string;
  customerName: string;
  customerPhone: string;
  deviceLabel: string;
  items: ChecklistItem[];
  summaryNotes: string;
  customerSignatureDataUrl: string | null;
  staffSignatureDataUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
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
  type: "new_request" | "request_in_progress" | "checklist_completed" | "new_walkin" | "technician_on_the_way";
  requestId: string | null;
  walkinRequestId: string | null;
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
