import "server-only";
import { Pool, type QueryResultRow } from "pg";
import type {
  User,
  Branch,
  Technician,
  Customer,
  LookupItem,
  DeviceModel,
  ServicePrice,
  Lead,
  WalkInRequest,
  HomeServiceRequest,
  ServiceFeeWaiver,
  ActivityLog,
  Sale,
  RepairRecord,
  SaleLineItem,
  SiteContent,
  RequestFormContent,
  CustomFormField,
  ServiceAgreement,
  RepairProgress,
  Notification,
  Expense,
  LoginLog,
  CheckIn,
  PushSubscription,
  ConversationMessage,
  CrmBroadcast,
  CrmBroadcastStatus,
  IcloudCheck,
  IcloudCheckStatus,
} from "./types";
import { sendPushToUsers } from "./push";
import { sendSms, smsConfigured } from "./sms";
import { serviceFeeAmount } from "./homeServiceFees";

// Single pooled connection, reused across invocations within the same
// serverless instance (and across all of local dev). Uses the pooled
// (pgbouncer) connection string — right choice for Vercel's serverless
// model, where connections need to be short-lived and plentiful.
const g = globalThis as unknown as { __ceejayPool?: Pool };
function getPool(): Pool {
  if (!g.__ceejayPool) {
    const connectionString = (process.env.POSTGRES_URL ?? "").split("?")[0];
    if (!connectionString) throw new Error("POSTGRES_URL is not set");
    g.__ceejayPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return g.__ceejayPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// ---------- Row mappers (snake_case DB row -> camelCase app type) ----------

function toIso(v: Date | string | null): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}
function toIsoOrNull(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}
function toDateStr(v: Date | string | null): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  return d.toISOString().slice(0, 10);
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: User["role"];
  technician_id: string | null;
  assigned_branch_ids: string[];
  can_manage_requests: boolean;
  can_delete_requests: boolean;
  can_view_all_branches: boolean;
  can_access_crm: boolean;
  can_manage_walkins: boolean;
  can_waive_service_fee: boolean;
  can_manage_repair_pricing: boolean;
  phone: string;
  active: boolean;
};
function mapUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    technicianId: r.technician_id,
    assignedBranchIds: r.assigned_branch_ids ?? [],
    canManageRequests: r.can_manage_requests,
    canDeleteRequests: r.can_delete_requests,
    canViewAllBranches: r.can_view_all_branches,
    canAccessCrm: r.can_access_crm,
    canManageWalkIns: r.can_manage_walkins,
    canWaiveServiceFee: r.can_waive_service_fee,
    canManageRepairPricing: r.can_manage_repair_pricing,
    phone: r.phone,
    active: r.active,
  };
}

type PushSubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: Date };
function mapPushSubscription(r: PushSubscriptionRow): PushSubscription {
  return { id: r.id, userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, createdAt: toIso(r.created_at) };
}

// True when a branch shouldn't be shown to this user (branch_admin scoping
// — a branch admin only sees their assigned branch(es)). An account with no
// assigned branches has no restriction and sees everything. A null user or
// null branchId is never treated as hidden.
export function isBranchHidden(user: Pick<User, "assignedBranchIds"> | null, branchId: string | null) {
  if (!branchId || !user || user.assignedBranchIds.length === 0) return false;
  return !user.assignedBranchIds.includes(branchId);
}

// True when this account is allowed to access/manage Home Service Requests.
// Owner admins always can; branch admins are scoped by canManageRequests.
export function canManageHomeServiceRequests(user: Pick<User, "role" | "canManageRequests"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canManageRequests);
}

// True when this account is allowed to permanently delete Home Service
// Requests. Owner admins always can; branch admins need the separate
// canDeleteRequests flag (off by default) even if they can otherwise manage
// requests — deleting is a stronger, irreversible action than managing one.
export function canDeleteHomeServiceRequests(user: Pick<User, "role" | "canDeleteRequests"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canDeleteRequests);
}

// The branch stored on a home-service request/agreement is only ever a
// snapshot taken when the job was assigned to a technician (their branch at
// that moment) — it never updates again after that. If the technician's own
// branch assignment changes later, older jobs stay stuck showing the branch
// that's no longer accurate. Always resolve to the technician's *current*
// branch instead, falling back to the stored value only when there's no
// assigned technician (or the technician record itself has no branch) to
// resolve from.
export function homeServiceBranchId(
  assignedTechnicianId: string | null,
  storedBranchId: string | null,
  technicians: Pick<Technician, "id" | "branchIds">[]
) {
  const tech = assignedTechnicianId ? technicians.find((t) => t.id === assignedTechnicianId) : undefined;
  return tech?.branchIds[0] ?? storedBranchId;
}

// Repair records and service agreements only ever store the technician's
// *name* (no technician_id FK), so this is the one place that turns a raw
// name into that technician's configured earnings share — every Sales
// report should call this rather than re-deriving its own default, so they
// can never disagree with each other or with Settings > Technicians.
// Case-insensitive so a typo'd capitalization ("jhong" vs "Jhong") still
// resolves to the right technician's configured share instead of silently
// falling back to the 50% default.
export function technicianSharePercent(technicianName: string, technicians: Pick<Technician, "name" | "earningsSharePercent">[]) {
  const name = technicianName.trim().toLowerCase();
  const tech = technicians.find((t) => t.name.trim().toLowerCase() === name);
  return tech?.earningsSharePercent ?? 50;
}

// Every Sales report groups POS/home-service records by the technician name
// typed on each one — with no FK, a name typed in a different case
// ("jhong" one day, "Jhong" the next) would otherwise split one technician
// into multiple phantom rows. This resolves a raw typed name to the exact
// casing configured on Settings > Technicians whenever one matches
// case-insensitively, so every report groups them as the same technician;
// falls back to the trimmed raw name when it matches no configured
// technician (renamed/deleted technician, or a one-off typo).
export function canonicalTechnicianName(rawName: string, technicians: Pick<Technician, "name">[]): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;
  const match = technicians.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match ? match.name.trim() : trimmed;
}

// True when this account can see combined "All Branches" sales figures on
// Branch Sales (the aggregate stat cards, All-Branches summary, and Owner
// Deductions). Owner admins always can; branch admins are scoped by
// canViewAllBranches and otherwise only see their own branch card(s).
export function canViewAllBranchSales(user: Pick<User, "role" | "canViewAllBranches"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canViewAllBranches);
}

// True when this account is allowed to access the CRM (Leads/Customers).
// Owner admins always can; branch admins are scoped by canAccessCrm.
export function canAccessCrm(user: Pick<User, "role" | "canAccessCrm"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canAccessCrm);
}

// True when this account is allowed to access/manage Walk-In Registrations.
// Owner admins always can; branch admins are scoped by canManageWalkIns —
// deliberately independent of canManageRequests, so a branch admin can have
// one without the other.
export function canManageWalkIns(user: Pick<User, "role" | "canManageWalkIns"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canManageWalkIns);
}

