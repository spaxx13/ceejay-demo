"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { OTP_GATE_ENABLED, MAX_PRICE_EDITS } from "@/lib/config";
import { CHECKLIST_TEMPLATE } from "./checklist";
import {
  query,
  queryOne,
  getUserAuthByEmail,
  getUsers,
  getTechnicians,
  getBranches,
  getLookups,
  getCustomers,
  getRequests,
  getRequestById,
  getRepairRecordById,
  getServiceAgreements,
  getRepairRecordStatus,
  getCustomFormFields,
  logActivity,
  notifyAdmins,
  canManageHomeServiceRequests,
  canDeleteHomeServiceRequests,
} from "./db";
import { getCurrentUser, setSession, clearSession, requireRole } from "./auth";
import { sendOtpEmail, sendRepairReceiptEmail, sendCancellationEmail } from "./email";
import { sendSms, smsConfigured } from "./sms";
import type {
  Role,
  LookupKind,
  CustomFieldType,
  ChecklistItem,
  ChecklistResult,
  ChecklistPhase,
  Expense,
} from "./types";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
function listStr(fd: FormData, key: string) {
  return fd.getAll(key).map(String).filter(Boolean);
}
function isValidPhone(phone: string) {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(\+63|0)9\d{9}$/.test(cleaned);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Auth ----------

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const user = await getUserAuthByEmail(email);
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await setSession(user.id);
  await query("insert into login_logs (user_id, user_name, user_email, role) values ($1,$2,$3,$4)", [user.id, user.name, user.email, user.role]);
  redirect(user.role === "technician" ? "/technician" : "/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

// ---------- Staff Accounts ----------

export async function createUser(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const role = str(formData, "role") as Role;
  let technicianId = str(formData, "technicianId") || null;
  const assignedBranchIds = role === "branch_admin" ? formData.getAll("assignedBranchIds").map(String) : [];
  const canManageRequests = role === "branch_admin" ? formData.get("canManageRequests") === "on" : true;
  const canDeleteRequests = role === "branch_admin" ? formData.get("canDeleteRequests") === "on" : true;
  const canViewAllBranches = role === "branch_admin" ? formData.get("canViewAllBranches") === "on" : true;
  if (!name || !email || !password || !role) return;

  const existing = await getUserAuthByEmail(email);
  if (existing) return;

  // No existing Technician record picked — create one now with the chosen
  // branch(es) and link it, instead of requiring a separate trip to
  // Settings > Technicians before this account can be created.
  if (role === "technician" && !technicianId) {
    const technicianBranchIds = listStr(formData, "technicianBranchIds");
    if (technicianBranchIds.length > 0) {
      const created = await queryOne<{ id: string }>(
        "insert into technicians (name, contact_number, email, employment_status, branch_ids) values ($1,'',$2,'full_time',$3) returning id",
        [name, email, technicianBranchIds]
      );
      technicianId = created!.id;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    "insert into users (name, email, password_hash, role, technician_id, assigned_branch_ids, can_manage_requests, can_delete_requests, can_view_all_branches) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [name, email, passwordHash, role, role === "technician" ? technicianId : null, assignedBranchIds, canManageRequests, canDeleteRequests, canViewAllBranches]
  );
  revalidatePath("/admin/users");
  revalidatePath("/admin/technicians");
}

export async function updateUser(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  const users = await getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  const email = str(formData, "email").toLowerCase();
  if (email) {
    const existing = await getUserAuthByEmail(email);
    if (existing && existing.id !== userId) return;
  }

  const name = str(formData, "name") || user.name;
  const role = (str(formData, "role") || user.role) as Role;
  let technicianId = str(formData, "technicianId") || null;
  const password = str(formData, "password");
  const assignedBranchIds = role === "branch_admin" ? formData.getAll("assignedBranchIds").map(String) : [];
  const canManageRequests = role === "branch_admin" ? formData.get("canManageRequests") === "on" : true;
  const canDeleteRequests = role === "branch_admin" ? formData.get("canDeleteRequests") === "on" : true;
  const canViewAllBranches = role === "branch_admin" ? formData.get("canViewAllBranches") === "on" : true;

  if (role === "technician") {
    const technicianBranchIds = listStr(formData, "technicianBranchIds");
    const linkingExisting = str(formData, "technicianLinkMode") === "existing";
    if (!technicianId) {
      // No linked Technician record yet — create one now with the chosen
      // branch(es) and link it.
      if (technicianBranchIds.length > 0) {
        const created = await queryOne<{ id: string }>(
          "insert into technicians (name, contact_number, email, employment_status, branch_ids) values ($1,'',$2,'full_time',$3) returning id",
          [name, email || user.email, technicianBranchIds]
        );
        technicianId = created!.id;
      }
    } else if (!linkingExisting) {
      // Already linked, and this form is in "new/edit branches" mode —
      // update that Technician record's branches in place rather than
      // spawning a new one on every edit. When instead linking to an
      // *existing* technician picked from the list, its branches are
      // managed from Settings > Technicians and must not be touched here.
      await query("update technicians set branch_ids=$1 where id=$2", [technicianBranchIds, technicianId]);
    }
  }

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      "update users set name=$1, email=$2, password_hash=$3, role=$4, technician_id=$5, assigned_branch_ids=$6, can_manage_requests=$7, can_delete_requests=$8, can_view_all_branches=$9 where id=$10",
      [
        name,
        email || user.email,
        passwordHash,
        role,
        role === "technician" ? technicianId : null,
        assignedBranchIds,
        canManageRequests,
        canDeleteRequests,
        canViewAllBranches,
        userId,
      ]
    );
  } else {
    await query(
      "update users set name=$1, email=$2, role=$3, technician_id=$4, assigned_branch_ids=$5, can_manage_requests=$6, can_delete_requests=$7, can_view_all_branches=$8 where id=$9",
      [
        name,
        email || user.email,
        role,
        role === "technician" ? technicianId : null,
        assignedBranchIds,
        canManageRequests,
        canDeleteRequests,
        canViewAllBranches,
        userId,
      ]
    );
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/technicians");
}

export async function toggleUserActive(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  if (userId === actor.id) return; // can't lock yourself out
  await query("update users set active = not active where id=$1", [userId]);
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  if (userId === actor.id) return; // can't delete yourself

  const users = await getUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return;
  // Never allow deleting the last active Owner Admin — that would lock
  // everyone out of Settings and user management entirely.
  if (target.role === "owner_admin" && users.filter((u) => u.role === "owner_admin" && u.active).length <= 1) return;

  await query("delete from users where id=$1", [userId]);
  revalidatePath("/admin/users");
}

// ---------- Branches ----------

export async function createBranch(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  await query("insert into branches (name, address, contact_number) values ($1,$2,$3)", [
    name,
    str(formData, "address"),
    str(formData, "contactNumber"),
  ]);
  revalidatePath("/admin/branches");
}

export async function updateBranch(formData: FormData) {
  const branchId = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return;
  await query("update branches set name=$1, address=$2, contact_number=$3 where id=$4", [
    name,
    str(formData, "address"),
    str(formData, "contactNumber"),
    branchId,
  ]);
  revalidatePath("/admin/branches");
}

export async function toggleBranchActive(formData: FormData) {
  const branchId = str(formData, "id");
  await query("update branches set active = not active where id=$1", [branchId]);
  revalidatePath("/admin/branches");
}

// ---------- Technicians ----------

function earningsSharePercentFromForm(formData: FormData) {
  const raw = str(formData, "earningsSharePercent");
  return raw ? Math.min(100, Math.max(0, Number(raw) || 50)) : 50;
}

export async function createTechnician(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  await query(
    "insert into technicians (name, contact_number, email, employment_status, branch_ids, earnings_share_percent) values ($1,$2,$3,$4,$5,$6)",
    [
      name,
      str(formData, "contactNumber"),
      str(formData, "email"),
      str(formData, "employmentStatus") || "full_time",
      listStr(formData, "branchIds"),
      earningsSharePercentFromForm(formData),
    ]
  );
  revalidatePath("/admin/technicians");
}

export async function updateTechnician(formData: FormData) {
  const techId = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return;
  await query(
    "update technicians set name=$1, contact_number=$2, email=$3, employment_status=$4, branch_ids=$5, earnings_share_percent=$6 where id=$7",
    [
      name,
      str(formData, "contactNumber"),
      str(formData, "email"),
      str(formData, "employmentStatus") || "full_time",
      listStr(formData, "branchIds"),
      earningsSharePercentFromForm(formData),
      techId,
    ]
  );
  revalidatePath("/admin/technicians");
}

export async function toggleTechnicianActive(formData: FormData) {
  const techId = str(formData, "id");
  await query("update technicians set active = not active where id=$1", [techId]);
  revalidatePath("/admin/technicians");
}

export async function deleteTechnician(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const techId = str(formData, "id");

  // Block deleting a technician who still has an open (not yet completed or
  // cancelled) job assigned — reassign or resolve those first, so a job
  // never silently ends up assigned-but-technician-less.
  const [requests, lookups] = await Promise.all([getRequests(), getLookups()]);
  const openStatusIds = new Set(
    lookups.filter((l) => l.kind === "request_status" && l.label !== "Completed" && l.label !== "Cancelled").map((l) => l.id)
  );
  const hasOpenJob = requests.some((r) => r.assignedTechnicianId === techId && openStatusIds.has(r.statusId));
  if (hasOpenJob) return;

  // Any login linked to this technician stays (technician_id just becomes
  // null, per the FK's on delete set null) — past job history keeps its
  // technician_name snapshot regardless, so nothing here erases records.
  await query("delete from technicians where id=$1", [techId]);
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/users");
}

// ---------- Device Brands / Models ----------

export async function createDeviceBrand(formData: FormData) {
  const label = str(formData, "label");
  if (!label) return;
  const lookups = await getLookups();
  const order = lookups.filter((l) => l.kind === "device_brand").length;
  await query("insert into lookups (kind, label, order_num) values ('device_brand',$1,$2)", [label, order]);
  revalidatePath("/admin/device-catalog");
}

export async function deleteLookup(formData: FormData) {
  const itemId = str(formData, "id");
  try {
    await query("delete from lookups where id=$1", [itemId]);
  } catch (e) {
    // Still referenced elsewhere (e.g. a status/service type used by existing
    // leads or requests) — deactivate instead of losing that history.
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "23503") {
      await query("update lookups set active=false where id=$1", [itemId]);
    } else {
      throw e;
    }
  }
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/pos");
}

export async function updateLookupLabel(formData: FormData) {
  const itemId = str(formData, "id");
  const label = str(formData, "label");
  if (!label) return;
  await query("update lookups set label=$1 where id=$2", [label, itemId]);
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
}

export async function createDeviceModel(formData: FormData) {
  const name = str(formData, "name");
  const brandId = str(formData, "brandId");
  if (!name || !brandId) return;
  const count = await queryOne<{ n: number }>("select count(*)::int as n from device_models where brand_id=$1", [brandId]);
  await query("insert into device_models (brand_id, name, order_num) values ($1,$2,$3)", [brandId, name, count?.n ?? 0]);
  revalidatePath("/admin/device-catalog");
}

export async function deleteDeviceModel(formData: FormData) {
  const modelId = str(formData, "id");
  try {
    await query("delete from device_models where id=$1", [modelId]);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "23503") {
      await query("update device_models set active=false where id=$1", [modelId]);
    } else {
      throw e;
    }
  }
  revalidatePath("/admin/device-catalog");
}

