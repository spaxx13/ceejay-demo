import "server-only";
import { Pool, type QueryResultRow } from "pg";
import type {
  User,
  Branch,
  Zone,
  Technician,
  Customer,
  LookupItem,
  DeviceModel,
  Lead,
  HomeServiceRequest,
  ActivityLog,
  InventoryItem,
  StockMovement,
  Sale,
  SaleLineItem,
  SiteContent,
  RequestFormContent,
  CustomFormField,
  ServiceAgreement,
  Notification,
  Expense,
} from "./types";

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

type UserRow = { id: string; name: string; email: string; password_hash: string; role: User["role"]; technician_id: string | null; active: boolean };
function mapUser(r: UserRow): User {
  return { id: r.id, name: r.name, email: r.email, role: r.role, technicianId: r.technician_id, active: r.active };
}

type BranchRow = { id: string; name: string; address: string; contact_number: string; active: boolean };
function mapBranch(r: BranchRow): Branch {
  return { id: r.id, name: r.name, address: r.address, contactNumber: r.contact_number, active: r.active };
}

type ZoneRow = { id: string; name: string; city: string; province: string; notes: string; active: boolean; round_robin_cursor: number };
function mapZone(r: ZoneRow): Zone {
  return { id: r.id, name: r.name, city: r.city, province: r.province, notes: r.notes, active: r.active, roundRobinCursor: r.round_robin_cursor };
}

type TechnicianRow = { id: string; name: string; contact_number: string; email: string; employment_status: Technician["employmentStatus"]; branch_ids: string[]; zone_ids: string[]; active: boolean };
function mapTechnician(r: TechnicianRow): Technician {
  return { id: r.id, name: r.name, contactNumber: r.contact_number, email: r.email, employmentStatus: r.employment_status, branchIds: r.branch_ids ?? [], zoneIds: r.zone_ids ?? [], active: r.active };
}

type CustomerRow = { id: string; name: string; phone: string; email: string; street: string; zone_id: string | null; province: string; landmark: string; source: string; notes: string; created_at: Date };
function mapCustomer(r: CustomerRow): Customer {
  return { id: r.id, name: r.name, phone: r.phone, email: r.email, street: r.street, zoneId: r.zone_id, province: r.province, landmark: r.landmark, source: r.source, notes: r.notes, createdAt: toIso(r.created_at) };
}

type LookupRow = { id: string; kind: LookupItem["kind"]; label: string; order_num: number; active: boolean };
function mapLookup(r: LookupRow): LookupItem {
  return { id: r.id, kind: r.kind, label: r.label, order: r.order_num, active: r.active };
}

type DeviceModelRow = { id: string; brand_id: string; name: string; active: boolean };
function mapDeviceModel(r: DeviceModelRow): DeviceModel {
  return { id: r.id, brandId: r.brand_id, name: r.name, active: r.active };
}

type LeadRow = { id: string; customer_id: string | null; name: string; phone: string; email: string; source: string; status_id: string; assigned_to: string | null; follow_up_date: Date | string | null; notes: string; created_at: Date };
function mapLead(r: LeadRow): Lead {
  return { id: r.id, customerId: r.customer_id, name: r.name, phone: r.phone, email: r.email, source: r.source, statusId: r.status_id, assignedTo: r.assigned_to, followUpDate: r.follow_up_date ? toDateStr(r.follow_up_date) : null, notes: r.notes, createdAt: toIso(r.created_at) };
}

type RequestRow = {
  id: string; reference: string; customer_id: string | null; customer_name: string; phone: string; email: string;
  device_brand_id: string | null; device_model_id: string | null; device_other: string; service_type_id: string;
  issue_description: string; photo_data_url: string | null; street: string; landmark: string; province: string; city: string;
  lat: number | null; lng: number | null; zone_id: string | null; unzoned: boolean; preferred_datetime: Date | string | null;
  status_id: string; assigned_technician_id: string | null; auto_assigned: boolean; branch_id: string | null; admin_notes: string;
  status_history: { statusId: string; at: string }[]; custom_fields: Record<string, string | boolean>; created_at: Date;
};
function mapRequest(r: RequestRow): HomeServiceRequest {
  return {
    id: r.id, reference: r.reference, customerId: r.customer_id, customerName: r.customer_name, phone: r.phone, email: r.email,
    deviceBrandId: r.device_brand_id, deviceModelId: r.device_model_id, deviceOther: r.device_other, serviceTypeId: r.service_type_id,
    issueDescription: r.issue_description, photoDataUrl: r.photo_data_url, street: r.street, landmark: r.landmark, province: r.province, city: r.city,
    lat: r.lat, lng: r.lng, zoneId: r.zone_id, unzoned: r.unzoned, preferredDatetime: toDateStr(r.preferred_datetime),
    statusId: r.status_id, assignedTechnicianId: r.assigned_technician_id, autoAssigned: r.auto_assigned, branchId: r.branch_id, adminNotes: r.admin_notes,
    createdAt: toIso(r.created_at), statusHistory: r.status_history ?? [], customFields: r.custom_fields ?? {},
  };
}