// True when this account is allowed to waive a Home Service request's
// visit fee. Owner admins always can; branch admins are scoped by
// canWaiveServiceFee — deliberately independent of canManageRequests, so
// a branch admin can have one without the other.
export function canWaiveServiceFee(user: Pick<User, "role" | "canWaiveServiceFee"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canWaiveServiceFee);
}

// True when this account is allowed to access Repair Pricing. Owner admins
// always can; branch admins are scoped by canManageRepairPricing —
// deliberately independent of every other flag, same convention as
// canWaiveServiceFee.
export function canManageRepairPricing(user: Pick<User, "role" | "canManageRepairPricing"> | null) {
  if (!user) return false;
  return user.role === "owner_admin" || (user.role === "branch_admin" && user.canManageRepairPricing);
}

type BranchRow = { id: string; name: string; address: string; contact_number: string; home_service_queue: Branch["homeServiceQueue"]; active: boolean };
function mapBranch(r: BranchRow): Branch {
  return { id: r.id, name: r.name, address: r.address, contactNumber: r.contact_number, homeServiceQueue: r.home_service_queue, active: r.active };
}

type TechnicianRow = {
  id: string; name: string; contact_number: string; email: string; employment_status: Technician["employmentStatus"];
  branch_ids: string[]; active: boolean; earnings_share_percent: string | number;
};
function mapTechnician(r: TechnicianRow): Technician {
  return {
    id: r.id, name: r.name, contactNumber: r.contact_number, email: r.email, employmentStatus: r.employment_status,
    branchIds: r.branch_ids ?? [], active: r.active, earningsSharePercent: Number(r.earnings_share_percent ?? 50),
  };
}

type CustomerRow = { id: string; name: string; phone: string; email: string; street: string; province: string; landmark: string; source: string; notes: string; created_at: Date };
function mapCustomer(r: CustomerRow): Customer {
  return { id: r.id, name: r.name, phone: r.phone, email: r.email, street: r.street, province: r.province, landmark: r.landmark, source: r.source, notes: r.notes, createdAt: toIso(r.created_at) };
}

type LookupRow = { id: string; kind: LookupItem["kind"]; label: string; order_num: number; active: boolean };
function mapLookup(r: LookupRow): LookupItem {
  return { id: r.id, kind: r.kind, label: r.label, order: r.order_num, active: r.active };
}

type DeviceModelRow = { id: string; brand_id: string; name: string; order_num: number; active: boolean };
function mapDeviceModel(r: DeviceModelRow): DeviceModel {
  return { id: r.id, brandId: r.brand_id, name: r.name, order: r.order_num, active: r.active };
}

type ServicePriceRow = {
  id: string;
  category: ServicePrice["category"];
  device_model_id: string;
  quality: string;
  price: string | number;
  updated_at: Date;
};
function mapServicePrice(r: ServicePriceRow): ServicePrice {
  return { id: r.id, category: r.category, deviceModelId: r.device_model_id, quality: r.quality, price: Number(r.price), updatedAt: toIso(r.updated_at) };
}

type LeadRow = { id: string; customer_id: string | null; name: string; phone: string; email: string; source: string; status_id: string; assigned_to: string | null; follow_up_date: Date | string | null; notes: string; branch_id: string | null; created_at: Date };
function mapLead(r: LeadRow): Lead {
  return { id: r.id, customerId: r.customer_id, name: r.name, phone: r.phone, email: r.email, source: r.source, statusId: r.status_id, assignedTo: r.assigned_to, followUpDate: r.follow_up_date ? toDateStr(r.follow_up_date) : null, notes: r.notes, branchId: r.branch_id, createdAt: toIso(r.created_at) };
}

type RequestRow = {
  id: string; reference: string; customer_id: string | null; customer_name: string; phone: string; email: string;
  device_brand_id: string | null; device_model_id: string | null; device_other: string; service_type_id: string;
  issue_description: string; photo_data_url: string | null; street: string; landmark: string; province: string; city: string; barangay: string;
  lat: number | null; lng: number | null; preferred_datetime: Date | string | null;
  status_id: string; assigned_technician_id: string | null; auto_assigned: boolean; branch_id: string | null; queue_branch_id: string | null; admin_notes: string;
  status_history: { statusId: string; at: string }[]; custom_fields: Record<string, string | boolean>; created_at: Date;
  vlog_consent: boolean; vlog_blur_preference: HomeServiceRequest["vlogBlurPreference"]; screen_quality: HomeServiceRequest["screenQuality"]; back_housing_color: string; reminder_sent_at: Date | null;
  confirmation_token: string | null; confirmation_expires_at: Date | null; confirmed_at: Date | null; booking_group_id: string | null;
  deleted_at: Date | null; service_fee_waived: boolean;
  downpayment_required: boolean; downpayment_amount: string | number | null; downpayment_status: HomeServiceRequest["downpaymentStatus"];
  paymongo_checkout_session_id: string | null; paymongo_checkout_url: string | null; paymongo_payment_id: string | null; downpayment_paid_at: Date | null;
};
function mapRequest(r: RequestRow): HomeServiceRequest {
  return {
    id: r.id, reference: r.reference, customerId: r.customer_id, customerName: r.customer_name, phone: r.phone, email: r.email,
    deviceBrandId: r.device_brand_id, deviceModelId: r.device_model_id, deviceOther: r.device_other, serviceTypeId: r.service_type_id,
    issueDescription: r.issue_description, photoDataUrl: r.photo_data_url, street: r.street, landmark: r.landmark, province: r.province, city: r.city, barangay: r.barangay,
    lat: r.lat, lng: r.lng, preferredDatetime: toDateStr(r.preferred_datetime),
    statusId: r.status_id, assignedTechnicianId: r.assigned_technician_id, autoAssigned: r.auto_assigned, branchId: r.branch_id, queueBranchId: r.queue_branch_id, adminNotes: r.admin_notes,
    createdAt: toIso(r.created_at), statusHistory: r.status_history ?? [], customFields: r.custom_fields ?? {},
    vlogConsent: r.vlog_consent, vlogBlurPreference: r.vlog_blur_preference || "", screenQuality: r.screen_quality || "", backHousingColor: r.back_housing_color || "",
    reminderSentAt: toIsoOrNull(r.reminder_sent_at),
    confirmationToken: r.confirmation_token, confirmationExpiresAt: toIsoOrNull(r.confirmation_expires_at), confirmedAt: toIsoOrNull(r.confirmed_at),
    bookingGroupId: r.booking_group_id, deletedAt: toIsoOrNull(r.deleted_at), serviceFeeWaived: r.service_fee_waived,
    downpaymentRequired: r.downpayment_required, downpaymentAmount: r.downpayment_amount === null ? null : Number(r.downpayment_amount),
    downpaymentStatus: r.downpayment_status, paymongoCheckoutSessionId: r.paymongo_checkout_session_id, paymongoCheckoutUrl: r.paymongo_checkout_url,
    paymongoPaymentId: r.paymongo_payment_id, downpaymentPaidAt: toIsoOrNull(r.downpayment_paid_at),
  };
}