// ---------- Generic lookups (service types, customer sources, statuses) ----------

export async function createLookup(formData: FormData) {
  const kind = str(formData, "kind") as LookupKind;
  const label = str(formData, "label");
  if (!label || !kind) return;
  const lookups = await getLookups();
  const order = lookups.filter((l) => l.kind === kind).length;
  await query("insert into lookups (kind, label, order_num) values ($1,$2,$3)", [kind, label, order]);
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
}

export async function reorderLookup(formData: FormData) {
  const itemId = str(formData, "id");
  const direction = str(formData, "direction");
  const lookups = await getLookups();
  const item = lookups.find((l) => l.id === itemId);
  if (!item) return;
  const siblings = lookups.filter((l) => l.kind === item.kind).sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((s) => s.id === item.id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  await query("update lookups set order_num=$1 where id=$2", [other.order, item.id]);
  await query("update lookups set order_num=$1 where id=$2", [item.order, other.id]);
  revalidatePath("/admin/statuses");
}

// ---------- Site Content (public landing page) ----------

export async function updateSiteContent(formData: FormData) {
  await query(
    `update site_content set
      hero_kicker = coalesce(nullif($1,''), hero_kicker),
      hero_headline_prefix = $2,
      hero_headline_highlight = $3,
      hero_headline_suffix = $4,
      hero_subtext = $5,
      primary_cta_label = coalesce(nullif($6,''), primary_cta_label),
      secondary_cta_label = coalesce(nullif($7,''), secondary_cta_label),
      cta_banner_title = $8,
      cta_banner_subtitle = $9,
      cta_banner_button_label = coalesce(nullif($10,''), cta_banner_button_label)
     where id = 1`,
    [
      str(formData, "heroKicker"),
      str(formData, "heroHeadlinePrefix"),
      str(formData, "heroHeadlineHighlight"),
      str(formData, "heroHeadlineSuffix"),
      str(formData, "heroSubtext"),
      str(formData, "primaryCtaLabel"),
      str(formData, "secondaryCtaLabel"),
      str(formData, "ctaBannerTitle"),
      str(formData, "ctaBannerSubtitle"),
      str(formData, "ctaBannerButtonLabel"),
    ]
  );
  revalidatePath("/");
  revalidatePath("/admin/site-content");
}

// ---------- Request Form Content (public home service form) ----------

export async function updateRequestFormContent(formData: FormData) {
  await query(
    `update request_form_content set
      page_kicker = coalesce(nullif($1,''), page_kicker),
      page_title = coalesce(nullif($2,''), page_title),
      page_subtitle = $3,
      submit_button_label = coalesce(nullif($4,''), submit_button_label),
      success_title = coalesce(nullif($5,''), success_title),
      success_body = $6
     where id = 1`,
    [
      str(formData, "pageKicker"),
      str(formData, "pageTitle"),
      str(formData, "pageSubtitle"),
      str(formData, "submitButtonLabel"),
      str(formData, "successTitle"),
      str(formData, "successBody"),
    ]
  );
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// ---------- Custom Form Fields (public home service form) ----------

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `field_${Date.now()}`
  );
}