type ActivityRow = { id: string; entity_type: ActivityLog["entityType"]; entity_id: string; message: string; actor: string; at: Date };
function mapActivity(r: ActivityRow): ActivityLog {
  return { id: r.id, entityType: r.entity_type, entityId: r.entity_id, message: r.message, actor: r.actor, at: toIso(r.at) };
}

type InventoryRow = { id: string; sku: string; name: string; category_id: string | null; branch_id: string; quantity_on_hand: number; reorder_level: number; unit_cost: string; unit_price: string; active: boolean };
function mapInventory(r: InventoryRow): InventoryItem {
  return { id: r.id, sku: r.sku, name: r.name, categoryId: r.category_id ?? "", branchId: r.branch_id, quantityOnHand: r.quantity_on_hand, reorderLevel: r.reorder_level, unitCost: Number(r.unit_cost), unitPrice: Number(r.unit_price), active: r.active };
}

type StockMovementRow = { id: string; item_id: string; branch_id: string; type: StockMovement["type"]; quantity: number; reason: string; reference_sale_id: string | null; actor: string; at: Date };
function mapStockMovement(r: StockMovementRow): StockMovement {
  return { id: r.id, itemId: r.item_id, branchId: r.branch_id, type: r.type, quantity: r.quantity, reason: r.reason, referenceSaleId: r.reference_sale_id, actor: r.actor, at: toIso(r.at) };
}

type SaleRow = { id: string; reference: string; branch_id: string; customer_id: string | null; customer_name: string; customer_phone: string; home_service_request_id: string | null; discount: string; subtotal: string; total: string; payment_method: Sale["paymentMethod"]; cashier_name: string; created_at: Date };
function mapSale(r: SaleRow, lineItems: SaleLineItem[]): Sale {
  return { id: r.id, reference: r.reference, branchId: r.branch_id, customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone, homeServiceRequestId: r.home_service_request_id, lineItems, discount: Number(r.discount), subtotal: Number(r.subtotal), total: Number(r.total), paymentMethod: r.payment_method, cashierName: r.cashier_name, createdAt: toIso(r.created_at) };
}

type SaleLineItemRow = { id: string; sale_id: string; kind: SaleLineItem["kind"]; item_id: string | null; description: string; quantity: string; unit_price: string };
function mapSaleLineItem(r: SaleLineItemRow): SaleLineItem {
  return { id: r.id, kind: r.kind, itemId: r.item_id, description: r.description, quantity: Number(r.quantity), unitPrice: Number(r.unit_price) };
}

type SiteContentRow = {
  hero_kicker: string; hero_headline_prefix: string; hero_headline_highlight: string; hero_headline_suffix: string; hero_subtext: string;
  primary_cta_label: string; secondary_cta_label: string; cta_banner_title: string; cta_banner_subtitle: string; cta_banner_button_label: string;
};
function mapSiteContent(r: SiteContentRow): SiteContent {
  return {
    heroKicker: r.hero_kicker, heroHeadlinePrefix: r.hero_headline_prefix, heroHeadlineHighlight: r.hero_headline_highlight, heroHeadlineSuffix: r.hero_headline_suffix,
    heroSubtext: r.hero_subtext, primaryCtaLabel: r.primary_cta_label, secondaryCtaLabel: r.secondary_cta_label,
    ctaBannerTitle: r.cta_banner_title, ctaBannerSubtitle: r.cta_banner_subtitle, ctaBannerButtonLabel: r.cta_banner_button_label,
  };
}

type RequestFormContentRow = { page_kicker: string; page_title: string; page_subtitle: string; submit_button_label: string; success_title: string; success_body: string };
function mapRequestFormContent(r: RequestFormContentRow): RequestFormContent {
  return { pageKicker: r.page_kicker, pageTitle: r.page_title, pageSubtitle: r.page_subtitle, submitButtonLabel: r.submit_button_label, successTitle: r.success_title, successBody: r.success_body };
}