type ActivityRow = { id: string; entity_type: ActivityLog["entityType"]; entity_id: string; message: string; actor: string; at: Date };
function mapActivity(r: ActivityRow): ActivityLog {
  return { id: r.id, entityType: r.entity_type, entityId: r.entity_id, message: r.message, actor: r.actor, at: toIso(r.at) };
}

type LoginLogRow = { id: string; user_id: string | null; user_name: string; user_email: string; role: LoginLog["role"]; at: Date };
function mapLoginLog(r: LoginLogRow): LoginLog {
  return { id: r.id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email, role: r.role, at: toIso(r.at) };
}

type CheckInRow = { id: string; user_id: string | null; user_name: string; role: CheckIn["role"]; branch_id: string | null; branch_name: string; checked_in_at: Date };
function mapCheckIn(r: CheckInRow): CheckIn {
  return { id: r.id, userId: r.user_id, userName: r.user_name, role: r.role, branchId: r.branch_id, branchName: r.branch_name, checkedInAt: toIso(r.checked_in_at) };
}

type SaleRow = { id: string; reference: string; branch_id: string; customer_id: string | null; customer_name: string; customer_phone: string; home_service_request_id: string | null; discount: string; subtotal: string; total: string; payment_method: Sale["paymentMethod"]; cashier_name: string; created_at: Date };
function mapSale(r: SaleRow, lineItems: SaleLineItem[]): Sale {
  return { id: r.id, reference: r.reference, branchId: r.branch_id, customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone, homeServiceRequestId: r.home_service_request_id, lineItems, discount: Number(r.discount), subtotal: Number(r.subtotal), total: Number(r.total), paymentMethod: r.payment_method, cashierName: r.cashier_name, createdAt: toIso(r.created_at) };
}

type SaleLineItemRow = { id: string; sale_id: string; kind: SaleLineItem["kind"]; item_id: string | null; description: string; quantity: string; unit_price: string };
function mapSaleLineItem(r: SaleLineItemRow): SaleLineItem {
  return { id: r.id, kind: r.kind, itemId: r.item_id, description: r.description, quantity: Number(r.quantity), unitPrice: Number(r.unit_price) };
}

type RepairRecordRow = {
  id: string; reference: string; branch_id: string | null; customer_id: string | null; customer_name: string; contact_number: string; email: string; device_model: string;
  reported_problem: string; service_performed: string; parts_used: string; cost: string; parts_cost: string; labor_cost: string; other_expenses: string; technician_name: string;
  service_date: Date | string; notes: string; logged_by: string; created_at: Date;
  cancelled: boolean; cancellation_reason: string; cancelled_at: Date | null;
  deleted_at: Date | null;
  qr_payment_status: RepairRecord["qrPaymentStatus"]; qr_payment_amount: string | number | null;
  paymongo_checkout_session_id: string | null; paymongo_checkout_url: string | null; paymongo_payment_id: string | null; qr_paid_at: Date | null;
};
function mapRepairRecord(r: RepairRecordRow): RepairRecord {
  return {
    id: r.id, reference: r.reference, branchId: r.branch_id, customerId: r.customer_id, customerName: r.customer_name, contactNumber: r.contact_number, email: r.email,
    deviceModel: r.device_model, reportedProblem: r.reported_problem, servicePerformed: r.service_performed, partsUsed: r.parts_used,
    cost: Number(r.cost), partsCost: Number(r.parts_cost ?? 0), laborCost: Number(r.labor_cost ?? 0), otherExpenses: Number(r.other_expenses ?? 0),
    technicianName: r.technician_name, serviceDate: toDateStr(r.service_date), notes: r.notes,
    loggedBy: r.logged_by, createdAt: toIso(r.created_at),
    cancelled: r.cancelled, cancellationReason: r.cancellation_reason, cancelledAt: toIsoOrNull(r.cancelled_at),
    deletedAt: toIsoOrNull(r.deleted_at),
    qrPaymentStatus: r.qr_payment_status, qrPaymentAmount: r.qr_payment_amount === null ? null : Number(r.qr_payment_amount),
    paymongoCheckoutSessionId: r.paymongo_checkout_session_id, paymongoCheckoutUrl: r.paymongo_checkout_url,
    paymongoPaymentId: r.paymongo_payment_id, qrPaidAt: toIsoOrNull(r.qr_paid_at),
  };
}

type SiteContentRow = {
  hero_kicker: string; hero_headline_prefix: string; hero_headline_highlight: string; hero_headline_suffix: string; hero_subtext: string;
  primary_cta_label: string; secondary_cta_label: string; cta_banner_title: string; cta_banner_subtitle: string; cta_banner_button_label: string;
  facebook_url: string;
};
function mapSiteContent(r: SiteContentRow): SiteContent {
  return {
    heroKicker: r.hero_kicker, heroHeadlinePrefix: r.hero_headline_prefix, heroHeadlineHighlight: r.hero_headline_highlight, heroHeadlineSuffix: r.hero_headline_suffix,
    heroSubtext: r.hero_subtext, primaryCtaLabel: r.primary_cta_label, secondaryCtaLabel: r.secondary_cta_label,
    ctaBannerTitle: r.cta_banner_title, ctaBannerSubtitle: r.cta_banner_subtitle, ctaBannerButtonLabel: r.cta_banner_button_label,
    facebookUrl: r.facebook_url,
  };
}

type RequestFormContentRow = {
  page_kicker: string; page_title: string; page_subtitle: string; submit_button_label: string; success_title: string; success_body: string;
  near_area_enabled: boolean; far_area_enabled: boolean; far_area_contact_number: string;
};
function mapRequestFormContent(r: RequestFormContentRow): RequestFormContent {
  return {
    pageKicker: r.page_kicker, pageTitle: r.page_title, pageSubtitle: r.page_subtitle, submitButtonLabel: r.submit_button_label, successTitle: r.success_title, successBody: r.success_body,
    nearAreaEnabled: r.near_area_enabled, farAreaEnabled: r.far_area_enabled, farAreaContactNumber: r.far_area_contact_number,
  };
}

type CustomFieldRow = { id: string; key: string; system_key: CustomFormField["systemKey"]; label: string; placeholder: string; type: CustomFormField["type"]; required: boolean; options: string[]; order_num: number; active: boolean };
function mapCustomField(r: CustomFieldRow): CustomFormField {
  return { id: r.id, key: r.key, systemKey: r.system_key, label: r.label, placeholder: r.placeholder, type: r.type, required: r.required, options: r.options ?? [], order: r.order_num, active: r.active };
}