export async function createCustomField(formData: FormData) {
  const label = str(formData, "label");
  const type = str(formData, "type") as CustomFieldType;
  if (!label || !type) return;
  const key = slugify(label);
  const options = str(formData, "options").split(",").map((o) => o.trim()).filter(Boolean);
  const fields = await getCustomFormFields();
  await query(
    "insert into custom_form_fields (key, system_key, label, placeholder, type, required, options, order_num) values ($1,null,$2,$3,$4,$5,$6,$7)",
    [key, label, str(formData, "placeholder"), type, formData.has("required"), type === "select" ? options : [], fields.length]
  );
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// Type is editable for every field, built-in or custom — see CustomFieldType
// in types.ts for how the handful of catalog-backed built-ins (device
// brand/model, service type) and photo behave when switched away from
// their natural type.
export async function updateCustomField(formData: FormData) {
  const fieldId = str(formData, "id");
  const label = str(formData, "label");
  const type = str(formData, "type") as CustomFieldType;
  if (!label || !type) return;
  const options = str(formData, "options").split(",").map((o) => o.trim()).filter(Boolean);
  await query("update custom_form_fields set label=$1, placeholder=$2, required=$3, type=$4, options=$5 where id=$6", [
    label,
    str(formData, "placeholder"),
    formData.has("required"),
    type,
    type === "select" ? options : [],
    fieldId,
  ]);
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// Fields are switched off rather than hard-deleted — even built-in ones —
// so historical requests that captured them stay intelligible. This is
// what "delete a field" means functionally: it disappears from the public
// form and stops being enforced.
export async function toggleCustomFieldActive(formData: FormData) {
  const fieldId = str(formData, "id");
  await query("update custom_form_fields set active = not active where id=$1", [fieldId]);
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

export async function reorderCustomField(formData: FormData) {
  const fieldId = str(formData, "id");
  const direction = str(formData, "direction");
  const fields = await getCustomFormFields();
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((f) => f.id === fieldId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
  await query("update custom_form_fields set order_num=$1 where id=$2", [sorted[swapIdx].order, sorted[idx].id]);
  await query("update custom_form_fields set order_num=$1 where id=$2", [sorted[idx].order, sorted[swapIdx].id]);
  revalidatePath("/admin/request-form");
}

// ---------- Point of Sale (simple repair-record log) ----------

export type CreateRepairRecordResult = { ok: true; recordId: string; reference: string } | { ok: false; error: string };

// Creates a repair record together with its Pre-Repair checklist in one
// atomic submission — nothing is saved unless the pre-repair checklist is
// fully filled out (all items, both signatures). The record is then left
// in "pending" status (derived: no post-repair checklist yet, not
// cancelled) until someone completes the post-repair checklist from
// /admin/pos/[id]/checklist — which may happen right away or "at a later
// time," per the shop's request to be able to save a ticket mid-job and
// come back to close it.
export async function createRepairRecordDraft(
  _prev: CreateRepairRecordResult | undefined,
  formData: FormData
): Promise<CreateRepairRecordResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin")) {
    return { ok: false, error: "You must be signed in as an admin." };
  }

  const customerName = str(formData, "customerName");
  if (!customerName) return { ok: false, error: "Customer name is required." };
  const branchId = str(formData, "branchId");
  if (!branchId) return { ok: false, error: "Branch is required." };
  const contactNumber = str(formData, "contactNumber");
  const email = str(formData, "email");
  const deviceModel = str(formData, "deviceModel");
  const technicianName = str(formData, "technicianName");

  const preItems: ChecklistItem[] = CHECKLIST_TEMPLATE.map((t) => {
    const result = str(formData, `pre_result_${t.key}`) as ChecklistResult;
    return { ...t, result: result === "pass" || result === "fail" || result === "na" ? result : null, notes: str(formData, `pre_notes_${t.key}`) };
  });
  if (preItems.some((i) => !i.result)) return { ok: false, error: "Please mark every Pre-Repair checklist item as Pass, Fail, or N/A." };
  const preCustomerSignature = str(formData, "preCustomerSignature");
  if (!preCustomerSignature.startsWith("data:image/")) return { ok: false, error: "Pre-repair customer signature is required." };
  const preTechnicianSignature = str(formData, "preTechnicianSignature");
  if (!preTechnicianSignature.startsWith("data:image/")) return { ok: false, error: "Pre-repair technician signature is required." };

  // Every repair record links to a CRM customer — matched by phone, then
  // email, and created if neither matches — so nothing falls through
  // without showing up in that customer's CRM history.
  const customers = await getCustomers();
  const normalizedPhone = contactNumber.replace(/[\s-]/g, "");
  const existing =
    (normalizedPhone && customers.find((c) => c.phone.replace(/[\s-]/g, "") === normalizedPhone)) ||
    (email && customers.find((c) => c.email.toLowerCase() === email.toLowerCase())) ||
    null;

  let customerId: string;
  if (existing) {
    customerId = existing.id;
  } else {
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, source) values ($1,$2,$3,'Walk-in') returning id",
      [customerName, contactNumber, email]
    );
    customerId = created!.id;
    await logActivity("customer", customerId, "Customer created from a repair record", user.name);
  }

  const count = await queryOne<{ n: number }>("select count(*)::int as n from repair_records");
  const reference = `REPAIR-${new Date().getFullYear()}-${String((count?.n ?? 0) + 1).padStart(4, "0")}`;
  const cost = Math.max(0, Number(str(formData, "cost")) || 0);
  const partsCost = Math.max(0, Number(str(formData, "partsCost")) || 0);
  const laborCost = Math.max(0, Number(str(formData, "laborCost")) || 0);
  const otherExpenses = Math.max(0, Number(str(formData, "otherExpenses")) || 0);
  const serviceDate = str(formData, "serviceDate") || new Date().toISOString().slice(0, 10);

  const record = await queryOne<{ id: string }>(
    `insert into repair_records
       (reference, branch_id, customer_id, customer_name, contact_number, email, device_model, reported_problem, service_performed, parts_used, cost, parts_cost, labor_cost, other_expenses, technician_name, service_date, notes, logged_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
    [
      reference,
      branchId,
      customerId,
      customerName,
      contactNumber,
      email,
      deviceModel,
      str(formData, "reportedProblem"),
      str(formData, "servicePerformed"),
      str(formData, "partsUsed"),
      cost,
      partsCost,
      laborCost,
      otherExpenses,
      technicianName,
      serviceDate,
      str(formData, "notes"),
      user.name,
    ]
  );
  const recordId = record!.id;

  const preCount = await queryOne<{ n: number }>("select count(*)::int as n from service_agreements where phase='pre_repair'");
  const preReference = `PRC-${new Date().getFullYear()}-${String((preCount?.n ?? 0) + 1).padStart(4, "0")}`;
  await query(
    `insert into service_agreements (repair_record_id, phase, reference, customer_name, device_label, technician_name, items, summary_notes, customer_signature_data_url, technician_signature_data_url)
     values ($1,'pre_repair',$2,$3,$4,$5,$6,$7,$8,$9)`,
    [recordId, preReference, customerName, deviceModel || "Device", technicianName, JSON.stringify(preItems), str(formData, "preSummaryNotes"), preCustomerSignature, preTechnicianSignature]
  );

  await logActivity(
    "customer",
    customerId,
    `Repair ${reference} opened with Pre-Repair checklist (${preReference}) by ${user.name} — pending post-repair checklist (declared cost ₱${cost.toLocaleString()})`,
    user.name
  );

  revalidatePath("/admin/pos");
  revalidatePath("/admin");
  return { ok: true, recordId, reference };
}

// Marks a repair record cancelled — e.g. the repair turned out to be
// unsuccessful and the device couldn't be fixed. The record and its
// checklists stay for history, just flagged and excluded from revenue
// totals; nothing is deleted.
export async function cancelRepairRecord(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin")) return;

  const recordId = str(formData, "id");
  const reason = str(formData, "reason");
  const record = await getRepairRecordById(recordId);
  if (!record || record.cancelled) return;

  await query("update repair_records set cancelled=true, cancellation_reason=$1, cancelled_at=now() where id=$2", [reason, recordId]);

  let emailNote = "";
  if (record.email) {
    try {
      await sendCancellationEmail(record.email, { customerName: record.customerName, reference: record.reference, reason });
      emailNote = ` — cancellation email sent to ${record.email}`;
    } catch (err) {
      emailNote = ` — cancellation email failed to send to ${record.email} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }

  if (record.customerId) {
    await logActivity(
      "customer",
      record.customerId,
      `Repair ${record.reference} cancelled by ${user.name}${reason ? ` — ${reason}` : ""}${emailNote}`,
      user.name
    );
  }

  revalidatePath("/admin/pos");
  revalidatePath(`/admin/pos/${recordId}`);
  revalidatePath("/admin");
}

// Permanently removes a repair record — unlike cancelling (which keeps the
// record for history, just excluded from revenue), this actually deletes
// it and its checklists (service_agreements.repair_record_id cascades).
// Owner-only: a branch admin can cancel a mistaken entry, but only the
// owner can erase it outright.
export async function deleteRepairRecord(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const recordId = str(formData, "id");
  await query("delete from repair_records where id=$1", [recordId]);
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/daily");
  revalidatePath("/admin/sales/technicians");
  revalidatePath("/admin");
}

// Lets a ticket's customer/repair details be filled in or corrected — while
// pending (e.g. a phone number that wasn't captured at intake) or after
// it's been marked Completed (e.g. a typo noticed later). Only locked once
// the ticket is cancelled, a closed/void state. Note this only updates the
// repair_records fields, not the signed checklists — if a corrected detail
// should reach the customer, resend the receipt separately.
export async function updateRepairRecordDetails(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin")) return;

  const recordId = str(formData, "id");
  const record = await getRepairRecordById(recordId);
  if (!record) return;
  const agreements = await getServiceAgreements();
  // Editable while pending or after completion (to fix incorrect/missing
  // info) — only locked once cancelled, which is a closed/void state.
  if (getRepairRecordStatus(record, agreements) === "cancelled") return;

  const customerName = str(formData, "customerName");
  if (!customerName) return;
  const branchId = str(formData, "branchId") || null;
  const contactNumber = str(formData, "contactNumber");
  const email = str(formData, "email");
  const deviceModel = str(formData, "deviceModel");
  const reportedProblem = str(formData, "reportedProblem");
  const servicePerformed = str(formData, "servicePerformed");
  const partsUsed = str(formData, "partsUsed");
  const cost = Math.max(0, Number(str(formData, "cost")) || 0);
  const partsCost = Math.max(0, Number(str(formData, "partsCost")) || 0);
  const laborCost = Math.max(0, Number(str(formData, "laborCost")) || 0);
  const otherExpenses = Math.max(0, Number(str(formData, "otherExpenses")) || 0);
  const technicianName = str(formData, "technicianName");
  const serviceDate = str(formData, "serviceDate") || record.serviceDate;
  const notes = str(formData, "notes");

  await query(
    `update repair_records set
       branch_id=$1, customer_name=$2, contact_number=$3, email=$4, device_model=$5, reported_problem=$6,
       service_performed=$7, parts_used=$8, cost=$9, parts_cost=$10, labor_cost=$11, other_expenses=$12, technician_name=$13, service_date=$14, notes=$15
     where id=$16`,
    [branchId, customerName, contactNumber, email, deviceModel, reportedProblem, servicePerformed, partsUsed, cost, partsCost, laborCost, otherExpenses, technicianName, serviceDate, notes, recordId]
  );

  if (record.customerId) {
    await query("update customers set name=$1, phone=$2, email=$3 where id=$4", [customerName, contactNumber, email, record.customerId]);
    await logActivity("customer", record.customerId, `Repair ${record.reference} details updated by ${user.name}`, user.name);
  }

  revalidatePath("/admin/pos");
  revalidatePath(`/admin/pos/${recordId}`);
  revalidatePath(`/admin/pos/${recordId}/checklist`);
  revalidatePath("/admin/crm");
}