type CustomFieldRow = { id: string; key: string; system_key: CustomFormField["systemKey"]; label: string; placeholder: string; type: CustomFormField["type"]; required: boolean; options: string[]; order_num: number; active: boolean };
function mapCustomField(r: CustomFieldRow): CustomFormField {
  return { id: r.id, key: r.key, systemKey: r.system_key, label: r.label, placeholder: r.placeholder, type: r.type, required: r.required, options: r.options ?? [], order: r.order_num, active: r.active };
}

type ServiceAgreementRow = {
  id: string; request_id: string; phase: ServiceAgreement["phase"]; reference: string; customer_name: string; device_label: string;
  branch_id: string | null; technician_id: string | null; technician_name: string; items: ServiceAgreement["items"]; summary_notes: string;
  agreed_to_terms: boolean; customer_signature_data_url: string | null; technician_signature_data_url: string | null; receipt_photo_data_url: string | null;
  completed_at: Date; sent_to_customer_at: Date | null; created_at: Date;
};
function mapServiceAgreement(r: ServiceAgreementRow): ServiceAgreement {
  return {
    id: r.id, requestId: r.request_id, phase: r.phase, reference: r.reference, customerName: r.customer_name, deviceLabel: r.device_label,
    branchId: r.branch_id, technicianId: r.technician_id, technicianName: r.technician_name, items: r.items ?? [], summaryNotes: r.summary_notes,
    agreedToTerms: r.agreed_to_terms, customerSignatureDataUrl: r.customer_signature_data_url, technicianSignatureDataUrl: r.technician_signature_data_url,
    receiptPhotoDataUrl: r.receipt_photo_data_url, completedAt: toIso(r.completed_at), sentToCustomerAt: toIsoOrNull(r.sent_to_customer_at), createdAt: toIso(r.created_at),
  };
}

type NotificationRow = { id: string; type: Notification["type"]; request_id: string; message: string; created_at: Date; read_at: Date | null };
function mapNotification(r: NotificationRow): Notification {
  return { id: r.id, type: r.type, requestId: r.request_id, message: r.message, createdAt: toIso(r.created_at), readAt: toIsoOrNull(r.read_at) };
}

type ExpenseRow = { id: string; expense_date: Date | string; branch_id: string | null; category_id: string | null; amount: string; description: string; recorded_by: string; created_at: Date };
function mapExpense(r: ExpenseRow): Expense {
  return {
    id: r.id, date: toDateStr(r.expense_date), branchId: r.branch_id, categoryId: r.category_id,
    amount: Number(r.amount), description: r.description, recordedBy: r.recorded_by, createdAt: toIso(r.created_at),
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
export async function getZones() {
  return (await query<ZoneRow>("select * from zones order by name")).map(mapZone);
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
  return (await query<DeviceModelRow>("select * from device_models order by name")).map(mapDeviceModel);
}
export async function getLeads() {
  return (await query<LeadRow>("select * from leads order by created_at desc")).map(mapLead);
}
export async function getLeadById(id: string) {
  const row = await queryOne<LeadRow>("select * from leads where id = $1", [id]);
  return row ? mapLead(row) : null;
}
export async function getRequests() {
  return (await query<RequestRow>("select * from home_service_requests order by created_at desc")).map(mapRequest);
}
export async function getRequestById(id: string) {
  const row = await queryOne<RequestRow>("select * from home_service_requests where id = $1", [id]);
  return row ? mapRequest(row) : null;
}
export async function getActivity() {
  return (await query<ActivityRow>("select * from activity_log order by at desc")).map(mapActivity);
}
export async function getInventory() {
  return (await query<InventoryRow>("select * from inventory_items order by name")).map(mapInventory);
}
export async function getStockMovements() {
  return (await query<StockMovementRow>("select * from stock_movements order by at desc")).map(mapStockMovement);
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
export async function getNotifications() {
  return (await query<NotificationRow>("select * from notifications order by created_at desc")).map(mapNotification);
}
export async function getExpenses() {
  return (await query<ExpenseRow>("select * from expenses order by expense_date desc, created_at desc")).map(mapExpense);
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

export async function notifyAdmins(type: Notification["type"], requestId: string, message: string) {
  await query("insert into notifications (type, request_id, message) values ($1,$2,$3)", [type, requestId, message]);
}