type ServiceAgreementRow = {
  id: string; request_id: string | null; repair_record_id: string | null; phase: ServiceAgreement["phase"]; reference: string; customer_name: string; device_label: string;
  branch_id: string | null; technician_id: string | null; technician_name: string; items: ServiceAgreement["items"]; summary_notes: string;
  agreed_to_terms: boolean; customer_signature_data_url: string | null; technician_signature_data_url: string | null; receipt_photo_data_url: string | null;
  warranty_coverage: string; cost: string; parts_cost: string; labor_cost: string; other_expenses: string; price_edit_count: number; completed_at: Date; sent_to_customer_at: Date | null; created_at: Date;
};
function mapServiceAgreement(r: ServiceAgreementRow): ServiceAgreement {
  return {
    id: r.id, requestId: r.request_id, repairRecordId: r.repair_record_id, phase: r.phase, reference: r.reference, customerName: r.customer_name, deviceLabel: r.device_label,
    branchId: r.branch_id, technicianId: r.technician_id, technicianName: r.technician_name, items: r.items ?? [], summaryNotes: r.summary_notes,
    agreedToTerms: r.agreed_to_terms, customerSignatureDataUrl: r.customer_signature_data_url, technicianSignatureDataUrl: r.technician_signature_data_url,
    receiptPhotoDataUrl: r.receipt_photo_data_url, warrantyCoverage: r.warranty_coverage ?? "", cost: Number(r.cost ?? 0), partsCost: Number(r.parts_cost ?? 0),
    laborCost: Number(r.labor_cost ?? 0), otherExpenses: Number(r.other_expenses ?? 0), priceEditCount: r.price_edit_count ?? 0, completedAt: toIso(r.completed_at), sentToCustomerAt: toIsoOrNull(r.sent_to_customer_at), createdAt: toIso(r.created_at),
  };
}

// Derives a repair record's workflow status from its cancelled flag and
// which checklist phases exist for it — there is no separate status column,
// so this stays the single source of truth every page uses.
export type RepairRecordStatus = "pending" | "completed" | "cancelled";
export function getRepairRecordStatus(record: RepairRecord, agreements: ServiceAgreement[]): RepairRecordStatus {
  if (record.cancelled) return "cancelled";
  const hasPost = agreements.some((a) => a.repairRecordId === record.id && a.phase === "post_repair");
  return hasPost ? "completed" : "pending";
}

type RepairProgressRow = {
  id: string; request_id: string; inspection_results: string; progress_notes: string; parts_replaced: string;
  other_details: string; updated_by: string; updated_at: Date;
};
function mapRepairProgress(r: RepairProgressRow): RepairProgress {
  return {
    id: r.id, requestId: r.request_id, inspectionResults: r.inspection_results, progressNotes: r.progress_notes,
    partsReplaced: r.parts_replaced, otherDetails: r.other_details, updatedBy: r.updated_by, updatedAt: toIso(r.updated_at),
  };
}

type NotificationRow = {
  id: string;
  type: Notification["type"];
  request_id: string | null;
  walkin_request_id: string | null;
  message: string;
  created_at: Date;
  read_at: Date | null;
};
function mapNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    type: r.type,
    requestId: r.request_id,
    walkinRequestId: r.walkin_request_id,
    message: r.message,
    createdAt: toIso(r.created_at),
    readAt: toIsoOrNull(r.read_at),
  };
}

type ExpenseRow = {
  id: string;
  description: string;
  amount: string;
  target: Expense["target"];
  technician_name: string | null;
  branch_id: string | null;
  expense_date: Date | string;
  created_by: string;
  created_at: Date;
};
function mapExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    target: r.target,
    technicianName: r.technician_name,
    branchId: r.branch_id,
    expenseDate: toDateStr(r.expense_date),
    createdBy: r.created_by,
    createdAt: toIso(r.created_at),
  };
}

// ---------- Bulk readers (fetch full table, mapped) ----------
// This app is low-traffic; fetching full tables and filtering/sorting in
// JS (same as the in-memory store always did) keeps every call site's
// existing filter/sort logic unchanged instead of re-deriving it as SQL.

export async function getUsers() {
  return (await query<UserRow>("select * from users order by name")).map(mapUser);
}
export async function getBranches() {
  return (await query<BranchRow>("select * from branches order by name")).map(mapBranch);
}
export async function getTechnicians() {
  return (await query<TechnicianRow>("select * from technicians order by name")).map(mapTechnician);
}
export async function getCustomers() {
  return (await query<CustomerRow>("select * from customers order by created_at desc")).map(mapCustomer);
}
export async function getCustomerById(id: string) {
  const row = await queryOne<CustomerRow>("select * from customers where id = $1", [id]);
  return row ? mapCustomer(row) : null;
}
export async function getLookups() {
  return (await query<LookupRow>("select * from lookups order by kind, order_num")).map(mapLookup);
}
export async function getDeviceModels() {
  return (await query<DeviceModelRow>("select * from device_models order by brand_id, order_num, name")).map(mapDeviceModel);
}
export async function getServicePrices() {
  return (await query<ServicePriceRow>("select * from service_prices")).map(mapServicePrice);
}
export async function getLeads() {
  return (await query<LeadRow>("select * from leads order by created_at desc")).map(mapLead);
}
export async function getLeadById(id: string) {
  const row = await queryOne<LeadRow>("select * from leads where id = $1", [id]);
  return row ? mapLead(row) : null;
}

type WalkInRequestRow = {
  id: string; reference: string; customer_id: string | null; name: string; phone: string; email: string; branch_id: string | null;
  device_brand_id: string | null; device_model_id: string | null; device_other: string; service_type_id: string | null;
  issue_description: string; photo_data_url: string | null; preferred_date: Date | string | null; status_id: string;
  deleted_at: Date | null; created_at: Date;
};
function mapWalkInRequest(r: WalkInRequestRow): WalkInRequest {
  return {
    id: r.id, reference: r.reference, customerId: r.customer_id, name: r.name, phone: r.phone, email: r.email, branchId: r.branch_id,
    deviceBrandId: r.device_brand_id, deviceModelId: r.device_model_id, deviceOther: r.device_other, serviceTypeId: r.service_type_id,
    issueDescription: r.issue_description, photoDataUrl: r.photo_data_url, preferredDate: r.preferred_date ? toDateStr(r.preferred_date) : null,
    statusId: r.status_id, deletedAt: toIsoOrNull(r.deleted_at), createdAt: toIso(r.created_at),
  };
}
export async function getWalkInRequests() {
  return (await query<WalkInRequestRow>("select * from walkin_requests where deleted_at is null order by created_at desc")).map(mapWalkInRequest);
}
export async function getDeletedWalkInRequests() {
  return (await query<WalkInRequestRow>("select * from walkin_requests where deleted_at is not null order by deleted_at desc")).map(mapWalkInRequest);
}
export async function getWalkInRequestById(id: string) {
  const row = await queryOne<WalkInRequestRow>("select * from walkin_requests where id = $1", [id]);
  return row ? mapWalkInRequest(row) : null;
}