// ---------- Home Service Request: Email OTP Verification ----------
// Anti-spam gate — a customer must prove they control the email address
// they typed before the Home Service Request form can be submitted at
// all. One row per email in otp_codes; a fresh send overwrites whatever
// was there before rather than accumulating history.

const OTP_TTL_MS = 10 * 60_000;
const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

export async function sendHomeServiceOtp(emailInput: string): Promise<SendOtpResult> {
  const email = emailInput.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address first." };

  const existing = await queryOne<{ created_at: Date }>("select created_at from otp_codes where email=$1", [email]);
  if (existing && Date.now() - new Date(existing.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another code." };
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await query(
    `insert into otp_codes (email, code_hash, attempts, verified, expires_at, created_at)
     values ($1,$2,0,false,$3,now())
     on conflict (email) do update set code_hash=$2, attempts=0, verified=false, expires_at=$3, created_at=now()`,
    [email, codeHash, expiresAt]
  );

  try {
    await sendOtpEmail(email, code);
  } catch {
    return { ok: false, error: "Couldn't send the verification email — please try again in a moment." };
  }
  return { ok: true };
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

export async function verifyHomeServiceOtp(emailInput: string, codeInput: string): Promise<VerifyOtpResult> {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim();
  const row = await queryOne<{ code_hash: string; attempts: number; expires_at: Date; verified: boolean }>(
    "select code_hash, attempts, expires_at, verified from otp_codes where email=$1",
    [email]
  );
  if (!row) return { ok: false, error: "Send a verification code first." };
  if (row.verified) return { ok: true };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code expired — request a new one." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts — request a new code." };

  const match = code.length === 6 && (await bcrypt.compare(code, row.code_hash));
  if (!match) {
    await query("update otp_codes set attempts = attempts + 1 where email=$1", [email]);
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  await query("update otp_codes set verified=true where email=$1", [email]);
  return { ok: true };
}

// ---------- Public Home Service Request ----------

export type SubmitResult = { ok: true; reference: string } | { ok: false; error: string };

// System fields carry fixed input names (independent of the admin's chosen
// display order) so this reads the same regardless of how fields are
// arranged — only whether each one is active/required, from the
// custom_form_fields table, changes what's enforced.
export async function submitHomeServiceRequest(_prev: SubmitResult | undefined, formData: FormData): Promise<SubmitResult> {
  // Which queue this lands in — set by which of the two duplicated forms the
  // customer came from (app/(site)/request/page.tsx), never guessed from
  // their address, so it always matches the option they actually clicked.
  const serviceArea = str(formData, "serviceArea");
  if (serviceArea !== "near" && serviceArea !== "far") {
    return { ok: false, error: "Please start your request from the Book a Home Service page so we know your service area." };
  }
  const branches = await getBranches();
  const queueBranch = branches.find((b) => b.homeServiceQueue === serviceArea);

  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const street = str(formData, "street");
  const city = str(formData, "city");
  const province = str(formData, "province");
  const serviceTypeId = str(formData, "serviceTypeId");
  const issueDescription = str(formData, "issueDescription");
  const photoDataUrlRaw = str(formData, "photoDataUrl");
  const photoDataUrl = photoDataUrlRaw.startsWith("data:image/") ? photoDataUrlRaw : null;
  const preferredDatetime = str(formData, "preferredDatetime");
  const deviceBrandId = str(formData, "deviceBrandId");
  const deviceModelId = str(formData, "deviceModelId");
  const deviceOther = str(formData, "deviceOther");
  const email = str(formData, "email");
  const landmark = str(formData, "landmark");
  const vlogConsent = formData.has("vlogConsent");
  const vlogBlurPreference = vlogConsent ? str(formData, "vlogBlurPreference") : "";
  if (vlogConsent && vlogBlurPreference !== "blurred" && vlogBlurPreference !== "not_blurred") {
    return { ok: false, error: "Please choose whether your face should be blurred if we vlog this visit." };
  }

  const customFormFields = await getCustomFormFields();
  const systemFields = customFormFields.filter((f) => f.systemKey);
  const field = (key: string) => systemFields.find((f) => f.systemKey === key);
  const isActive = (key: string) => field(key)?.active ?? false;
  const isRequired = (key: string) => isActive(key) && (field(key)?.required ?? false);
  const label = (key: string) => field(key)?.label.replace(" (optional)", "") ?? key;

  if (isRequired("name") && !name) return { ok: false, error: `${label("name")} is required.` };
  if (isRequired("phone") && !phone) return { ok: false, error: `${label("phone")} is required.` };
  if (isActive("phone") && phone && !isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid PH mobile number, e.g. 0917 123 4567." };
  }
  if (isRequired("email") && !email) return { ok: false, error: `${label("email")} is required.` };
  if (OTP_GATE_ENABLED && isActive("email") && email) {
    const otpRow = await queryOne<{ verified: boolean }>("select verified from otp_codes where email=$1", [email.trim().toLowerCase()]);
    if (!otpRow?.verified) return { ok: false, error: "Please verify your email address before submitting." };
  }
  if (isRequired("device_brand") && !deviceBrandId) return { ok: false, error: `${label("device_brand")} is required.` };
  if (isRequired("device_model") && !deviceModelId && !deviceOther) return { ok: false, error: `${label("device_model")} is required.` };
  if (isRequired("service_type") && !serviceTypeId) return { ok: false, error: `${label("service_type")} is required.` };
  if (isRequired("issue") && !issueDescription) return { ok: false, error: `${label("issue")} is required.` };
  if (isRequired("photo") && !photoDataUrl) return { ok: false, error: `${label("photo")} is required.` };
  if (isRequired("street") && !street) return { ok: false, error: `${label("street")} is required.` };
  if (isRequired("city") && !city) return { ok: false, error: `${label("city")} is required.` };
  if (isRequired("province") && !province) return { ok: false, error: `${label("province")} is required.` };
  if (isRequired("landmark") && !landmark) return { ok: false, error: `${label("landmark")} is required.` };
  if (isRequired("datetime") && !preferredDatetime) return { ok: false, error: `${label("datetime")} is required.` };

  const customFields: Record<string, string | boolean> = {};
  for (const f of customFormFields.filter((f) => f.active && !f.systemKey)) {
    if (f.type === "checkbox") {
      customFields[f.key] = formData.has(`custom_${f.key}`);
      if (f.required && !customFields[f.key]) {
        return { ok: false, error: `${f.label} is required.` };
      }
    } else {
      const value = str(formData, `custom_${f.key}`);
      if (f.required && !value) {
        return { ok: false, error: `${f.label} is required.` };
      }
      customFields[f.key] = value;
    }
  }

  // Only dedupe/create a customer record when there's a name or phone to
  // identify one by — both fields can be switched off entirely.
  const customers = await getCustomers();
  let customerId: string | null = phone
    ? customers.find((c) => c.phone.replace(/[\s-]/g, "") === phone.replace(/[\s-]/g, ""))?.id ?? null
    : null;

  if (!customerId && (name || phone)) {
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, street, province, landmark, source) values ($1,$2,$3,$4,$5,$6,'Home Service') returning id",
      [name, phone, email, street, province, landmark]
    );
    customerId = created!.id;
    await logActivity("customer", customerId, "Customer created from Home Service Request form", "System");
  }

  const allLookups = await getLookups();
  const requestStatuses = allLookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  // Home Service Requests are no longer auto-assigned to a technician on
  // submission — every new request lands in the Unassigned queue for an
  // admin to triage and assign manually.
  const initialStatus = requestStatuses[0];

  const requestsCount = await queryOne<{ n: string }>("select count(*)::int as n from home_service_requests");
  const reference = `HSR-${new Date().getFullYear()}-${String(Number(requestsCount!.n) + 1).padStart(4, "0")}`;

  const now = new Date().toISOString();
  const statusHistory = [{ statusId: initialStatus.id, at: now }];

  // device_brand_id and service_type_id are foreign keys to the lookups
  // table, but Admin > Request Form lets either field's type be switched
  // away from "select" to a plain text input — a customer can then type
  // anything (e.g. "apple" lowercase, a typo, a brand we don't stock) into
  // what the DB expects to be a UUID. Fall back to storing that text where
  // it's actually usable instead of failing the whole submission.
  const validDeviceBrandId = UUID_RE.test(deviceBrandId) ? deviceBrandId : null;
  const validDeviceModelId = UUID_RE.test(deviceModelId) ? deviceModelId : null;
  const validServiceTypeId = UUID_RE.test(serviceTypeId) ? serviceTypeId : null;
  const finalDeviceOther =
    deviceBrandId && !validDeviceBrandId ? [deviceBrandId, deviceOther].filter(Boolean).join(" ") : deviceOther;

  const created = await queryOne<{ id: string }>(
    `insert into home_service_requests (
      reference, customer_id, customer_name, phone, email, device_brand_id, device_model_id, device_other, service_type_id,
      issue_description, photo_data_url, street, landmark, province, city, lat, lng, preferred_datetime,
      status_id, status_history, custom_fields, vlog_consent, vlog_blur_preference,
      assigned_technician_id, auto_assigned, branch_id, queue_branch_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    returning id`,
    [
      reference,
      customerId,
      name,
      phone,
      email,
      validDeviceBrandId,
      validDeviceModelId,
      finalDeviceOther,
      validServiceTypeId,
      issueDescription,
      photoDataUrl,
      street,
      landmark,
      province,
      city,
      str(formData, "lat") ? Number(str(formData, "lat")) : null,
      str(formData, "lng") ? Number(str(formData, "lng")) : null,
      preferredDatetime || null,
      initialStatus.id,
      JSON.stringify(statusHistory),
      JSON.stringify(customFields),
      vlogConsent,
      vlogBlurPreference,
      null,
      false,
      null,
      queueBranch?.id ?? null,
    ]
  );

  let smsNote = "";
  if (phone && smsConfigured()) {
    const confirmMessage = `Hi ${name || "there"}, your Ceejay repair request ${reference} has been received! Our team will reach out soon to schedule your service.`;
    try {
      await sendSms(phone, confirmMessage);
      smsNote = ` — confirmation SMS sent to ${phone}`;
    } catch (err) {
      smsNote = ` — confirmation SMS failed to send to ${phone} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }
  await logActivity(
    "home_service_request",
    created!.id,
    `Request ${reference} submitted and sent to the Unassigned queue for triage${smsNote}`,
    "System"
  );

  if (email) await query("delete from otp_codes where email=$1", [email.trim().toLowerCase()]);

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return { ok: true, reference };
}

// ---------- Public Contact Form ----------

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContactInquiry(_prev: ContactResult | undefined, formData: FormData): Promise<ContactResult> {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const message = str(formData, "message");

  if (!name || !message || (!phone && !email)) {
    return { ok: false, error: "Please share your name, a way to reach you (phone or email), and your message." };
  }
  if (phone && !isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid PH mobile number, e.g. 0917 123 4567." };
  }

  const lookups = await getLookups();
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead = await queryOne<{ id: string }>(
    "insert into leads (name, phone, email, source, status_id, notes) values ($1,$2,$3,'Website',$4,$5) returning id",
    [name, phone, email, leadStatuses[0]?.id ?? null, message]
  );
  await logActivity("lead", lead!.id, "Inquiry submitted via website contact form", "System");
  revalidatePath("/admin/crm");
  return { ok: true };
}

// ---------- Admin: Home Service Requests ----------

export async function reassignRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return;
  const requestId = str(formData, "id");
  const technicianId = str(formData, "technicianId") || null;
  const req = await getRequestById(requestId);
  if (!req) return;

  if (technicianId) {
    const technicians = await getTechnicians();
    const tech = technicians.find((t) => t.id === technicianId);
    const lookups = await getLookups();
    const assignedStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Assigned");
    const nextBranchId = tech?.branchIds[0] ?? req.branchId;
    if (assignedStatus && req.statusId !== assignedStatus.id) {
      const statusHistory = [...req.statusHistory, { statusId: assignedStatus.id, at: new Date().toISOString() }];
      await query("update home_service_requests set assigned_technician_id=$1, auto_assigned=false, branch_id=$2, status_id=$3, status_history=$4 where id=$5", [
        technicianId,
        nextBranchId,
        assignedStatus.id,
        JSON.stringify(statusHistory),
        requestId,
      ]);
    } else {
      await query("update home_service_requests set assigned_technician_id=$1, auto_assigned=false, branch_id=$2 where id=$3", [
        technicianId,
        nextBranchId,
        requestId,
      ]);
    }
    let smsNote = "";
    if (req.phone && tech && smsConfigured()) {
      try {
        await sendSms(
          req.phone,
          `Hi ${req.customerName || "there"}, ${tech.name} has been assigned to your Ceejay repair request ${req.reference}. We'll keep you posted!`
        );
        smsNote = ` — SMS sent to ${req.phone}`;
      } catch (err) {
        smsNote = ` — SMS failed to send to ${req.phone} (${err instanceof Error ? err.message : "unknown error"})`;
      }
    }
    await logActivity(
      "home_service_request",
      req.id,
      `Manually reassigned to ${tech?.name ?? technicianId} by ${user?.name ?? "Admin"}${smsNote}`,
      user?.name ?? "Admin"
    );
  } else {
    await query("update home_service_requests set assigned_technician_id=null, auto_assigned=false where id=$1", [requestId]);
    await logActivity("home_service_request", req.id, `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  }
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
}

// SMS copy for the three status changes the customer actually needs to
// hear about — every other status transition (e.g. "Assigned", which
// already gets its own message from reassignRequest/auto-assignment) stays
// silent so a customer isn't texted for every internal state change.
function statusChangeSmsText(customerName: string, reference: string, statusLabel: string): string | null {
  const name = customerName || "there";
  if (statusLabel === "In Progress") return `Hi ${name}, work has started on your Ceejay repair request ${reference}.`;
  if (statusLabel === "Completed") return `Hi ${name}, your Ceejay repair request ${reference} is complete! Thank you for choosing us.`;
  if (statusLabel === "Cancelled") return `Hi ${name}, your Ceejay repair request ${reference} has been cancelled.`;
  return null;
}

async function sendStatusChangeSms(phone: string, customerName: string, reference: string, statusLabel: string): Promise<string> {
  const text = statusChangeSmsText(customerName, reference, statusLabel);
  if (!text || !phone || !smsConfigured()) return "";
  try {
    await sendSms(phone, text);
    return ` — status SMS sent to ${phone}`;
  } catch (err) {
    return ` — status SMS failed to send to ${phone} (${err instanceof Error ? err.message : "unknown error"})`;
  }
}

export async function changeRequestStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return;
  const requestId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const req = await getRequestById(requestId);
  const lookups = await getLookups();
  const status = lookups.find((l) => l.id === statusId);
  if (!req || !status) return;
  const statusHistory = [...req.statusHistory, { statusId, at: new Date().toISOString() }];
  await query("update home_service_requests set status_id=$1, status_history=$2 where id=$3", [statusId, JSON.stringify(statusHistory), requestId]);

  let emailNote = "";
  if (status.label === "Cancelled" && req.email) {
    try {
      await sendCancellationEmail(req.email, { customerName: req.customerName, reference: req.reference, reason: "" });
      emailNote = ` — cancellation email sent to ${req.email}`;
    } catch (err) {
      emailNote = ` — cancellation email failed to send to ${req.email} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }
  const smsNote = await sendStatusChangeSms(req.phone, req.customerName, req.reference, status.label);

  await logActivity(
    "home_service_request",
    req.id,
    `Status changed to "${status.label}" by ${user?.name ?? "Admin"}${emailNote}${smsNote}`,
    user?.name ?? "Admin"
  );
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/technician");
}

// Permanently removes a home service request — its checklists
// (service_agreements), notifications, and progress notes all cascade with
// it; any POS sale tied to it just loses that reference (kept, not
// deleted). Cancelling a request keeps it for history; this actually erases
// it, so it's gated by canDeleteHomeServiceRequests — owner admins always,
// branch admins only when explicitly granted (Staff Accounts).
export async function deleteHomeServiceRequest(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canDeleteHomeServiceRequests(actor)) return;

  const requestId = str(formData, "id");
  await query("delete from home_service_requests where id=$1", [requestId]);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales/home-service");
  revalidatePath("/admin/sales/materials");
  revalidatePath("/technician");
  revalidatePath("/admin");
}

export async function updateRequestNotes(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return;
  const requestId = str(formData, "id");
  const notes = str(formData, "adminNotes");
  await query("update home_service_requests set admin_notes=$1 where id=$2", [notes, requestId]);
  revalidatePath(`/admin/requests/${requestId}`);
}

// ---------- Sales: Business Expenses ----------

export async function createExpense(formData: FormData) {
  const actor = await requireRole("owner_admin", "branch_admin");
  if (!actor) return;

  const description = str(formData, "description");
  const amount = Math.max(0, Number(str(formData, "amount")) || 0);
  const target = str(formData, "target") as Expense["target"];
  const technicianName = target === "technician_final_total_sales" ? str(formData, "technicianName") || null : null;
  const branchId = str(formData, "branchId") || null;
  const expenseDate = new Date().toISOString().slice(0, 10); // always today — expenses are recorded on the day they happen, never backdated
  if (!description || amount <= 0 || !target || !branchId) return;
  if (target === "technician_final_total_sales" && !technicianName) return;

  await query(
    "insert into expenses (description, amount, target, technician_name, branch_id, expense_date, created_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [description, amount, target, technicianName, branchId, expenseDate, actor.name]
  );
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/technicians");
  revalidatePath("/admin/sales/expenses");
}