type ServiceFeeWaiverRow = {
  id: string; request_id: string; queue_branch_id: string | null; reference: string; customer_name: string; amount: string | number;
  waived_by: string; waived_at: Date; deleted_at: Date | null;
};
function mapServiceFeeWaiver(r: ServiceFeeWaiverRow): ServiceFeeWaiver {
  return {
    id: r.id, requestId: r.request_id, queueBranchId: r.queue_branch_id, reference: r.reference, customerName: r.customer_name,
    amount: Number(r.amount), waivedBy: r.waived_by, waivedAt: toIso(r.waived_at), deletedAt: toIsoOrNull(r.deleted_at),
  };
}
// Every waiver lands straight in Trash (deleted_at set on creation) —
// there is no "active" list to read, only this Trash-tab query.
export async function getDeletedServiceFeeWaivers() {
  return (await query<ServiceFeeWaiverRow>("select * from service_fee_waivers where deleted_at is not null order by deleted_at desc")).map(
    mapServiceFeeWaiver
  );
}

export async function getRequests() {
  return (await query<RequestRow>("select * from home_service_requests where deleted_at is null order by created_at desc")).map(mapRequest);
}
// Trashed requests — hidden from getRequests() and every list/report built
// on it, but still fetchable here so the Trash page can list them and offer
// Restore / Delete Permanently.
export async function getDeletedRequests() {
  return (await query<RequestRow>("select * from home_service_requests where deleted_at is not null order by deleted_at desc")).map(mapRequest);
}
export async function getRequestById(id: string) {
  const row = await queryOne<RequestRow>("select * from home_service_requests where id = $1", [id]);
  return row ? mapRequest(row) : null;
}
// A multi-device booking shares one confirmation_token across every
// device's row (one quotation email, one confirm link for all of them) —
// this returns every row in that group, not just the first match.
export async function getRequestsByConfirmationToken(token: string) {
  return (await query<RequestRow>("select * from home_service_requests where confirmation_token = $1", [token])).map(mapRequest);
}
// Marks every row in a booking (keyed by its shared confirmation_token) as
// awaiting the PayMongo QR Ph checkout for its down payment — mirrors
// markIcloudCheckPaymentPending, but scoped to the whole booking group
// since the down payment is for one visit, not per device.
export async function markHomeServiceDownpaymentPending(token: string, sessionId: string, checkoutUrl: string) {
  await query(
    "update home_service_requests set paymongo_checkout_session_id=$2, paymongo_checkout_url=$3 where confirmation_token=$1",
    [token, sessionId, checkoutUrl]
  );
}
// Conditional UPDATE, same shape (and same reason) as claimIcloudCheckAsPaid:
// only the first caller to see downpayment_status='pending' actually claims
// it, so the PayMongo webhook and the confirm-booking page's own fallback
// re-verification can race safely — whichever loses the race gets back no
// rows and does nothing further. Returns the whole booking group, updated.
export async function claimHomeServiceDownpaymentAsPaid(token: string, paymongoPaymentId: string) {
  return (
    await query<RequestRow>(
      `update home_service_requests set downpayment_status='paid', paymongo_payment_id=$2, downpayment_paid_at=now()
       where confirmation_token=$1 and downpayment_status='pending' returning *`,
      [token, paymongoPaymentId]
    )
  ).map(mapRequest);
}
// Every device from the same "+ Add Another Device" submission shares a
// booking_group_id — used to cascade a technician assignment across the
// whole group (one visit, one technician) and to show the admin which
// other requests belong to the same booking.
export async function getRequestsByBookingGroup(groupId: string) {
  return (await query<RequestRow>("select * from home_service_requests where booking_group_id = $1", [groupId])).map(mapRequest);
}
export async function getActivity() {
  return (await query<ActivityRow>("select * from activity_log order by at desc")).map(mapActivity);
}
export async function getLoginLogs() {
  return (await query<LoginLogRow>("select * from login_logs order by at desc")).map(mapLoginLog);
}
export async function getCheckIns() {
  return (await query<CheckInRow>("select * from check_ins order by checked_in_at desc")).map(mapCheckIn);
}
// The signed-in user's own check-in for today, if any — drives whether the
// Check In widget on /technician or /admin shows the button or "already
// checked in" state, without pulling the whole (ever-growing) check_ins
// table just to answer that.
export async function getTodayCheckIn(userId: string) {
  // Asia/Manila, not the database's own timezone — see the matching note
  // on check_ins_user_day_idx in 0060_check_ins.sql.
  const row = await queryOne<CheckInRow>(
    "select * from check_ins where user_id = $1 and (checked_in_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date",
    [userId]
  );
  return row ? mapCheckIn(row) : null;
}
export async function getSales() {
  const [saleRows, lineRows] = await Promise.all([
    query<SaleRow>("select * from sales order by created_at desc"),
    query<SaleLineItemRow>("select * from sale_line_items"),
  ]);
  const linesBySale = new Map<string, SaleLineItem[]>();
  for (const lr of lineRows) {
    const mapped = mapSaleLineItem(lr);
    const list = linesBySale.get(lr.sale_id) ?? [];
    list.push(mapped);
    linesBySale.set(lr.sale_id, list);
  }
  return saleRows.map((r) => mapSale(r, linesBySale.get(r.id) ?? []));
}
export async function getRepairRecords() {
  return (await query<RepairRecordRow>("select * from repair_records where deleted_at is null order by created_at desc")).map(mapRepairRecord);
}
// Trashed repair records — hidden from getRepairRecords() and every
// list/report built on it, but still fetchable here so the Trash page can
// list them and offer Restore / Delete Permanently.
export async function getDeletedRepairRecords() {
  return (await query<RepairRecordRow>("select * from repair_records where deleted_at is not null order by deleted_at desc")).map(mapRepairRecord);
}
export async function getRepairRecordById(id: string) {
  const row = await queryOne<RepairRecordRow>("select * from repair_records where id = $1", [id]);
  return row ? mapRepairRecord(row) : null;
}
// Marks a repair record as awaiting its PayMongo QR Ph checkout — mirrors
// markIcloudCheckPaymentPending/markHomeServiceDownpaymentPending. Amount is
// snapshotted here (not re-read from cost later) so an edit to cost after
// the QR is generated doesn't retroactively change what a pending checkout
// actually charges.
export async function markRepairRecordQrPaymentPending(id: string, sessionId: string, checkoutUrl: string, amountPesos: number) {
  await query(
    "update repair_records set qr_payment_status='pending', qr_payment_amount=$2, paymongo_checkout_session_id=$3, paymongo_checkout_url=$4 where id=$1",
    [id, amountPesos, sessionId, checkoutUrl]
  );
}
// Conditional UPDATE, same shape (and same reason) as
// claimHomeServiceDownpaymentAsPaid: only the first caller to see
// qr_payment_status='pending' actually claims it, so the PayMongo webhook
// and any fallback re-verification can race safely.
export async function claimRepairRecordQrPaymentAsPaid(id: string, paymongoPaymentId: string) {
  const row = await queryOne<RepairRecordRow>(
    "update repair_records set qr_payment_status='paid', paymongo_payment_id=$2, qr_paid_at=now() where id=$1 and qr_payment_status='pending' returning *",
    [id, paymongoPaymentId]
  );
  return row ? mapRepairRecord(row) : null;
}
export async function getSiteContent(): Promise<SiteContent> {
  const row = await queryOne<SiteContentRow>("select * from site_content where id = 1");
  if (!row) throw new Error("site_content row missing — run the seed script");
  return mapSiteContent(row);
}
export async function getRequestFormContent(): Promise<RequestFormContent> {
  const row = await queryOne<RequestFormContentRow>("select * from request_form_content where id = 1");
  if (!row) throw new Error("request_form_content row missing — run the seed script");
  return mapRequestFormContent(row);
}
export async function getCustomFormFields() {
  return (await query<CustomFieldRow>("select * from custom_form_fields order by order_num")).map(mapCustomField);
}
export async function getServiceAgreements() {
  return (await query<ServiceAgreementRow>("select * from service_agreements order by created_at desc")).map(mapServiceAgreement);
}

export const HOME_SERVICE_COMPANY_SHARE = 0.3;
export const HOME_SERVICE_TECHNICIAN_SHARE = 0.7;

export type HomeServiceSalesRow = {
  name: string;
  count: number;
  totalAmount: number;
  partsCost: number;
  netAmount: number;
  companyShare: number;
  technicianShare: number;
  jobs: { deviceLabel: string; amount: number }[];
};

// Shared by Sales > Home Service and the Home Service Requests dashboard
// summary — same "Total Amount = Repair Price + Labor/Service Cost" and
// 30/70 Net Amount split computed in exactly one place, so the two pages
// can never disagree on a figure. `requests` (optional — defaults to none;
// every call site passes getRequests()'s non-deleted list) does two things:
//   1. A completed job whose request isn't in this list — i.e. it's been
//      moved to Trash — is excluded from Sales entirely, and counts again
//      automatically the moment it's restored, since this whole report is
//      recomputed from source data on every load, never stored separately.
//   2. For a request that IS still active, its currently-waived visit fee
//      (if any) is subtracted the same way — see ServiceFeeWaiver.
// `technicians` (optional — defaults to none) resolves each job's raw typed
// name to its configured Settings > Technicians casing via
// canonicalTechnicianName, so a name typed in a different case doesn't split
// one technician into multiple rows; omit only where the caller has no
// technicians list handy and grouping precision doesn't matter.
export function homeServiceSalesByTechnician(
  agreements: ServiceAgreement[],
  inRange: (date: string) => boolean,
  requests: Pick<HomeServiceRequest, "id" | "serviceFeeWaived" | "province" | "city">[] = [],
  technicians: Pick<Technician, "name">[] = []
): HomeServiceSalesRow[] {
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const homeServiceJobs = agreements.filter((a) => a.phase === "post_repair" && a.requestId && inRange(a.completedAt.slice(0, 10)));

  type TechTotals = { name: string; count: number; totalAmount: number; partsCost: number; jobs: { deviceLabel: string; amount: number }[] };
  const totals = new Map<string, TechTotals>();
  const ensure = (rawName: string) => {
    const name = canonicalTechnicianName(rawName, technicians) || "Unassigned";
    if (!totals.has(name)) totals.set(name, { name, count: 0, totalAmount: 0, partsCost: 0, jobs: [] });
    return totals.get(name)!;
  };

  for (const a of homeServiceJobs) {
    const request = a.requestId ? requestById.get(a.requestId) : undefined;
    if (a.requestId && !request) continue; // request moved to Trash — excluded from Sales until restored
    const bucket = ensure(a.technicianName);
    const waivedFee = request?.serviceFeeWaived ? serviceFeeAmount(request.province, request.city) ?? 0 : 0;
    const amount = Math.max(0, a.cost + a.laborCost - waivedFee);
    bucket.count += 1;
    bucket.totalAmount += amount;
    bucket.partsCost += a.partsCost;
    bucket.jobs.push({ deviceLabel: a.deviceLabel || "Device not specified", amount });
  }

  return Array.from(totals.values())
    .map((t) => {
      const netAmount = Math.max(0, t.totalAmount - t.partsCost);
      return { ...t, netAmount, companyShare: netAmount * HOME_SERVICE_COMPANY_SHARE, technicianShare: netAmount * HOME_SERVICE_TECHNICIAN_SHARE };
    })
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.totalAmount - a.totalAmount;
    });
}

export function sumHomeServiceSales(rows: HomeServiceSalesRow[]) {
  return rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      totalAmount: acc.totalAmount + r.totalAmount,
      partsCost: acc.partsCost + r.partsCost,
      netAmount: acc.netAmount + r.netAmount,
      companyShare: acc.companyShare + r.companyShare,
      technicianShare: acc.technicianShare + r.technicianShare,
    }),
    { count: 0, totalAmount: 0, partsCost: 0, netAmount: 0, companyShare: 0, technicianShare: 0 }
  );
}

// "Owner's Final Total Sales" expenses (Sales > Expenses) explicitly tied to
// one of the backend Home Service queue branches — the same deduction a
// real branch's own "Owner's Final Total Sales" expenses already get on
// Branch Sales (Business Expenses -> Business Share (Net)), just scoped to
// Home Service instead. Previously nothing subtracted these anywhere, so
// picking "Home Service" as the branch when logging an expense silently had
// no effect on Home Service's own figures. Left-unassigned expenses (no
// branch picked) are deliberately excluded — those already count once
// toward the combined POS grand total elsewhere, and there's no way to
// split "meant for everyone" between the two pools without double-deducting
// the same peso from both.
export function homeServiceBusinessExpenses(
  expenses: Pick<Expense, "target" | "branchId" | "amount" | "expenseDate">[],
  inRange: (date: string) => boolean,
  homeServiceQueueBranchIds: string[]
): number {
  return expenses
    .filter((e) => e.target === "owner_final_total_sales" && inRange(e.expenseDate) && e.branchId !== null && homeServiceQueueBranchIds.includes(e.branchId))
    .reduce((s, e) => s + e.amount, 0);
}
export async function getRepairProgressByRequestId(requestId: string): Promise<RepairProgress | null> {
  const row = await queryOne<RepairProgressRow>("select * from repair_progress where request_id = $1", [requestId]);
  return row ? mapRepairProgress(row) : null;
}
export async function getNotifications() {
  return (await query<NotificationRow>("select * from notifications order by created_at desc")).map(mapNotification);
}
export async function getExpenses() {
  return (await query<ExpenseRow>("select * from expenses order by expense_date desc, created_at desc")).map(mapExpense);
}

type CrmBroadcastRow = {
  id: string;
  subject: string;
  message: string;
  photos: string[];
  scheduled_at: Date | null;
  status: CrmBroadcastStatus;
  recipient_estimate: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: Date;
  sent_at: Date | null;
};
function mapCrmBroadcast(r: CrmBroadcastRow): CrmBroadcast {
  return {
    id: r.id,
    subject: r.subject,
    message: r.message,
    photos: r.photos ?? [],
    scheduledAt: toIsoOrNull(r.scheduled_at),
    status: r.status,
    recipientEstimate: r.recipient_estimate,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    createdBy: r.created_by,
    createdAt: toIso(r.created_at),
    sentAt: toIsoOrNull(r.sent_at),
  };
}