export async function deleteExpense(formData: FormData) {
  const actor = await requireRole("owner_admin", "branch_admin");
  if (!actor) return;

  const id = str(formData, "id");
  await query("delete from expenses where id = $1", [id]);
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/technicians");
  revalidatePath("/admin/sales/expenses");
}

// ---------- CRM: Leads & Customers ----------

export async function createLead(formData: FormData) {
  const user = await getCurrentUser();
  const name = str(formData, "name");
  if (!name) return;
  const lookups = await getLookups();
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead = await queryOne<{ id: string }>(
    "insert into leads (name, phone, email, source, status_id, assigned_to, follow_up_date, notes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
    [
      name,
      str(formData, "phone"),
      str(formData, "email"),
      str(formData, "source"),
      leadStatuses[0]?.id ?? null,
      user?.id ?? null,
      str(formData, "followUpDate") || null,
      str(formData, "notes"),
    ]
  );
  await logActivity("lead", lead!.id, `Lead created by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
}

export async function updateLeadStatus(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const lookups = await getLookups();
  const status = lookups.find((l) => l.id === statusId);
  if (!status) return;
  await query("update leads set status_id=$1 where id=$2", [statusId, leadId]);
  await logActivity("lead", leadId, `Status changed to "${status.label}" by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function assignLead(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const assignedTo = str(formData, "assignedTo") || null;
  const users = await getUsers();
  const assignee = users.find((u) => u.id === assignedTo);
  await query("update leads set assigned_to=$1 where id=$2", [assignedTo, leadId]);
  await logActivity("lead", leadId, assignee ? `Assigned to ${assignee.name} by ${user?.name ?? "Admin"}` : `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function addLeadNote(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const note = str(formData, "note");
  const followUpDate = str(formData, "followUpDate");
  if (!note) return;
  if (followUpDate) {
    await query("update leads set notes = notes || case when notes = '' then '' else E'\\n' end || $1, follow_up_date=$2 where id=$3", [note, followUpDate, leadId]);
  } else {
    await query("update leads set notes = notes || case when notes = '' then '' else E'\\n' end || $1 where id=$2", [note, leadId]);
  }
  await logActivity("lead", leadId, `Note added by ${user?.name ?? "Admin"}: ${note}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function convertLeadToCustomer(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const lead = await queryOne<{ id: string; customer_id: string | null; name: string; phone: string; email: string; source: string }>(
    "select id, customer_id, name, phone, email, source from leads where id=$1",
    [leadId]
  );
  if (!lead) return;

  let customerId = lead.customer_id;
  if (!customerId) {
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, source, notes) values ($1,$2,$3,$4,$5) returning id",
      [lead.name, lead.phone, lead.email, lead.source || "Referral", `Converted from lead ${lead.id}`]
    );
    customerId = created!.id;
    await query("update leads set customer_id=$1 where id=$2", [customerId, leadId]);
  }
  const lookups = await getLookups();
  const converted = lookups.find((l) => l.kind === "lead_status" && l.label === "Converted");
  if (converted) await query("update leads set status_id=$1 where id=$2", [converted.id, leadId]);

  await logActivity("lead", leadId, `Converted to customer by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  await logActivity("customer", customerId, `Created via lead conversion by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function createCustomer(formData: FormData) {
  const user = await getCurrentUser();
  const name = str(formData, "name");
  if (!name) return;
  const customer = await queryOne<{ id: string }>(
    "insert into customers (name, phone, email, street, province, landmark, source, notes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
    [
      name,
      str(formData, "phone"),
      str(formData, "email"),
      str(formData, "street"),
      str(formData, "province"),
      str(formData, "landmark"),
      str(formData, "source") || "Walk-in",
      str(formData, "notes"),
    ]
  );
  await logActivity("customer", customer!.id, `Customer created by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
}

export async function addCustomerNote(formData: FormData) {
  const user = await getCurrentUser();
  const customerId = str(formData, "id");
  const note = str(formData, "note");
  if (!note) return;
  await query("update customers set notes = notes || case when notes = '' then '' else E'\\n' end || $1 where id=$2", [note, customerId]);
  await logActivity("customer", customerId, `Note added by ${user?.name ?? "Admin"}: ${note}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${customerId}`);
}

// ---------- Technician view ----------

export async function technicianUpdateStatus(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const note = str(formData, "note");
  const req = await getRequestById(requestId);
  const lookups = await getLookups();
  const status = lookups.find((l) => l.id === statusId);
  if (!req || !status) return;

  const statusHistory = [...req.statusHistory, { statusId, at: new Date().toISOString() }];
  const adminNotes = note ? (req.adminNotes ? `${req.adminNotes}\n[${user?.name}] ${note}` : `[${user?.name}] ${note}`) : req.adminNotes;
  await query("update home_service_requests set status_id=$1, status_history=$2, admin_notes=$3 where id=$4", [
    statusId,
    JSON.stringify(statusHistory),
    adminNotes,
    requestId,
  ]);

  let emailNote = "";
  if (status.label === "Cancelled" && req.email) {
    try {
      await sendCancellationEmail(req.email, { customerName: req.customerName, reference: req.reference, reason: note });
      emailNote = ` — cancellation email sent to ${req.email}`;
    } catch (err) {
      emailNote = ` — cancellation email failed to send to ${req.email} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }
  const smsNote = await sendStatusChangeSms(req.phone, req.customerName, req.reference, status.label);

  await logActivity(
    "home_service_request",
    req.id,
    `Status updated to "${status.label}" by technician ${user?.name ?? ""}${note ? ` — ${note}` : ""}${emailNote}${smsNote}`,
    user?.name ?? "Technician"
  );
  if (status.label === "In Progress") {
    await notifyAdmins(
      "request_in_progress",
      req.id,
      `${user?.name ?? "A technician"} started work on ${req.reference} (${req.customerName}) — pre-repair checklist is now open.`
    );
  }
  revalidatePath("/technician");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
}

// Free-form work-in-progress notes — the technician can save this repeatedly
// while the job is open, unlike the one-shot signed checklist below.
export async function saveRepairProgress(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") return;

  const requestId = str(formData, "requestId");
  const req = await getRequestById(requestId);
  if (!req || req.assignedTechnicianId !== user.technicianId) return;

  await query(
    `insert into repair_progress (request_id, inspection_results, progress_notes, parts_replaced, other_details, updated_by, updated_at)
     values ($1,$2,$3,$4,$5,$6,now())
     on conflict (request_id) do update set
       inspection_results=$2, progress_notes=$3, parts_replaced=$4, other_details=$5, updated_by=$6, updated_at=now()`,
    [requestId, str(formData, "inspectionResults"), str(formData, "progressNotes"), str(formData, "partsReplaced"), str(formData, "otherDetails"), user.name]
  );

  await logActivity("home_service_request", requestId, `Repair progress notes updated by ${user.name}`, user.name);

  revalidatePath(`/technician/requests/${requestId}/checklist`);
  revalidatePath(`/admin/requests/${requestId}`);
}

// ---------- Pre-Repair / Post-Repair Checklists ----------

export type SubmitChecklistResult = { ok: true; agreementId: string; phase: ChecklistPhase } | { ok: false; error: string };

export async function submitChecklist(_prev: SubmitChecklistResult | undefined, formData: FormData): Promise<SubmitChecklistResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to submit a checklist." };

  const requestId = str(formData, "requestId") || null;
  const repairRecordId = str(formData, "repairRecordId") || null;
  const phase = str(formData, "phase") as ChecklistPhase;
  if (phase !== "pre_repair" && phase !== "post_repair") return { ok: false, error: "Invalid checklist phase." };
  if (!requestId && !repairRecordId) return { ok: false, error: "Missing target for this checklist." };

  let req: Awaited<ReturnType<typeof getRequestById>> = null;
  let record: Awaited<ReturnType<typeof getRepairRecordById>> = null;
  let customerName: string;
  let deviceLabel: string;
  let branchId: string | null;
  let technicianId: string | null;
  let technicianName: string;

  if (requestId) {
    if (user.role !== "technician") return { ok: false, error: "You must be signed in as the assigned technician." };
    req = await getRequestById(requestId);
    if (!req) return { ok: false, error: "Request not found." };
    if (req.assignedTechnicianId !== user.technicianId) {
      return { ok: false, error: "This job isn't assigned to you." };
    }
    const technicians = await getTechnicians();
    const technician = technicians.find((t) => t.id === user.technicianId);
    const lookups = await getLookups();
    const brand = lookups.find((l) => l.id === req!.deviceBrandId);
    const deviceModels = await query<{ id: string; name: string }>("select id, name from device_models where id=$1", [req.deviceModelId]);
    const model = deviceModels[0];
    customerName = req.customerName;
    deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "Device";
    branchId = req.branchId;
    technicianId = user.technicianId;
    technicianName = technician?.name ?? user.name;
  } else {
    if (user.role !== "owner_admin" && user.role !== "branch_admin") return { ok: false, error: "You must be signed in as an admin." };
    record = await getRepairRecordById(repairRecordId!);
    if (!record) return { ok: false, error: "Repair record not found." };
    customerName = record.customerName;
    deviceLabel = record.deviceModel || "Device";
    branchId = null;
    technicianId = null;
    technicianName = record.technicianName || user.name;
  }

  const agreements = await getServiceAgreements();
  const existingForPhase = agreements.find((a) =>
    requestId ? a.requestId === requestId && a.phase === phase : a.repairRecordId === repairRecordId && a.phase === phase
  );
  if (existingForPhase) return { ok: false, error: "This checklist has already been completed." };

  const preAgreement = agreements.find((a) =>
    requestId ? a.requestId === requestId && a.phase === "pre_repair" : a.repairRecordId === repairRecordId && a.phase === "pre_repair"
  );
  if (phase === "post_repair" && !preAgreement) {
    return { ok: false, error: "Complete the pre-repair checklist first." };
  }

  const items: ChecklistItem[] = CHECKLIST_TEMPLATE.map((t) => {
    const result = str(formData, `result_${t.key}`) as ChecklistResult;
    return {
      ...t,
      result: result === "pass" || result === "fail" || result === "na" ? result : null,
      notes: str(formData, `notes_${t.key}`),
    };
  });
  if (items.some((i) => !i.result)) {
    return { ok: false, error: "Please mark every checklist item as Pass, Fail, or N/A before completing." };
  }

  let agreedToTerms = false;
  if (phase === "post_repair") {
    agreedToTerms = formData.has("agreedToTerms");
    if (!agreedToTerms) {
      return { ok: false, error: "The customer must acknowledge the terms and conditions." };
    }
  }

  const customerSignatureDataUrl = str(formData, "customerSignature");
  if (!customerSignatureDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Customer signature is required." };
  }

  const technicianSignatureDataUrl = str(formData, "technicianSignature");
  if (!technicianSignatureDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Technician signature is required." };
  }

  let receiptPhotoDataUrl: string | null = null;
  let warrantyCoverage = "";
  let cost = 0;
  let partsCost = 0;
  let laborCost = 0;
  let otherExpenses = 0;
  if (phase === "post_repair") {
    // Required on the technician/home-service flow (device photo). Optional
    // on the admin/POS flow (receipt photo) — not every walk-in repair has
    // a paper receipt to photograph.
    const receiptPhotoRaw = str(formData, "receiptPhotoDataUrl");
    const hasPhoto = receiptPhotoRaw.startsWith("data:image/");
    if (requestId && !hasPhoto) {
      return { ok: false, error: "A photo of the device is required to complete and close this case." };
    }
    receiptPhotoDataUrl = hasPhoto ? receiptPhotoRaw : null;
    warrantyCoverage = str(formData, "warrantyCoverage");
    if (!warrantyCoverage) {
      return { ok: false, error: "Warranty coverage for this repair is required." };
    }
    if (requestId) {
      const costRaw = str(formData, "cost");
      if (!costRaw) return { ok: false, error: "Price of the repair is required." };
      cost = Math.max(0, Number(costRaw) || 0);
      partsCost = Math.max(0, Number(str(formData, "partsCost")) || 0);
      laborCost = Math.max(0, Number(str(formData, "laborCost")) || 0);
      otherExpenses = Math.max(0, Number(str(formData, "otherExpenses")) || 0);
    }
  }

  const prefix = phase === "pre_repair" ? "PRC" : "SA";
  const phaseCount = await queryOne<{ n: string }>("select count(*)::int as n from service_agreements where phase=$1", [phase]);
  const reference = `${prefix}-${new Date().getFullYear()}-${String(Number(phaseCount!.n) + 1).padStart(4, "0")}`;

  const created = await queryOne<{ id: string }>(
    `insert into service_agreements (
      request_id, repair_record_id, phase, reference, customer_name, device_label, branch_id, technician_id, technician_name,
      items, summary_notes, agreed_to_terms, customer_signature_data_url, technician_signature_data_url, receipt_photo_data_url, warranty_coverage, cost, parts_cost, labor_cost, other_expenses
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    returning id`,
    [
      requestId,
      repairRecordId,
      phase,
      reference,
      customerName,
      deviceLabel,
      branchId,
      technicianId,
      technicianName,
      JSON.stringify(items),
      str(formData, "summaryNotes"),
      agreedToTerms,
      customerSignatureDataUrl,
      technicianSignatureDataUrl,
      receiptPhotoDataUrl,
      warrantyCoverage,
      cost,
      partsCost,
      laborCost,
      otherExpenses,
    ]
  );
  const agreementId = created!.id;

  if (req) {
    if (phase === "pre_repair") {
      await logActivity(
        "home_service_request",
        req.id,
        `Pre-repair checklist ${reference} completed by ${technicianName} — post-repair checklist is now open.`,
        technicianName
      );
    } else {
      const now = new Date().toISOString();
      const postNotes = str(formData, "summaryNotes");
      const lookups = await getLookups();
      const serviceType = lookups.find((l) => l.id === req.serviceTypeId);

      let emailNote = "no email on file — receipt not emailed";
      if (req.email) {
        try {
          await sendRepairReceiptEmail(req.email, {
            customerName: req.customerName,
            reference: req.reference,
            serviceDate: now.slice(0, 10),
            deviceLabel,
            natureOfRepair: [serviceType?.label, req.issueDescription].filter(Boolean).join(" — "),
            warrantyCoverage,
            postNotes,
            repairCost: cost,
            serviceFee: laborCost, // parts/material cost is internal-only, not part of this figure
            technicianName,
            preItems: preAgreement?.items ?? [],
            postItems: items,
            preCustomerSignature: preAgreement?.customerSignatureDataUrl ?? null,
            preTechnicianSignature: preAgreement?.technicianSignatureDataUrl ?? null,
            postCustomerSignature: customerSignatureDataUrl,
            postTechnicianSignature: technicianSignatureDataUrl,
            receiptPhoto: receiptPhotoDataUrl,
            photoLabel: "Photo of Device",
          });
          await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, agreementId]);
          if (preAgreement) await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, preAgreement.id]);
          emailNote = `receipt emailed to ${req.email}`;
        } catch (err) {
          emailNote = `receipt email failed to send to ${req.email} (${err instanceof Error ? err.message : "unknown error"})`;
        }
      }

      const completedStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Completed");
      if (completedStatus && req.statusId !== completedStatus.id) {
        const statusHistory = [...req.statusHistory, { statusId: completedStatus.id, at: now }];
        await query("update home_service_requests set status_id=$1, status_history=$2 where id=$3", [completedStatus.id, JSON.stringify(statusHistory), req.id]);
      }

      await logActivity(
        "home_service_request",
        req.id,
        `Post-repair checklist ${reference} completed by ${technicianName} — case auto-marked Completed. Pre-repair (${preAgreement?.reference ?? "—"}) and post-repair (${reference}) checklists — ${emailNote}`,
        technicianName
      );
      await notifyAdmins(
        "checklist_completed",
        req.id,
        `${technicianName} completed the post-repair checklist for ${req.reference} (${req.customerName}) — case marked Completed. ${emailNote}.`
      );
    }
    revalidatePath("/technician");
    revalidatePath("/admin/requests");
    revalidatePath(`/admin/requests/${requestId}`);
    revalidatePath("/admin");
  } else if (record) {
    if (phase === "pre_repair") {
      if (record.customerId) {
        await logActivity(
          "customer",
          record.customerId,
          `Pre-repair checklist ${reference} completed by ${technicianName} for ${record.reference} — saved as pending, post-repair checklist still open`,
          user.name
        );
      }
    } else {
      const postNotes = str(formData, "summaryNotes");
      let emailNote = "no email on file — receipt not emailed";
      if (record.email) {
        try {
          await sendRepairReceiptEmail(record.email, {
            customerName: record.customerName,
            reference: record.reference,
            serviceDate: record.serviceDate,
            deviceLabel,
            natureOfRepair: [record.reportedProblem, record.servicePerformed].filter(Boolean).join(" — "),
            warrantyCoverage,
            postNotes,
            repairCost: record.cost,
            serviceFee: record.laborCost,
            technicianName,
            preItems: preAgreement?.items ?? [],
            postItems: items,
            preCustomerSignature: preAgreement?.customerSignatureDataUrl ?? null,
            preTechnicianSignature: preAgreement?.technicianSignatureDataUrl ?? null,
            postCustomerSignature: customerSignatureDataUrl,
            postTechnicianSignature: technicianSignatureDataUrl,
            receiptPhoto: receiptPhotoDataUrl,
          });
          const now = new Date().toISOString();
          await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, agreementId]);
          if (preAgreement) await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, preAgreement.id]);
          emailNote = `receipt emailed to ${record.email}`;
        } catch (err) {
          emailNote = `receipt email failed to send to ${record.email} (${err instanceof Error ? err.message : "unknown error"})`;
        }
      }
      if (record.customerId) {
        await logActivity(
          "customer",
          record.customerId,
          `Post-repair checklist ${reference} completed by ${technicianName} for ${record.reference} — ${emailNote}`,
          user.name
        );
      }
    }
    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/${repairRecordId}`);
    revalidatePath(`/admin/pos/${repairRecordId}/checklist`);
  }

  return { ok: true, agreementId, phase };
}

// Lets a technician self-correct the Repair Price / Labor-Service Cost on
// their own completed Post-Repair checklist (e.g. a typo at submission
// time) — capped at MAX_PRICE_EDITS so it stays a correction tool, not an
// open price field.
export type UpdateAgreementPriceResult = { ok: true } | { ok: false; error: string };

export async function updateAgreementPrice(
  _prev: UpdateAgreementPriceResult | undefined,
  formData: FormData
): Promise<UpdateAgreementPriceResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") return { ok: false, error: "You must be signed in as a technician." };

  const agreementId = str(formData, "agreementId");
  const agreements = await getServiceAgreements();
  const agreement = agreements.find((a) => a.id === agreementId);
  if (!agreement) return { ok: false, error: "Checklist not found." };
  if (agreement.phase !== "post_repair" || !agreement.requestId) return { ok: false, error: "This checklist can't be price-edited." };

  const req = await getRequestById(agreement.requestId);
  if (!req || req.assignedTechnicianId !== user.technicianId) return { ok: false, error: "This job isn't assigned to you." };

  if (agreement.priceEditCount >= MAX_PRICE_EDITS) {
    return { ok: false, error: `You've already used all ${MAX_PRICE_EDITS} price edits for this job.` };
  }

  const cost = Math.max(0, Number(str(formData, "cost")) || 0);
  const laborCost = Math.max(0, Number(str(formData, "laborCost")) || 0);
  const partsCost = Math.max(0, Number(str(formData, "partsCost")) || 0);

  await query("update service_agreements set cost=$1, labor_cost=$2, parts_cost=$3, price_edit_count=price_edit_count+1 where id=$4", [
    cost,
    laborCost,
    partsCost,
    agreementId,
  ]);
  await logActivity(
    "home_service_request",
    req.id,
    `${user.name} edited the repair price on ${agreement.reference} (edit ${agreement.priceEditCount + 1}/${MAX_PRICE_EDITS})`,
    user.name
  );
  revalidatePath("/technician");
  revalidatePath(`/technician/requests/${req.id}/checklist`);
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${req.id}`);
  return { ok: true };
}

// Re-sends the same PDF receipt that was emailed when the Post-Repair
// checklist was completed — for when a customer calls back asking for
// another copy. Reads straight off the already-saved record/agreements
// (both are locked once the job is completed) rather than re-deriving
// anything, so the resend is guaranteed to match what was originally sent.
export type ResendReceiptResult = { ok: true; email: string } | { ok: false; error: string };

export async function resendReceiptEmail(_prev: ResendReceiptResult | undefined, formData: FormData): Promise<ResendReceiptResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin" && user.role !== "technician")) {
    return { ok: false, error: "You must be signed in as an admin or the assigned technician." };
  }

  const requestId = str(formData, "requestId") || null;
  const repairRecordId = str(formData, "repairRecordId") || null;
  if (!requestId && !repairRecordId) return { ok: false, error: "Missing target for this receipt." };
  if (user.role === "technician" && !requestId) {
    return { ok: false, error: "Technicians can only resend home service receipts." };
  }

  const agreements = await getServiceAgreements();

  if (requestId) {
    const req = await getRequestById(requestId);
    if (!req) return { ok: false, error: "Request not found." };
    if (user.role === "technician" && req.assignedTechnicianId !== user.technicianId) {
      return { ok: false, error: "This job isn't assigned to you." };
    }
    if (!req.email) return { ok: false, error: "No email on file for this customer." };
    const pre = agreements.find((a) => a.requestId === requestId && a.phase === "pre_repair");
    const post = agreements.find((a) => a.requestId === requestId && a.phase === "post_repair");
    if (!post) return { ok: false, error: "The Post-Repair checklist hasn't been completed yet — there's no receipt to resend." };
    const lookups = await getLookups();
    const serviceType = lookups.find((l) => l.id === req.serviceTypeId);

    try {
      await sendRepairReceiptEmail(req.email, {
        customerName: req.customerName,
        reference: req.reference,
        serviceDate: post.completedAt.slice(0, 10),
        deviceLabel: post.deviceLabel,
        natureOfRepair: [serviceType?.label, req.issueDescription].filter(Boolean).join(" — "),
        warrantyCoverage: post.warrantyCoverage,
        postNotes: post.summaryNotes,
        repairCost: post.cost,
        serviceFee: post.laborCost, // parts/material cost is internal-only, not part of this figure
        technicianName: post.technicianName,
        preItems: pre?.items ?? [],
        postItems: post.items,
        preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
        preTechnicianSignature: pre?.technicianSignatureDataUrl ?? null,
        postCustomerSignature: post.customerSignatureDataUrl,
        postTechnicianSignature: post.technicianSignatureDataUrl,
        receiptPhoto: post.receiptPhotoDataUrl,
        photoLabel: "Photo of Device",
      });
    } catch (err) {
      return { ok: false, error: `Couldn't send the email — ${err instanceof Error ? err.message : "unknown error"}. Please try again.` };
    }

    const now = new Date().toISOString();
    await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, post.id]);
    if (pre) await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, pre.id]);
    await logActivity("home_service_request", requestId, `Receipt resent to ${req.email} by ${user.name}`, user.name);
    revalidatePath(`/admin/requests/${requestId}`);
    revalidatePath(`/technician/requests/${requestId}/checklist`);
    return { ok: true, email: req.email };
  }

  const record = await getRepairRecordById(repairRecordId!);
  if (!record) return { ok: false, error: "Repair record not found." };
  if (!record.email) return { ok: false, error: "No email on file for this customer." };
  const pre = agreements.find((a) => a.repairRecordId === repairRecordId && a.phase === "pre_repair");
  const post = agreements.find((a) => a.repairRecordId === repairRecordId && a.phase === "post_repair");
  if (!post) return { ok: false, error: "The Post-Repair checklist hasn't been completed yet — there's no receipt to resend." };

  try {
    await sendRepairReceiptEmail(record.email, {
      customerName: record.customerName,
      reference: record.reference,
      serviceDate: record.serviceDate,
      deviceLabel: post.deviceLabel,
      natureOfRepair: [record.reportedProblem, record.servicePerformed].filter(Boolean).join(" — "),
      warrantyCoverage: post.warrantyCoverage,
      postNotes: post.summaryNotes,
      repairCost: record.cost,
      serviceFee: record.laborCost,
      technicianName: post.technicianName,
      preItems: pre?.items ?? [],
      postItems: post.items,
      preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
      preTechnicianSignature: pre?.technicianSignatureDataUrl ?? null,
      postCustomerSignature: post.customerSignatureDataUrl,
      postTechnicianSignature: post.technicianSignatureDataUrl,
      receiptPhoto: post.receiptPhotoDataUrl,
    });
  } catch (err) {
    return { ok: false, error: `Couldn't send the email — ${err instanceof Error ? err.message : "unknown error"}. Please try again.` };
  }

  const now = new Date().toISOString();
  await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, post.id]);
  if (pre) await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, pre.id]);
  if (record.customerId) {
    await logActivity("customer", record.customerId, `Receipt for ${record.reference} resent to ${record.email} by ${user.name}`, user.name);
  }
  revalidatePath(`/admin/pos/${repairRecordId}`);
  return { ok: true, email: record.email };
}

export async function markNotificationRead(formData: FormData) {
  const id = str(formData, "id");
  await query("update notifications set read_at = now() where id=$1", [id]);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllNotificationsRead() {
  await query("update notifications set read_at = now() where read_at is null");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