export async function getCrmBroadcasts() {
  return (await query<CrmBroadcastRow>("select * from crm_broadcasts order by created_at desc limit 50")).map(mapCrmBroadcast);
}

// Polled by the send-scheduled-broadcasts cron — every "pending" broadcast
// whose scheduled_at has already passed.
export async function getDueCrmBroadcasts() {
  return (
    await query<CrmBroadcastRow>("select * from crm_broadcasts where status = 'pending' and scheduled_at <= now() order by scheduled_at asc")
  ).map(mapCrmBroadcast);
}

// Every distinct email across leads and customers — the audience for CRM >
// Send Announcement. Shared by the immediate-send action and the
// send-scheduled-broadcasts cron, so a scheduled broadcast reaches whoever
// is actually in the CRM at send time, not a stale snapshot from when it
// was queued.
export async function getCrmBroadcastRecipients(): Promise<string[]> {
  const [leads, customers] = await Promise.all([
    query<{ email: string }>("select email from leads where email <> ''"),
    query<{ email: string }>("select email from customers where email <> ''"),
  ]);
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const r of [...leads, ...customers]) {
    const key = r.email.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recipients.push(r.email);
  }
  return recipients;
}

export async function createCrmBroadcast(input: {
  subject: string;
  message: string;
  photos: string[];
  scheduledAt: Date | null;
  status: CrmBroadcastStatus;
  recipientEstimate: number;
  sentCount: number;
  failedCount: number;
  createdBy: string;
  sentAt: Date | null;
}) {
  const row = await queryOne<CrmBroadcastRow>(
    `insert into crm_broadcasts (subject, message, photos, scheduled_at, status, recipient_estimate, sent_count, failed_count, created_by, sent_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.subject,
      input.message,
      JSON.stringify(input.photos),
      input.scheduledAt,
      input.status,
      input.recipientEstimate,
      input.sentCount,
      input.failedCount,
      input.createdBy,
      input.sentAt,
    ]
  );
  return row ? mapCrmBroadcast(row) : null;
}

// Marks a scheduled broadcast as sent/failed once the cron has actually
// delivered it — the only writer of these columns after the row is queued.
export async function markCrmBroadcastSent(id: string, status: "sent" | "failed", sentCount: number, failedCount: number) {
  await query("update crm_broadcasts set status=$1, sent_count=$2, failed_count=$3, sent_at=now() where id=$4", [status, sentCount, failedCount, id]);
}

// Only a still-pending (not yet sent) scheduled broadcast can be cancelled.
export async function cancelCrmBroadcast(id: string) {
  await query("update crm_broadcasts set status='cancelled' where id=$1 and status='pending'", [id]);
}

// ---------- Public paid iCloud ON/OFF checker ----------
// See lib/types.ts's IcloudCheck doc comment for the full status state
// machine. claimIcloudCheckAsPaid below is the one function every caller
// MUST go through before ever calling the SICKW API — see its own comment.

type IcloudCheckRow = {
  id: string;
  imei: string;
  status: IcloudCheckStatus;
  amount: string;
  paymongo_checkout_session_id: string | null;
  paymongo_payment_id: string | null;
  paymongo_checkout_url: string | null;
  paid_at: Date | null;
  sickw_raw_response: unknown | null;
  icloud_status: IcloudCheck["icloudStatus"];
  result_summary: string | null;
  failure_reason: string | null;
  sickw_attempt_count: number;
  admin_note: string | null;
  checked_at: Date | null;
  customer_ip: string | null;
  created_at: Date;
  updated_at: Date;
};
function mapIcloudCheck(r: IcloudCheckRow): IcloudCheck {
  return {
    id: r.id,
    imei: r.imei,
    status: r.status,
    amount: Number(r.amount),
    paymongoCheckoutSessionId: r.paymongo_checkout_session_id,
    paymongoPaymentId: r.paymongo_payment_id,
    paymongoCheckoutUrl: r.paymongo_checkout_url,
    paidAt: toIsoOrNull(r.paid_at),
    sickwRawResponse: r.sickw_raw_response,
    icloudStatus: r.icloud_status,
    resultSummary: r.result_summary,
    failureReason: r.failure_reason,
    sickwAttemptCount: r.sickw_attempt_count,
    adminNote: r.admin_note,
    checkedAt: toIsoOrNull(r.checked_at),
    customerIp: r.customer_ip,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export async function getIcloudCheckById(id: string) {
  const row = await queryOne<IcloudCheckRow>("select * from icloud_checks where id = $1", [id]);
  return row ? mapIcloudCheck(row) : null;
}

// Admin > Tools > iCloud Status Checks list — every attempt, newest first.
export async function getIcloudChecksForAdmin() {
  return (await query<IcloudCheckRow>("select * from icloud_checks order by created_at desc limit 200")).map(mapIcloudCheck);
}

export async function createIcloudCheck(imei: string, customerIp: string | null) {
  const row = await queryOne<IcloudCheckRow>(
    "insert into icloud_checks (imei, customer_ip) values ($1,$2) returning *",
    [imei, customerIp]
  );
  return row ? mapIcloudCheck(row) : null;
}

export async function markIcloudCheckPaymentPending(id: string, sessionId: string, checkoutUrl: string) {
  await query(
    "update icloud_checks set status='payment_pending', paymongo_checkout_session_id=$2, paymongo_checkout_url=$3, updated_at=now() where id=$1",
    [id, sessionId, checkoutUrl]
  );
}

// The idempotency choke point for the whole feature. Only succeeds (and
// returns the updated row) the FIRST time it's called for a given check —
// a conditional UPDATE that only matches a row still sitting in
// 'payment_pending'. Returns null on every call after the first, which is
// the signal callers (the webhook route and the result page's fallback
// re-verification) must treat as "someone already claimed this — do NOT
// call the SICKW API again." This is what keeps a redelivered PayMongo
// webhook, or a customer refreshing the result page, from spending a
// second SICKW credit on the same payment.
export async function claimIcloudCheckAsPaid(id: string, paymongoPaymentId: string) {
  const row = await queryOne<IcloudCheckRow>(
    "update icloud_checks set status='paid', paid_at=now(), paymongo_payment_id=$2, updated_at=now() where id=$1 and status='payment_pending' returning *",
    [id, paymongoPaymentId]
  );
  return row ? mapIcloudCheck(row) : null;
}

export async function markIcloudCheckChecked(id: string, icloudStatus: IcloudCheck["icloudStatus"], summary: string, rawResponse: unknown) {
  await query(
    "update icloud_checks set status='checked', icloud_status=$2, result_summary=$3, sickw_raw_response=$4, sickw_attempt_count=sickw_attempt_count+1, checked_at=now(), updated_at=now() where id=$1",
    [id, icloudStatus, summary, JSON.stringify(rawResponse)]
  );
}

export async function markIcloudCheckFailed(id: string, reason: string, rawResponse: unknown) {
  await query(
    "update icloud_checks set status='check_failed', failure_reason=$2, sickw_raw_response=$3, sickw_attempt_count=sickw_attempt_count+1, updated_at=now() where id=$1",
    [id, reason, rawResponse === null ? null : JSON.stringify(rawResponse)]
  );
}

// Admin > Tools > iCloud Status Checks — bookkeeping only; the actual
// refund still happens by hand in the PayMongo dashboard.
export async function markIcloudCheckRefundNeeded(id: string, adminNote: string) {
  await query(
    "update icloud_checks set status='refund_needed', admin_note=$2, updated_at=now() where id=$1 and status='check_failed'",
    [id, adminNote]
  );
}

export async function getUserById(id: string) {
  const row = await queryOne<UserRow>("select * from users where id = $1", [id]);
  return row ? mapUser(row) : null;
}
export async function getUserByEmail(email: string) {
  const row = await queryOne<UserRow>("select * from users where lower(email) = lower($1)", [email]);
  return row ? mapUser(row) : null;
}

// Auth-only lookup — the only place the password hash leaves this module.
export async function getUserAuthByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const row = await queryOne<UserRow>("select * from users where lower(email) = lower($1)", [email]);
  return row ? { ...mapUser(row), passwordHash: row.password_hash } : null;
}

export async function logActivity(entityType: ActivityLog["entityType"], entityId: string, message: string, actor: string) {
  await query("insert into activity_log (entity_type, entity_id, message, actor) values ($1,$2,$3,$4)", [entityType, entityId, message, actor]);
}

type ConversationRow = {
  id: string; entity_type: ConversationMessage["entityType"]; entity_id: string; channel: ConversationMessage["channel"];
  direction: ConversationMessage["direction"]; message: string; staff_name: string; created_at: Date;
};
function mapConversationMessage(r: ConversationRow): ConversationMessage {
  return {
    id: r.id, entityType: r.entity_type, entityId: r.entity_id, channel: r.channel, direction: r.direction,
    message: r.message, staffName: r.staff_name, createdAt: toIso(r.created_at),
  };
}
export async function getConversation(entityType: ConversationMessage["entityType"], entityId: string) {
  return (
    await query<ConversationRow>("select * from conversations where entity_type=$1 and entity_id=$2 order by created_at asc", [entityType, entityId])
  ).map(mapConversationMessage);
}

export async function getPushSubscriptions() {
  return (await query<PushSubscriptionRow>("select * from push_subscriptions")).map(mapPushSubscription);
}

// Shared by notifyAdmins/notifyAdminsAboutWalkIn — writes the in-app
// notification row (the caller already built the right INSERT for whichever
// target column it points at) and best-effort fans it out to web push + SMS.
// Neither channel is guaranteed configured/subscribed, so failures there are
// swallowed rather than failing the request/checklist/lead/walk-in action
// that triggered this.
async function notifyAdminsCore(insertSql: string, insertParams: unknown[], url: string, message: string) {
  await query(insertSql, insertParams);

  try {
    const admins = (await getUsers()).filter((u) => u.active && (u.role === "owner_admin" || u.role === "branch_admin"));

    const subs = await getPushSubscriptions();
    const adminIds = new Set(admins.map((a) => a.id));
    const recipientSubs = subs.filter((s) => adminIds.has(s.userId));
    if (recipientSubs.length > 0) {
      // Included on every push so the home-screen icon badge updates from
      // the service worker even while the app is closed — same unread
      // count getNotifications()'s caller already shows in the sidebar.
      const unread = await queryOne<{ n: number }>("select count(*)::int as n from notifications where read_at is null");
      const { expiredEndpoints } = await sendPushToUsers(recipientSubs, { title: "Ceejay Admin", body: message, url, badgeCount: unread?.n ?? undefined });
      if (expiredEndpoints.length > 0) {
        await query("delete from push_subscriptions where endpoint = any($1)", [expiredEndpoints]);
      }
    }

    if (smsConfigured()) {
      const phones = admins.map((a) => a.phone.trim()).filter(Boolean);
      await Promise.allSettled(phones.map((phone) => sendSms(phone, message)));
    }
  } catch {
    // Push/SMS are best-effort alerts layered on top of the in-app
    // notification above, which already succeeded — never let a delivery
    // failure here surface as a failure of the action that called this.
  }
}

export async function notifyAdmins(type: Notification["type"], requestId: string, message: string) {
  await notifyAdminsCore(
    "insert into notifications (type, request_id, message) values ($1,$2,$3)",
    [type, requestId, message],
    `/admin/requests/${requestId}`,
    message
  );
}

// Same delivery mechanics as notifyAdmins, pointed at a walkin_requests row
// instead of a home_service_requests one — Walk-In Registrations gets its
// own notification type/link so it shows up on /admin/notifications and the
// PWA push the same way a new Home Service Request already does.
export async function notifyAdminsAboutWalkIn(walkinRequestId: string, message: string) {
  await notifyAdminsCore(
    "insert into notifications (type, walkin_request_id, message) values ('new_walkin',$1,$2)",
    [walkinRequestId, message],
    `/admin/walk-ins/${walkinRequestId}`,
    message
  );
}

// How many jobs are assigned to this technician but not yet started —
// status "Assigned", not yet moved to En Route/In Progress. Drives the
// Technician app's home-screen icon badge (both the on-open sync in
// app/technician/layout.tsx and the push-time update in notifyTechnician
// below), so a technician sees at a glance how many new jobs are waiting
// on them without opening the app.
export async function getUnstartedJobCount(technicianId: string) {
  const row = await queryOne<{ n: number }>(
    `select count(*)::int as n
     from home_service_requests r
     join lookups l on l.id = r.status_id
     where r.assigned_technician_id = $1 and l.label = 'Assigned' and r.deleted_at is null`,
    [technicianId]
  );
  return row?.n ?? 0;
}

// Web push to one technician's own device(s) — e.g. a new job assignment.
// A technician's login is a `users` row with technician_id set to their
// technicians.id, so push_subscriptions (keyed by users.id) has to go
// through that lookup rather than the technicians.id the caller has.
// Best-effort like notifyAdmins: never lets a delivery failure surface as
// a failure of the action that triggered it.
export async function notifyTechnician(technicianId: string, message: string, url: string) {
  try {
    const techUser = await queryOne<{ id: string }>("select id from users where technician_id = $1 and active", [technicianId]);
    if (!techUser) return;

    const subs = (await getPushSubscriptions()).filter((s) => s.userId === techUser.id);
    if (subs.length === 0) return;

    // Badge count = jobs assigned to this technician that they haven't
    // started yet ("Assigned" status, not yet moved to En Route/In
    // Progress) — the same "new job" count the technician layout badges
    // with on open, kept in sync here so it also updates while the app is
    // closed. See getUnstartedJobCount below.
    const badgeCount = await getUnstartedJobCount(technicianId);
    const { expiredEndpoints } = await sendPushToUsers(subs, { title: "Ceejay", body: message, url, badgeCount });
    if (expiredEndpoints.length > 0) {
      await query("delete from push_subscriptions where endpoint = any($1)", [expiredEndpoints]);
    }
  } catch {
    // Best-effort — see notifyAdmins above.
  }
}
