"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { OTP_GATE_ENABLED, MAX_PRICE_EDITS, SITE_URL, BOOKING_CONFIRMATION_WINDOW_HOURS, ICLOUD_CHECK_PRICE_PESOS } from "@/lib/config";
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
  getDeviceModels,
  getServicePrices,
  getRequests,
  getRequestById,
  getRequestsByConfirmationToken,
  getRequestsByBookingGroup,
  getRepairRecordById,
  getServiceAgreements,
  getRepairRecordStatus,
  getCustomFormFields,
  getCrmBroadcastRecipients,
  createCrmBroadcast,
  cancelCrmBroadcast,
  logActivity,
  notifyAdmins,
  notifyAdminsAboutWalkIn,
  notifyTechnician,
  canManageHomeServiceRequests,
  canDeleteHomeServiceRequests,
  canAccessCrm,
  canManageWalkIns,
  canWaiveServiceFee,
  canManageRepairPricing,
  getIcloudCheckById,
  createIcloudCheck,
  markIcloudCheckPaymentPending,
  claimIcloudCheckAsPaid,
  markIcloudCheckChecked,
  markIcloudCheckFailed,
  markIcloudCheckRefundNeeded,
  markHomeServiceDownpaymentPending,
  claimHomeServiceDownpaymentAsPaid,
  markRepairRecordQrPaymentPending,
  claimRepairRecordQrPaymentAsPaid,
  getTodayCheckIn,
} from "./db";
import { getCurrentUser, setSession, clearSession, requireRole } from "./auth";
import { sendRepairReceiptEmail, sendCancellationEmail, sendQuotationEmail, sendLeadReplyEmail, sendBroadcastEmail, sendWalkInOtpEmail, sendPublicQuoteEmail, emailConfigured } from "./email";
import { sendSms, sendOtpSms, smsConfigured, normalizePhone, getAccountStatus, type SmsAccountStatus } from "./sms";
import { SUNDAY_ONLY_PROVINCES, DOWNPAYMENT_PROVINCES, serviceFeeAmount } from "./homeServiceFees";
import { getRepairQuote } from "./servicePricing";
import { formatDate, isCheckInOpen } from "./format";
import { createCheckoutSession as createPaymongoCheckoutSession, paymongoConfigured } from "./paymongo";
import { checkIcloudStatus } from "./sickw";
import type {
  Role,
  LookupKind,
  CustomFieldType,
  ChecklistItem,
  ChecklistResult,
  ChecklistPhase,
  Expense,
  HomeServiceRequest,
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
  await setSession(user.id, formData.get("remember") === "on");
  await query("insert into login_logs (user_id, user_name, user_email, role) values ($1,$2,$3,$4)", [user.id, user.name, user.email, user.role]);
  redirect(user.role === "technician" ? "/technician" : "/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

// Marks a technician or branch admin as checked in at a branch for today —
// distinct from login_logs (see 0060_check_ins.sql). Silently no-ops on any
// invalid input rather than surfacing an error: the form only ever offers
// branches the account is actually allowed to check into, so a mismatch
// here means a stale page (already checked in elsewhere, or a branch the
// account lost access to since the page loaded) rather than a real error
// worth showing.
export async function checkIn(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && user.role !== "branch_admin")) return;
  if (!isCheckInOpen()) return; // branches open at 6:00 AM — see isCheckInOpen (lib/format.ts)

  const branchId = str(formData, "branchId");
  const branches = await getBranches();
  const branch = branches.find((b) => b.id === branchId && b.active);
  if (!branch) return;

  const allowed =
    user.role === "technician"
      ? (await getTechnicians()).find((t) => t.id === user.technicianId)?.branchIds.includes(branchId)
      : user.assignedBranchIds.length === 0 || user.assignedBranchIds.includes(branchId);
  if (!allowed) return;

  if (await getTodayCheckIn(user.id)) return; // already checked in today

  await query("insert into check_ins (user_id, user_name, role, branch_id, branch_name) values ($1,$2,$3,$4,$5)", [
    user.id,
    user.name,
    user.role,
    branch.id,
    branch.name,
  ]);
  revalidatePath(user.role === "technician" ? "/technician" : "/admin");
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
  const canAccessCrmFlag = role === "branch_admin" ? formData.get("canAccessCrm") === "on" : true;
  const canManageWalkInsFlag = role === "branch_admin" ? formData.get("canManageWalkIns") === "on" : true;
  const canWaiveServiceFeeFlag = role === "branch_admin" ? formData.get("canWaiveServiceFee") === "on" : true;
  const canManageRepairPricingFlag = role === "branch_admin" ? formData.get("canManageRepairPricing") === "on" : true;
  const phone = str(formData, "phone");
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
    "insert into users (name, email, password_hash, role, technician_id, assigned_branch_ids, can_manage_requests, can_delete_requests, can_view_all_branches, can_access_crm, can_manage_walkins, can_waive_service_fee, can_manage_repair_pricing, phone) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    [
      name,
      email,
      passwordHash,
      role,
      role === "technician" ? technicianId : null,
      assignedBranchIds,
      canManageRequests,
      canDeleteRequests,
      canViewAllBranches,
      canAccessCrmFlag,
      canManageWalkInsFlag,
      canWaiveServiceFeeFlag,
      canManageRepairPricingFlag,
      phone,
    ]
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
  const canAccessCrmFlag = role === "branch_admin" ? formData.get("canAccessCrm") === "on" : true;
  const canManageWalkInsFlag = role === "branch_admin" ? formData.get("canManageWalkIns") === "on" : true;
  const canWaiveServiceFeeFlag = role === "branch_admin" ? formData.get("canWaiveServiceFee") === "on" : true;
  const canManageRepairPricingFlag = role === "branch_admin" ? formData.get("canManageRepairPricing") === "on" : true;
  const phone = formData.has("phone") ? str(formData, "phone") : user.phone;

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
      "update users set name=$1, email=$2, password_hash=$3, role=$4, technician_id=$5, assigned_branch_ids=$6, can_manage_requests=$7, can_delete_requests=$8, can_view_all_branches=$9, can_access_crm=$10, can_manage_walkins=$11, can_waive_service_fee=$12, can_manage_repair_pricing=$13, phone=$14 where id=$15",
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
        canAccessCrmFlag,
        canManageWalkInsFlag,
        canWaiveServiceFeeFlag,
        canManageRepairPricingFlag,
        phone,
        userId,
      ]
    );
  } else {
    await query(
      "update users set name=$1, email=$2, role=$3, technician_id=$4, assigned_branch_ids=$5, can_manage_requests=$6, can_delete_requests=$7, can_view_all_branches=$8, can_access_crm=$9, can_manage_walkins=$10, can_waive_service_fee=$11, can_manage_repair_pricing=$12, phone=$13 where id=$14",
      [
        name,
        email || user.email,
        role,
        role === "technician" ? technicianId : null,
        assignedBranchIds,
        canManageRequests,
        canDeleteRequests,
        canViewAllBranches,
        canAccessCrmFlag,
        canManageWalkInsFlag,
        canWaiveServiceFeeFlag,
        canManageRepairPricingFlag,
        phone,
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
  // Branch name/address/contact number is shown across the public site — the
  // footer (every page, via the (site) layout), the Branches page, Contact
  // page, and every service-mode form's branch picker — so a branch edit
  // needs the whole public route group revalidated, not just /admin/branches.
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
}

export async function toggleBranchActive(formData: FormData) {
  const branchId = str(formData, "id");
  await query("update branches set active = not active where id=$1", [branchId]);
  revalidatePath("/admin/branches");
  revalidatePath("/", "layout");
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
  const user = await getCurrentUser();
  if (!canManageRepairPricing(user)) return;
  const name = str(formData, "name");
  const brandId = str(formData, "brandId");
  if (!name || !brandId) return;
  const count = await queryOne<{ n: number }>("select count(*)::int as n from device_models where brand_id=$1", [brandId]);
  await query("insert into device_models (brand_id, name, order_num) values ($1,$2,$3)", [brandId, name, count?.n ?? 0]);
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-prices");
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

// ---------- Repair Pricing (drives the automatic Home Service quotation) ----------

// One field per (device model x price cell) on the Repair Pricing page —
// named "price_<field>_<deviceModelId>". A blank value clears that price
// (deletes the row); anything else upserts it. Submitted as one bulk save
// rather than a save-per-cell, since the page can have ~150+ price cells.
const PRICE_CELLS = [
  { category: "battery", quality: "", field: "battery" },
  { category: "backhousing", quality: "", field: "backhousing" },
  { category: "back_camera", quality: "", field: "back_camera" },
  { category: "front_camera", quality: "", field: "front_camera" },
  { category: "camera_lens", quality: "", field: "camera_lens" },
  { category: "reglass", quality: "", field: "reglass" },
  { category: "charging_port", quality: "", field: "charging_port" },
  { category: "screen", quality: "high_quality", field: "screen_hq" },
  { category: "screen", quality: "original", field: "screen_orig" },
] as const;

export async function saveServicePrices(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageRepairPricing(user)) return;

  const [models, existing] = await Promise.all([getDeviceModels(), getServicePrices()]);
  const existingKey = (category: string, deviceModelId: string, quality: string) => `${category}|${deviceModelId}|${quality}`;
  const existingSet = new Set(existing.map((p) => existingKey(p.category, p.deviceModelId, p.quality)));

  for (const m of models) {
    for (const cell of PRICE_CELLS) {
      const raw = str(formData, `price_${cell.field}_${m.id}`);
      const key = existingKey(cell.category, m.id, cell.quality);
      if (!raw) {
        if (existingSet.has(key)) {
          await query("delete from service_prices where category=$1 and device_model_id=$2 and quality=$3", [cell.category, m.id, cell.quality]);
        }
        continue;
      }
      const price = Math.max(0, Number(raw) || 0);
      await query(
        `insert into service_prices (category, device_model_id, quality, price, updated_at) values ($1,$2,$3,$4,now())
         on conflict (category, device_model_id, quality) do update set price=$4, updated_at=now()`,
        [cell.category, m.id, cell.quality, price]
      );
    }
  }
  revalidatePath("/admin/service-prices");
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
      cta_banner_button_label = coalesce(nullif($10,''), cta_banner_button_label),
      facebook_url = $11
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
      str(formData, "facebookUrl"),
    ]
  );
  // facebookUrl backs a button in the (site) layout, shown on every public
  // page, not just "/" — revalidate the whole public route group so a
  // changed link takes effect everywhere immediately.
  revalidatePath("/", "layout");
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
      success_body = $6,
      near_area_enabled = $7,
      far_area_enabled = $8,
      far_area_contact_number = $9
     where id = 1`,
    [
      str(formData, "pageKicker"),
      str(formData, "pageTitle"),
      str(formData, "pageSubtitle"),
      str(formData, "submitButtonLabel"),
      str(formData, "successTitle"),
      str(formData, "successBody"),
      formData.get("nearAreaEnabled") === "on",
      formData.get("farAreaEnabled") === "on",
      str(formData, "farAreaContactNumber"),
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

  const cost = Math.max(0, Number(str(formData, "cost")) || 0);
  const partsCost = Math.max(0, Number(str(formData, "partsCost")) || 0);
  const laborCost = Math.max(0, Number(str(formData, "laborCost")) || 0);
  const otherExpenses = Math.max(0, Number(str(formData, "otherExpenses")) || 0);
  const serviceDate = str(formData, "serviceDate") || new Date().toISOString().slice(0, 10);

  // The reference number is the highest already-used number for this year,
  // plus one — not a row count, since deleteRepairRecord() can permanently
  // remove a row from the middle of the sequence and leave a row count that
  // undercounts references still in use (which a count-based number would
  // collide with on every attempt, not just a concurrent one). Retry with a
  // freshly computed reference on a unique-constraint collision to also
  // cover two submissions landing on the same number at the same time.
  const year = new Date().getFullYear();
  let reference = "";
  let record: { id: string } | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const max = await queryOne<{ n: number }>(
      "select coalesce(max(split_part(reference, '-', 3)::int), 0)::int as n from repair_records where reference like $1",
      [`REPAIR-${year}-%`]
    );
    reference = `REPAIR-${year}-${String((max?.n ?? 0) + 1).padStart(4, "0")}`;
    try {
      record = await queryOne<{ id: string }>(
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
      break;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
      if (code === "23505" && attempt < 5) continue;
      throw e;
    }
  }
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

// Staff-triggered: generates a PayMongo QR Ph checkout for this record's
// Cost, for a customer who'd rather pay online than in person. Unlike the
// public-facing startIcloudCheck/startHomeServiceDownpayment, this never
// redirects the caller (an admin, not the paying customer) — it just saves
// the checkout URL so the detail page can show it for staff to display or
// share. Re-generating while a session is already pending creates a fresh
// one (e.g. if the customer's QR expired), always priced off the record's
// current cost at the moment of generation.
export async function startRepairRecordQrPayment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin")) return;

  const recordId = str(formData, "id");
  const record = await getRepairRecordById(recordId);
  if (!record || record.cancelled || record.qrPaymentStatus === "paid") return;
  if (!record.cost || !paymongoConfigured()) return;

  let session: Awaited<ReturnType<typeof createPaymongoCheckoutSession>>;
  try {
    session = await createPaymongoCheckoutSession({
      metadata: { kind: "repair_record_payment", repairRecordId: recordId },
      amountPesos: record.cost,
      description: `Repair payment — ${record.reference}`,
      lineItemName: "Repair Payment",
      paymentMethodTypes: ["qrph"],
      // Not used to drive any UI state (this page always re-derives status
      // from the DB, with a fallback re-verification against PayMongo
      // directly) — just needs to be a valid URL for PayMongo's checkout.
      successUrl: `${SITE_URL}/admin/pos/${recordId}`,
      cancelUrl: `${SITE_URL}/admin/pos/${recordId}`,
    });
  } catch {
    return;
  }

  await markRepairRecordQrPaymentPending(recordId, session.id, session.checkoutUrl, record.cost);
  revalidatePath(`/admin/pos/${recordId}`);
}

// The only place a repair record's QR Ph payment is ever marked paid — see
// claimRepairRecordQrPaymentAsPaid's comment (lib/db.ts) for why. Called
// from both the PayMongo webhook and the POS detail page's own fallback
// re-verification, so either one racing ahead of the other is safe.
export async function processRepairRecordQrPayment(recordId: string, paymongoPaymentId: string) {
  const claimed = await claimRepairRecordQrPaymentAsPaid(recordId, paymongoPaymentId);
  if (claimed) {
    if (claimed.customerId) {
      await logActivity("customer", claimed.customerId, `Repair ${claimed.reference} paid online via QR Ph (₱${claimed.qrPaymentAmount})`, "System");
    }
    revalidatePath(`/admin/pos/${recordId}`);
    revalidatePath("/admin/pos");
  }
  return getRepairRecordById(recordId);
}

// Moves a repair record to Trash — unlike cancelling (which keeps the
// record for history, just excluded from revenue), this hides it from the
// normal POS list entirely, but it can still be restored from Trash. Only
// permanentlyDeleteRepairRecord actually erases it. Owner-only: a branch
// admin can cancel a mistaken entry, but only the owner can trash it
// outright.
export async function deleteRepairRecord(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const recordId = str(formData, "id");
  await query("update repair_records set deleted_at=now() where id=$1", [recordId]);
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/daily");
  revalidatePath("/admin/sales/technicians");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

export async function restoreRepairRecord(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const recordId = str(formData, "id");
  await query("update repair_records set deleted_at=null where id=$1", [recordId]);
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/daily");
  revalidatePath("/admin/sales/technicians");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

// Actually erases a trashed repair record — its checklists
// (service_agreements.repair_record_id cascades). Only reachable from
// Trash, so a record always passes through the reversible trash step first.
export async function permanentlyDeleteRepairRecord(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const recordId = str(formData, "id");
  await query("delete from repair_records where id=$1 and deleted_at is not null", [recordId]);
  revalidatePath("/admin/trash");
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

// ---------- Home Service Request: SMS OTP Verification ----------
// Anti-spam gate — a customer must prove they control the phone number
// they typed before the Home Service Request form can be submitted at
// all. One row per phone in otp_codes; a fresh send overwrites whatever
// was there before rather than accumulating history. Semaphore generates
// the actual code (its OTP-dedicated route) and hands it back in the send
// response — this just hashes and stores whatever it returns.

const OTP_TTL_MS = 10 * 60_000;
const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;

export type SendOtpResult = { ok: true } | { ok: false; error: string };

export async function sendHomeServiceOtp(phoneInput: string): Promise<SendOtpResult> {
  if (!isValidPhone(phoneInput)) return { ok: false, error: "Enter a valid PH mobile number first, e.g. 0917 123 4567." };
  if (!smsConfigured()) return { ok: false, error: "SMS verification is temporarily unavailable — please try again later." };
  const phone = normalizePhone(phoneInput);

  const existing = await queryOne<{ created_at: Date }>("select created_at from otp_codes where phone=$1", [phone]);
  if (existing && Date.now() - new Date(existing.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another code." };
  }

  let code: string;
  try {
    code = await sendOtpSms(phone);
  } catch {
    return { ok: false, error: "Couldn't send the verification SMS — please try again in a moment." };
  }
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await query(
    `insert into otp_codes (phone, code_hash, attempts, verified, expires_at, created_at)
     values ($1,$2,0,false,$3,now())
     on conflict (phone) do update set code_hash=$2, attempts=0, verified=false, expires_at=$3, created_at=now()`,
    [phone, codeHash, expiresAt]
  );
  return { ok: true };
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

export async function verifyHomeServiceOtp(phoneInput: string, codeInput: string): Promise<VerifyOtpResult> {
  const phone = normalizePhone(phoneInput);
  const code = codeInput.trim();
  const row = await queryOne<{ code_hash: string; attempts: number; expires_at: Date; verified: boolean }>(
    "select code_hash, attempts, expires_at, verified from otp_codes where phone=$1",
    [phone]
  );
  if (!row) return { ok: false, error: "Send a verification code first." };
  if (row.verified) return { ok: true };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code expired — request a new one." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts — request a new code." };

  const match = code.length > 0 && (await bcrypt.compare(code, row.code_hash));
  if (!match) {
    await query("update otp_codes set attempts = attempts + 1 where phone=$1", [phone]);
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  await query("update otp_codes set verified=true where phone=$1", [phone]);
  return { ok: true };
}

// ---------- Public Home Service Request ----------

export type SubmitResult =
  | { ok: true; references: string[]; downpaymentRequired: boolean; downpaymentAmount: number | null; confirmationUrl: string | null }
  | { ok: false; error: string };

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
  const barangay = str(formData, "barangay");
  const preferredDatetime = str(formData, "preferredDatetime");
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
  // A misconfigured/missing Semaphore key must never be able to take the
  // public request form down — the gate only actually applies once SMS
  // sending is really available.
  if (OTP_GATE_ENABLED && smsConfigured() && isActive("phone") && phone) {
    const otpRow = await queryOne<{ verified: boolean }>("select verified from otp_codes where phone=$1", [normalizePhone(phone)]);
    if (!otpRow?.verified) return { ok: false, error: "Please verify your phone number before submitting." };
  }
  if (isRequired("street") && !street) return { ok: false, error: `${label("street")} is required.` };
  if (isRequired("city") && !city) return { ok: false, error: `${label("city")} is required.` };
  if (isRequired("province") && !province) return { ok: false, error: `${label("province")} is required.` };
  // Barangay isn't an admin-configurable field like the others — it only
  // exists as part of either queue's Province -> City -> Barangay cascading
  // picker, so it's simply required whenever that picker is shown.
  if (isActive("province") && isActive("city") && !barangay) {
    return { ok: false, error: "Barangay is required." };
  }
  if (isRequired("landmark") && !landmark) return { ok: false, error: `${label("landmark")} is required.` };
  if (isRequired("datetime") && !preferredDatetime) return { ok: false, error: `${label("datetime")} is required.` };
  // Pampanga/Laguna/Batangas only get a home service visit once a week —
  // mirrors the min/step="7" restriction on the client's date picker, but
  // enforced here too since that's only a UI hint, not a real constraint.
  if (SUNDAY_ONLY_PROVINCES.has(province) && preferredDatetime && new Date(preferredDatetime).getUTCDay() !== 0) {
    return { ok: false, error: `${label("datetime")} must be a Sunday for ${province}.` };
  }

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

  const allLookups = await getLookups();
  const requestStatuses = allLookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  // Home Service Requests are no longer auto-assigned to a technician on
  // submission — every new request lands in the Unassigned queue for an
  // admin to triage and assign manually. Whenever an email was captured, it
  // first has to sit in "Pending Confirmation" until the customer clicks
  // the link in their quotation email (or the 2-hour window lapses and
  // the void-unconfirmed-requests cron cancels it) — only then is it truly
  // "Pending" and ready to assign. No email means no way to send that link,
  // so it skips straight to Pending as before. Laguna/Batangas/Pampanga
  // (DOWNPAYMENT_PROVINCES) always need confirmation regardless of email,
  // since those bookings can't be confirmed until their QR Ph down payment
  // clears — the pay link is shown on the success screen either way (see
  // HomeServiceForm), not only emailed. Whether confirmation is needed at
  // all is the same for every device in this booking — only each device's
  // own confirmation_token (below) needs to be distinct.
  const pendingStatus = requestStatuses.find((s) => s.label === "Pending") ?? requestStatuses[0];
  const pendingConfirmationStatus = requestStatuses.find((s) => s.label === "Pending Confirmation");
  const requiresDownpayment = DOWNPAYMENT_PROVINCES.has(province);
  const initialStatus = (email || requiresDownpayment) && pendingConfirmationStatus ? pendingConfirmationStatus : pendingStatus;
  const needsConfirmation = initialStatus.id === pendingConfirmationStatus?.id;
  // Only actually enforceable when needsConfirmation held true above (i.e.
  // a "Pending Confirmation" status exists) — otherwise there's no gate to
  // attach a down payment requirement to at all.
  const downpaymentActive = requiresDownpayment && needsConfirmation;
  const downpaymentAmount = downpaymentActive ? serviceFeeAmount(province, city) : null;
  const cancelledStatus = requestStatuses.find((s) => s.label === "Cancelled");

  // A customer can book several devices in one submission (the "+ Add
  // Another Device" repeater in HomeServiceForm.tsx) — everything above is
  // shared once across the booking; everything below is read per device
  // index (0-based, deviceCount total) and becomes its own
  // home_service_requests row, so each still gets its own independent
  // assignment, status, checklist, pricing, and confirmation email exactly
  // like a single-device booking always has.
  const deviceCount = Math.max(1, parseInt(str(formData, "deviceCount"), 10) || 1);

  type DeviceInput = {
    validDeviceBrandId: string | null;
    validDeviceModelId: string | null;
    finalDeviceOther: string;
    validServiceTypeId: string | null;
    serviceTypeLabel: string;
    issueDescription: string;
    photoDataUrl: string | null;
    screenQuality: string;
    backHousingColor: string;
  };
  const devices: DeviceInput[] = [];

  for (let i = 0; i < deviceCount; i++) {
    const n = deviceCount > 1 ? ` (Device ${i + 1})` : "";
    const deviceBrandId = str(formData, `deviceBrandId_${i}`);
    const deviceModelId = str(formData, `deviceModelId_${i}`);
    const deviceOther = str(formData, `deviceOther_${i}`);
    const serviceTypeId = str(formData, `serviceTypeId_${i}`);
    const issueDescription = str(formData, `issueDescription_${i}`);
    const photoDataUrlRaw = str(formData, `photoDataUrl_${i}`);
    const photoDataUrl = photoDataUrlRaw.startsWith("data:image/") ? photoDataUrlRaw : null;
    const screenQuality = str(formData, `screenQuality_${i}`);
    const backHousingColor = str(formData, `backHousingColor_${i}`);

    if (isRequired("device_brand") && !deviceBrandId) return { ok: false, error: `${label("device_brand")} is required.${n}` };
    if (isRequired("device_model") && !deviceModelId && !deviceOther) return { ok: false, error: `${label("device_model")} is required.${n}` };
    if (isRequired("service_type") && !serviceTypeId) return { ok: false, error: `${label("service_type")} is required.${n}` };
    if (isRequired("issue") && !issueDescription) return { ok: false, error: `${label("issue")} is required.${n}` };
    if (isRequired("photo") && !photoDataUrl) return { ok: false, error: `${label("photo")} is required.${n}` };

    const selectedServiceType = allLookups.find((l) => l.id === serviceTypeId);
    if (selectedServiceType?.label === "Screen Repair" && screenQuality !== "original" && screenQuality !== "high_quality") {
      return { ok: false, error: `Please choose Original or High Quality for the screen repair.${n}` };
    }
    if (selectedServiceType?.label === "Back Housing (whole shell)" && !backHousingColor) {
      return { ok: false, error: `Please specify the back housing color you want.${n}` };
    }

    // device_brand_id and service_type_id are foreign keys to the lookups
    // table, but Admin > Request Form lets either field's type be switched
    // away from "select" to a plain text input — a customer can then type
    // anything (e.g. "apple" lowercase, a typo, a brand we don't stock) into
    // what the DB expects to be a UUID. Fall back to storing that text where
    // it's actually usable instead of failing the whole submission.
    const validDeviceBrandId = UUID_RE.test(deviceBrandId) ? deviceBrandId : null;
    const validDeviceModelId = UUID_RE.test(deviceModelId) ? deviceModelId : null;
    const validServiceTypeId = UUID_RE.test(serviceTypeId) ? serviceTypeId : null;
    const finalDeviceOther = deviceBrandId && !validDeviceBrandId ? [deviceBrandId, deviceOther].filter(Boolean).join(" ") : deviceOther;

    // Guard against accidental double booking — a double-tapped Submit
    // button, or a customer resubmitting because they weren't sure the
    // first one went through — by blocking a second non-cancelled request
    // for the same phone, device, and preferred day instead of silently
    // creating a duplicate job. Skipped when no preferred date was
    // collected at all, since there's nothing to disambiguate by then.
    if (phone) {
      const duplicate = await queryOne<{ id: string }>(
        `select id from home_service_requests
         where phone = $1
           and device_brand_id is not distinct from $2
           and device_model_id is not distinct from $3
           and device_other = $4
           and status_id is distinct from $5
           and ($6::date is null or preferred_datetime::date = $6::date)
           and deleted_at is null
         limit 1`,
        [phone, validDeviceBrandId, validDeviceModelId, finalDeviceOther, cancelledStatus?.id ?? null, preferredDatetime || null]
      );
      if (duplicate) {
        return {
          ok: false,
          error: `You already have a request for this device on this date.${n} Please wait for us to process it, or contact us if you'd like to make changes.`,
        };
      }
    }

    devices.push({
      validDeviceBrandId,
      validDeviceModelId,
      finalDeviceOther,
      validServiceTypeId,
      serviceTypeLabel: selectedServiceType?.label ?? "",
      issueDescription,
      photoDataUrl,
      screenQuality: selectedServiceType?.label === "Screen Repair" ? screenQuality : "",
      backHousingColor: selectedServiceType?.label === "Back Housing (whole shell)" ? backHousingColor : "",
    });
  }

  // Only dedupe/create a customer record when there's a name or phone to
  // identify one by — both fields can be switched off entirely. Shared
  // across every device in this booking, so it's created at most once here.
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

  const now = new Date().toISOString();
  const lat = str(formData, "lat") ? Number(str(formData, "lat")) : null;
  const lng = str(formData, "lng") ? Number(str(formData, "lng")) : null;
  const year = new Date().getFullYear();

  // The reference number is the highest already-used number for this year,
  // plus one — not a row count, since deleting a request (canDeleteHomeServiceRequests)
  // can permanently remove a row from the middle of the sequence and leave a
  // row count that undercounts references still in use (which a
  // count-based number would collide with on every attempt, not just a
  // concurrent one — this is what actually broke the public form on
  // 2026-09-14). Recomputed fresh and retried on a unique-constraint
  // collision to also cover two submissions (or two devices in the same
  // submission) landing on the same number at the same time. Mirrors
  // createRepairRecordDraft's fix for the same bug on repair_records.
  // One confirmation token/expiry for the whole booking — every device's
  // row shares it, so the single combined quotation email's one "Confirm
  // My Booking" link confirms all of them together (see confirmBooking()).
  const confirmationToken = needsConfirmation ? crypto.randomUUID() : null;
  const confirmationExpiresAt = needsConfirmation
    ? new Date(Date.now() + BOOKING_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    : null;
  // Every device's row shares this too, always (not just multi-device
  // bookings) — it's how reassignRequest() knows which other rows to
  // cascade a technician assignment to, since one technician does the
  // whole visit to one address regardless of how many devices are on it.
  const bookingGroupId = crypto.randomUUID();

  const createdRequests: { id: string; reference: string; device: DeviceInput }[] = [];
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const statusHistory = [{ statusId: initialStatus.id, at: now }];

    let created: { id: string } | null = null;
    let reference = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const max = await queryOne<{ n: number }>(
        "select coalesce(max(split_part(reference, '-', 3)::int), 0)::int as n from home_service_requests where reference like $1",
        [`HSR-${year}-%`]
      );
      reference = `HSR-${year}-${String((max?.n ?? 0) + 1).padStart(4, "0")}`;
      try {
        created = await queryOne<{ id: string }>(
          `insert into home_service_requests (
            reference, customer_id, customer_name, phone, email, device_brand_id, device_model_id, device_other, service_type_id,
            issue_description, photo_data_url, street, landmark, province, city, barangay, lat, lng, preferred_datetime,
            status_id, status_history, custom_fields, vlog_consent, vlog_blur_preference, screen_quality, back_housing_color,
            assigned_technician_id, auto_assigned, branch_id, queue_branch_id, confirmation_token, confirmation_expires_at, booking_group_id,
            downpayment_required, downpayment_amount, downpayment_status
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
          returning id`,
          [
            reference,
            customerId,
            name,
            phone,
            email,
            d.validDeviceBrandId,
            d.validDeviceModelId,
            d.finalDeviceOther,
            d.validServiceTypeId,
            d.issueDescription,
            d.photoDataUrl,
            street,
            landmark,
            province,
            city,
            barangay,
            lat,
            lng,
            preferredDatetime || null,
            initialStatus.id,
            JSON.stringify(statusHistory),
            JSON.stringify(customFields),
            vlogConsent,
            vlogBlurPreference,
            d.screenQuality,
            d.backHousingColor,
            null,
            false,
            null,
            queueBranch?.id ?? null,
            confirmationToken,
            confirmationExpiresAt,
            bookingGroupId,
            downpaymentActive,
            downpaymentAmount,
            downpaymentActive ? "pending" : "not_required",
          ]
        );
        break;
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
        if (code === "23505" && attempt < 5) continue;
        throw err;
      }
    }
    createdRequests.push({ id: created!.id, reference, device: d });
  }

  const referenceList = createdRequests.map((r) => r.reference).join(", ");
  let smsNote = "";
  if (phone && smsConfigured()) {
    const confirmMessage =
      createdRequests.length > 1
        ? `Hi ${name || "there"}, your Ceejay repair requests ${referenceList} have been received! Please check your email and tap Confirm within ${BOOKING_CONFIRMATION_WINDOW_HOURS} hours to keep your booking, or it will be automatically cancelled.`
        : `Hi ${name || "there"}, your Ceejay repair request ${referenceList} has been received! Please check your email and tap Confirm within ${BOOKING_CONFIRMATION_WINDOW_HOURS} hours to keep your booking, or it will be automatically cancelled.`;
    try {
      await sendSms(phone, confirmMessage);
      smsNote = ` — confirmation SMS sent to ${phone}`;
    } catch (err) {
      smsNote = ` — confirmation SMS failed to send to ${phone} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }

  // Automatic quotation email — best-effort, same as the SMS confirmation
  // above: a missing RESEND_API_KEY, an unmatched device/service (no price
  // on file), or any other failure here must never block the request
  // itself from saving, so this always falls through to logActivity below.
  // One combined email for the whole booking, not one per device — the
  // service fee is for the technician's single visit to one address, so it
  // must only ever appear (and be charged) once, no matter how many
  // devices are in the booking; each device still gets its own line with
  // its own estimated repair cost.
  const address = [street, barangay, city, province].filter(Boolean).join(", ") || "Not specified";
  const serviceFee = serviceFeeAmount(province, city);
  let quoteNote = "";
  if (email) {
    try {
      const [deviceModels, servicePrices] = await Promise.all([getDeviceModels(), getServicePrices()]);
      const quotationDevices = createdRequests.map((cr) => {
        const brand = allLookups.find((l) => l.id === cr.device.validDeviceBrandId);
        const deviceModel = deviceModels.find((m) => m.id === cr.device.validDeviceModelId);
        const deviceLabel = brand ? `${brand.label} ${deviceModel?.name ?? ""}`.trim() : cr.device.finalDeviceOther || "Not specified";
        const repairCost = cr.device.serviceTypeLabel
          ? getRepairQuote(servicePrices, cr.device.serviceTypeLabel, cr.device.validDeviceModelId ?? "", cr.device.screenQuality)
          : null;
        return {
          reference: cr.reference,
          deviceLabel,
          serviceType: cr.device.serviceTypeLabel || "Not specified",
          issueDescription: cr.device.issueDescription || "—",
          repairCost,
        };
      });
      await sendQuotationEmail(email, {
        customerName: name || "Customer",
        referenceList,
        requestDate: formatDate(now),
        devices: quotationDevices,
        preferredDate: preferredDatetime ? formatDate(preferredDatetime) : "To be confirmed",
        address,
        serviceFee,
        confirmationUrl: confirmationToken ? `${SITE_URL}/confirm-booking/${confirmationToken}` : null,
        confirmationWindowHours: BOOKING_CONFIRMATION_WINDOW_HOURS,
        downpaymentRequired: downpaymentActive,
        downpaymentAmount,
      });
      quoteNote = " — quotation emailed";
    } catch (err) {
      quoteNote = ` — quotation email failed to send (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }

  for (const cr of createdRequests) {
    await logActivity(
      "home_service_request",
      cr.id,
      `Request ${cr.reference} submitted and sent to the Unassigned queue for triage${smsNote}${quoteNote}`,
      "System"
    );
    await notifyAdmins(
      "new_request",
      cr.id,
      needsConfirmation
        ? `${name || "A customer"} submitted a new Home Service Request ${cr.reference} — awaiting their confirmation email click.`
        : `${name || "A customer"} submitted a new Home Service Request ${cr.reference} — now in the Unassigned queue.`
    );
  }

  if (phone) await query("delete from otp_codes where phone=$1", [normalizePhone(phone)]);

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return {
    ok: true,
    references: createdRequests.map((r) => r.reference),
    downpaymentRequired: downpaymentActive,
    downpaymentAmount,
    confirmationUrl: confirmationToken ? `${SITE_URL}/confirm-booking/${confirmationToken}` : null,
  };
}

export type ConfirmBookingResult =
  | { ok: true; references: string[]; alreadyConfirmed: boolean }
  | { ok: false; error: "not_found" | "expired" | "downpayment_required" };

// Shared by confirmBooking (the customer clicking "Confirm My Booking")
// and processHomeServiceDownpayment (the down payment clearing, which IS
// the confirmation step for DOWNPAYMENT_PROVINCES bookings) — moves every
// row in the group from "Pending Confirmation" to "Pending" (ready for an
// admin to assign). Idempotent: skips any row already confirmed, since
// email clients/scanners sometimes pre-fetch links and a customer might
// click twice, or the webhook and a fallback re-verification might race.
async function confirmBookingRows(reqs: HomeServiceRequest[]): Promise<ConfirmBookingResult> {
  const lookups = await getLookups();
  const pendingStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Pending");
  const now = new Date().toISOString();

  for (const req of reqs) {
    if (req.confirmedAt) continue;
    const statusHistory = pendingStatus ? [...req.statusHistory, { statusId: pendingStatus.id, at: now }] : req.statusHistory;
    await query(
      `update home_service_requests set confirmed_at=now()${pendingStatus ? ", status_id=$2, status_history=$3" : ""} where id=$1`,
      pendingStatus ? [req.id, pendingStatus.id, JSON.stringify(statusHistory)] : [req.id]
    );
    await logActivity("home_service_request", req.id, `Request ${req.reference} confirmed by customer — moved to the Unassigned queue`, "System");
    await notifyAdmins("new_request", req.id, `${req.customerName || "A customer"} confirmed Home Service Request ${req.reference} — now in the Unassigned queue.`);
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return { ok: true, references: reqs.map((r) => r.reference), alreadyConfirmed: false };
}

// Called from the public confirm-booking page when the customer clicks the
// link in their quotation email (or, for a booking with no email, the link
// shown on the submission success screen). A multi-device booking shares
// one confirmation_token across every device's row (one link confirms all
// of them together).
export async function confirmBooking(token: string): Promise<ConfirmBookingResult> {
  const reqs = await getRequestsByConfirmationToken(token);
  if (reqs.length === 0) return { ok: false, error: "not_found" };
  if (reqs.every((r) => r.confirmedAt)) return { ok: true, references: reqs.map((r) => r.reference), alreadyConfirmed: true };
  const first = reqs[0];
  if (!first.confirmationExpiresAt || new Date(first.confirmationExpiresAt).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  // Laguna/Batangas/Pampanga bookings can't be confirmed by clicking alone
  // — the QR Ph down payment has to clear first (see
  // startHomeServiceDownpayment/processHomeServiceDownpayment below), and
  // clearing it performs the confirmation itself. The confirm-booking page
  // never shows this button until the down payment is paid, but this
  // guards the server action too in case of a stale page or a direct call.
  if (first.downpaymentRequired && first.downpaymentStatus !== "paid") {
    return { ok: false, error: "downpayment_required" };
  }

  return confirmBookingRows(reqs);
}

export type StartHomeServiceDownpaymentResult = { ok: false; error: string };

// Sends the customer to PayMongo's QR Ph checkout for a
// DOWNPAYMENT_PROVINCES booking's down payment — called from the
// confirm-booking page's "Pay Down Payment" button. Mirrors
// startIcloudCheck's shape: creates the session, stashes it, and redirects.
export async function startHomeServiceDownpayment(token: string): Promise<StartHomeServiceDownpaymentResult> {
  const reqs = await getRequestsByConfirmationToken(token);
  if (reqs.length === 0) return { ok: false, error: "We couldn't find this booking — the link may be invalid." };
  const first = reqs[0];
  if (!first.downpaymentRequired || first.downpaymentStatus === "paid") {
    return { ok: false, error: "No down payment is due for this booking." };
  }
  if (!first.confirmationExpiresAt || new Date(first.confirmationExpiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This booking's confirmation window has expired." };
  }
  if (!first.downpaymentAmount) {
    return { ok: false, error: "This booking has no down payment amount on file — please contact us." };
  }
  if (!paymongoConfigured()) {
    return { ok: false, error: "Online payment isn't available right now — please try again later." };
  }

  let session: Awaited<ReturnType<typeof createPaymongoCheckoutSession>>;
  try {
    session = await createPaymongoCheckoutSession({
      metadata: { kind: "home_service_downpayment", token },
      amountPesos: first.downpaymentAmount,
      description: `Home Service down payment — ${reqs.map((r) => r.reference).join(", ")}`,
      lineItemName: "Home Service Down Payment",
      paymentMethodTypes: ["qrph"],
      // Both point back to the same confirm-booking page — it always
      // re-derives payment status from the DB (with a fallback
      // re-verification against PayMongo directly), never trusting the
      // URL the browser happened to land on.
      successUrl: `${SITE_URL}/confirm-booking/${token}`,
      cancelUrl: `${SITE_URL}/confirm-booking/${token}`,
    });
  } catch {
    return { ok: false, error: "Couldn't start the payment — please try again in a moment." };
  }

  await markHomeServiceDownpaymentPending(token, session.id, session.checkoutUrl);
  redirect(session.checkoutUrl);
}

// The only place a Home Service down payment is ever marked paid — see
// claimHomeServiceDownpaymentAsPaid's comment (lib/db.ts) for why. Called
// from both the PayMongo webhook (app/api/webhooks/paymongo/route.ts) and
// the confirm-booking page's own fallback re-verification, so either one
// racing ahead of the other is safe.
export async function processHomeServiceDownpayment(token: string, paymongoPaymentId: string) {
  const claimed = await claimHomeServiceDownpaymentAsPaid(token, paymongoPaymentId);
  if (claimed.length === 0) {
    // Already claimed (duplicate webhook delivery, or the other caller won
    // the race) — do NOT confirm again, just report current state.
    return getRequestsByConfirmationToken(token);
  }

  // Edge case: the 2-hour confirmation window lapsed and the
  // void-unconfirmed-requests cron already auto-cancelled this booking
  // between the customer starting checkout and PayMongo confirming
  // payment. Record the payment (already done above) but don't revive a
  // cancelled booking — flag it for a human to sort out (refund or manual
  // re-confirm) instead.
  if (claimed.some((r) => r.deletedAt)) {
    for (const r of claimed) {
      await logActivity(
        "home_service_request",
        r.id,
        `Down payment received for ${r.reference} after the booking was already auto-cancelled — needs manual review (refund or re-confirm).`,
        "System"
      );
      await notifyAdmins("new_request", r.id, `Down payment received for ${r.reference} after auto-cancellation — needs manual review.`);
    }
    return claimed;
  }

  await confirmBookingRows(claimed);
  return getRequestsByConfirmationToken(token);
}

// ---------- Public Contact Form ----------

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContactInquiry(_prev: ContactResult | undefined, formData: FormData): Promise<ContactResult> {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const message = str(formData, "message");
  const branchId = str(formData, "branchId") || null;

  if (!name || !message || (!phone && !email)) {
    return { ok: false, error: "Please share your name, a way to reach you (phone or email), and your message." };
  }
  if (phone && !isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid PH mobile number, e.g. 0917 123 4567." };
  }
  if (!branchId) {
    return { ok: false, error: "Please select which branch you're asking about." };
  }

  const lookups = await getLookups();
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead = await queryOne<{ id: string }>(
    "insert into leads (name, phone, email, source, status_id, notes, branch_id) values ($1,$2,$3,'Website',$4,$5,$6) returning id",
    [name, phone, email, leadStatuses[0]?.id ?? null, message, branchId]
  );
  await logActivity("lead", lead!.id, "Inquiry submitted via website contact form", "System");
  revalidatePath("/admin/crm");
  return { ok: true };
}

// ---------- Public Quotation Tool ----------

// The price list (Admin > Settings > Repair Pricing) is owner/admin-private
// — the only place a customer ever sees a number from it is inside their
// own emailed quotation — so the public /quote page can't be handed the
// raw service_prices rows to check client-side. This is the one server
// round-trip it makes while stepping through the wizard: given a device
// model + repair type (+ screen quality), say ONLY whether a price exists,
// never the price itself, so the page can decide whether to continue to
// the service-mode step or show the "contact a branch" fallback.
export async function checkQuoteAvailability(deviceModelId: string, serviceTypeId: string, screenQuality?: string): Promise<{ matched: boolean }> {
  if (!deviceModelId || !serviceTypeId) return { matched: false };
  const [lookups, prices] = await Promise.all([getLookups(), getServicePrices()]);
  const serviceType = lookups.find((l) => l.id === serviceTypeId && l.kind === "service_type");
  if (!serviceType) return { matched: false };
  return { matched: getRepairQuote(prices, serviceType.label, deviceModelId, screenQuality) !== null };
}

export type PublicQuoteResult = { ok: true } | { ok: false; error: string };

// Deliberately stateless — no lead/record is created, matching the "email
// only" spec: this recomputes the price server-side (never trusts a
// client-submitted number) and emails it, nothing is shown on screen or
// persisted anywhere.
export async function submitPublicQuote(_prev: PublicQuoteResult | undefined, formData: FormData): Promise<PublicQuoteResult> {
  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const deviceBrandId = str(formData, "deviceBrandId");
  const deviceModelId = str(formData, "deviceModelId");
  const serviceTypeId = str(formData, "serviceTypeId");
  const screenQuality = str(formData, "screenQuality");
  const serviceMode = str(formData, "serviceMode");
  const branchId = str(formData, "branchId") || null;
  const street = str(formData, "street");
  const barangay = str(formData, "barangay");
  const city = str(formData, "city");
  const province = str(formData, "province");

  if (!email || !isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!phone || !isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid PH mobile number, e.g. 0917 123 4567." };
  }
  if (!deviceBrandId || !deviceModelId || !serviceTypeId) {
    return { ok: false, error: "Please complete the device and repair type selection." };
  }
  if (serviceMode !== "walk_in" && serviceMode !== "home_service") {
    return { ok: false, error: "Please choose Walk-in or Home Service." };
  }
  if (serviceMode === "walk_in" && !branchId) {
    return { ok: false, error: "Please select which branch you'd like to visit." };
  }
  if (serviceMode === "home_service" && (!street || !city || !province)) {
    return { ok: false, error: "Please complete your address." };
  }

  const [lookups, deviceModels, prices, branches] = await Promise.all([getLookups(), getDeviceModels(), getServicePrices(), getBranches()]);
  const brand = lookups.find((l) => l.id === deviceBrandId && l.kind === "device_brand");
  const model = deviceModels.find((m) => m.id === deviceModelId);
  const serviceType = lookups.find((l) => l.id === serviceTypeId && l.kind === "service_type");
  if (!brand || !model || !serviceType) {
    return { ok: false, error: "Something went wrong with your submission. Please try again." };
  }

  const repairCost = getRepairQuote(prices, serviceType.label, deviceModelId, screenQuality);
  if (repairCost === null) {
    return { ok: false, error: "Sorry, we don't have a price on file for that combination — please contact a branch directly." };
  }
  const deviceLabel = `${brand.label} ${model.name}`.trim();

  let serviceFee: number | null = null;
  let branchName: string | undefined;
  let address: string | undefined;
  if (serviceMode === "home_service") {
    serviceFee = serviceFeeAmount(province, city);
    address = [street, barangay ? `Brgy. ${barangay}` : null, city, province].filter(Boolean).join(", ");
  } else {
    const branch = branches.find((b) => b.id === branchId && b.active);
    if (!branch) return { ok: false, error: "Please select a valid branch." };
    branchName = branch.name;
  }

  await sendPublicQuoteEmail(email, {
    customerName: name,
    deviceLabel,
    serviceTypeLabel: serviceType.label,
    screenQuality: screenQuality || undefined,
    repairCost,
    serviceMode,
    branchName,
    address,
    serviceFee,
  });

  return { ok: true };
}

// ---------- Walk-In Registration: Email OTP Verification ----------
// Anti-spam gate — a customer must prove they control the email address
// they typed before the Walk-In pre-registration form can be submitted at
// all. Mirrors Home Service Requests' phone-based OTP gate
// (sendHomeServiceOtp/verifyHomeServiceOtp) in shape and UX, but keyed by
// email in its own table (email_otp_codes) since Walk-In verifies email,
// not phone. Unlike Semaphore's dedicated OTP route (which generates the
// code for us), Resend is plain transactional email, so this generates and
// hashes its own 6-digit code.

const WALKIN_OTP_TTL_MS = 10 * 60_000;
const WALKIN_OTP_RESEND_COOLDOWN_MS = 60_000;
const WALKIN_OTP_MAX_ATTEMPTS = 5;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendWalkInOtp(emailInput: string): Promise<SendOtpResult> {
  const email = emailInput.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address first." };
  if (!emailConfigured()) return { ok: false, error: "Email verification is temporarily unavailable — please try again later." };

  const existing = await queryOne<{ created_at: Date }>("select created_at from email_otp_codes where email=$1", [email]);
  if (existing && Date.now() - new Date(existing.created_at).getTime() < WALKIN_OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another code." };
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + WALKIN_OTP_TTL_MS).toISOString();

  await query(
    `insert into email_otp_codes (email, code_hash, attempts, verified, expires_at, created_at)
     values ($1,$2,0,false,$3,now())
     on conflict (email) do update set code_hash=$2, attempts=0, verified=false, expires_at=$3, created_at=now()`,
    [email, codeHash, expiresAt]
  );

  try {
    await sendWalkInOtpEmail(email, code);
  } catch {
    return { ok: false, error: "Couldn't send the verification email — please try again in a moment." };
  }
  return { ok: true };
}

export async function verifyWalkInOtp(emailInput: string, codeInput: string): Promise<VerifyOtpResult> {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim();
  const row = await queryOne<{ code_hash: string; attempts: number; expires_at: Date; verified: boolean }>(
    "select code_hash, attempts, expires_at, verified from email_otp_codes where email=$1",
    [email]
  );
  if (!row) return { ok: false, error: "Send a verification code first." };
  if (row.verified) return { ok: true };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code expired — request a new one." };
  if (row.attempts >= WALKIN_OTP_MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts — request a new code." };

  const match = code.length > 0 && (await bcrypt.compare(code, row.code_hash));
  if (!match) {
    await query("update email_otp_codes set attempts = attempts + 1 where email=$1", [email]);
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  await query("update email_otp_codes set verified=true where email=$1", [email]);
  return { ok: true };
}

export type WalkInResult = { ok: true; reference: string } | { ok: false; error: string };

// A lighter-weight cousin of submitHomeServiceRequest — a customer planning
// to bring their device into a branch in person, not booking a technician
// visit. No address/schedule/OTP/quotation-email machinery, just enough for
// the branch to know who's coming and what to expect. Lands in its own
// walkin_requests table (own reference number, own status pipeline) rather
// than as a Lead, so it's immediately visible to branch staff the same way
// Home Service Requests is, instead of being buried in the general CRM list.
export async function submitWalkInRequest(_prev: WalkInResult | undefined, formData: FormData): Promise<WalkInResult> {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const branchId = str(formData, "branchId") || null;
  const rawDeviceBrandId = str(formData, "deviceBrandId");
  const rawDeviceModelId = str(formData, "deviceModelId");
  const deviceOtherInput = str(formData, "deviceOther");
  const serviceTypeId = str(formData, "serviceTypeId") || null;
  const issue = str(formData, "issue");
  const preferredDate = str(formData, "preferredDate") || null;
  const photoDataUrlRaw = str(formData, "photoDataUrl");
  const photoDataUrl = photoDataUrlRaw.startsWith("data:image/") ? photoDataUrlRaw : null;

  if (!name || !phone) {
    return { ok: false, error: "Please share your name and mobile number." };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid PH mobile number, e.g. 0917 123 4567." };
  }
  if (!email) {
    return { ok: false, error: "Please share your email address." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  // A misconfigured/missing Resend key must never be able to take the
  // public form down — the gate only actually applies once email sending
  // is really available, same convention as Home Service's phone OTP gate.
  if (OTP_GATE_ENABLED && emailConfigured()) {
    const otpRow = await queryOne<{ verified: boolean }>("select verified from email_otp_codes where email=$1", [email.trim().toLowerCase()]);
    if (!otpRow?.verified) return { ok: false, error: "Please verify your email address before submitting." };
  }
  if (!branchId) {
    return { ok: false, error: "Please select which branch you plan to visit." };
  }
  if (!rawDeviceBrandId) {
    return { ok: false, error: "Please select your device brand." };
  }
  if (!issue) {
    return { ok: false, error: "Please briefly describe the issue." };
  }

  const [lookups, branches] = await Promise.all([getLookups(), getBranches()]);
  const walkInStatuses = lookups.filter((l) => l.kind === "walkin_status").sort((a, b) => a.order - b.order);
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) {
    return { ok: false, error: "Something went wrong with your submission. Please try again." };
  }
  // "Other — please specify" isn't a real lookup row — its <option value>
  // is the literal string "other" — so falls back to the free-typed
  // deviceOther text instead of failing the device_brand_id FK insert below.
  const validDeviceBrandId = UUID_RE.test(rawDeviceBrandId) ? rawDeviceBrandId : null;
  const deviceBrandId = validDeviceBrandId;
  const deviceModelId = validDeviceBrandId && UUID_RE.test(rawDeviceModelId) ? rawDeviceModelId : null;
  const deviceOther = deviceOtherInput;

  // Same max-based + retry-on-collision pattern used for repair_records and
  // home_service_requests — a plain count(*) undercounts once any row has
  // ever been deleted, causing every later insert to collide on the same
  // reference (the exact bug that once took down HSR submissions live).
  const year = new Date().getFullYear();
  let reference = "";
  let created: { id: string } | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const max = await queryOne<{ n: number }>(
      "select coalesce(max(split_part(reference, '-', 3)::int), 0)::int as n from walkin_requests where reference like $1",
      [`WI-${year}-%`]
    );
    reference = `WI-${year}-${String((max?.n ?? 0) + 1).padStart(4, "0")}`;
    try {
      created = await queryOne<{ id: string }>(
        `insert into walkin_requests
           (reference, name, phone, email, branch_id, device_brand_id, device_model_id, device_other, service_type_id, issue_description, photo_data_url, preferred_date, status_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [reference, name, phone, email, branchId, deviceBrandId, deviceModelId, deviceOther, serviceTypeId, issue, photoDataUrl, preferredDate, walkInStatuses[0]?.id ?? null]
      );
      break;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505" && attempt < 5) continue;
      throw err;
    }
  }

  await logActivity("walkin_request", created!.id, `Walk-in pre-registration ${reference} submitted via website for ${branch.name}`, "System");
  await notifyAdminsAboutWalkIn(created!.id, `${name || "A customer"} pre-registered for a walk-in visit ${reference} at ${branch.name}.`);
  // Same convention as Home Service's phone OTP cleanup — a submitted,
  // verified code has done its job and shouldn't linger for reuse.
  await query("delete from email_otp_codes where email=$1", [email.trim().toLowerCase()]);
  revalidatePath("/admin/walk-ins");
  revalidatePath("/admin");
  return { ok: true, reference };
}

// ---------- Admin: Walk-In Registrations ----------

export async function updateWalkInStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user)) return;
  const id = str(formData, "id");
  const statusId = str(formData, "statusId");
  const lookups = await getLookups();
  const status = lookups.find((l) => l.id === statusId);
  if (!status) return;
  await query("update walkin_requests set status_id=$1 where id=$2", [statusId, id]);
  await logActivity("walkin_request", id, `Status changed to "${status.label}" by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/walk-ins");
  revalidatePath(`/admin/walk-ins/${id}`);
}

// Soft delete — moves it to Trash rather than permanently deleting it,
// consistent with Home Service Requests and POS records. Requires both
// section access (canManageWalkIns) and the existing shared delete
// permission (canDeleteHomeServiceRequests), same layering as every other
// entity that flows through Trash.
export async function deleteWalkInRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user) || !canDeleteHomeServiceRequests(user)) return;
  const id = str(formData, "id");
  await query("update walkin_requests set deleted_at=now() where id=$1", [id]);
  await logActivity("walkin_request", id, `Moved to Trash by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/walk-ins");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

export async function restoreWalkInRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user) || !canDeleteHomeServiceRequests(user)) return;
  const id = str(formData, "id");
  await query("update walkin_requests set deleted_at=null where id=$1", [id]);
  await logActivity("walkin_request", id, `Restored from Trash by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/walk-ins");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

export async function permanentlyDeleteWalkInRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user) || !canDeleteHomeServiceRequests(user)) return;
  const id = str(formData, "id");
  await query("delete from walkin_requests where id=$1 and deleted_at is not null", [id]);
  revalidatePath("/admin/trash");
}

// ---------- Public: iCloud ON/OFF Checker ----------
// Public, paid (PayMongo) SICKW.com "iCloud ON/OFF" lookup — see the
// IcloudCheck doc comment in lib/types.ts for the full status state
// machine. startIcloudCheck below only ever creates the row and sends the
// customer to PayMongo; nothing here ever calls SICKW directly — that
// only happens inside processIcloudCheckPayment, which is only ever
// reached once claimIcloudCheckAsPaid's conditional UPDATE has actually
// confirmed payment (see that function's own comment in lib/db.ts).

const IMEI_RE = /^\d{14,16}$/;
const SERIAL_RE = /^[A-Z0-9]{8,12}$/;

export type StartIcloudCheckResult = { ok: false; error: string };

export async function startIcloudCheck(_prev: StartIcloudCheckResult | undefined, formData: FormData): Promise<StartIcloudCheckResult> {
  const imei = str(formData, "imei").toUpperCase();
  if (!IMEI_RE.test(imei) && !SERIAL_RE.test(imei)) {
    return { ok: false, error: "Enter a valid 14–16 digit IMEI, or an 8–12 character serial number." };
  }
  if (!paymongoConfigured()) {
    return { ok: false, error: "Online payment isn't available right now — please try again later." };
  }

  const hdrs = await headers();
  const customerIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const check = await createIcloudCheck(imei, customerIp);
  if (!check) return { ok: false, error: "Something went wrong — please try again." };

  let session: Awaited<ReturnType<typeof createPaymongoCheckoutSession>>;
  try {
    session = await createPaymongoCheckoutSession({
      metadata: { kind: "icloud_check", checkId: check.id },
      amountPesos: ICLOUD_CHECK_PRICE_PESOS,
      description: `iCloud ON/OFF check — ${imei}`,
      lineItemName: "iCloud Status Check",
      // Deliberately carries only the opaque check id, no payment/status
      // flag — landing on the result page proves nothing by itself, it
      // always re-derives status from the DB (see the result page).
      successUrl: `${SITE_URL}/check-icloud/result/${check.id}`,
      cancelUrl: `${SITE_URL}/check-icloud`,
    });
  } catch {
    return { ok: false, error: "Couldn't start the payment — please try again in a moment." };
  }

  await markIcloudCheckPaymentPending(check.id, session.id, session.checkoutUrl);
  redirect(session.checkoutUrl);
}

// The only place SICKW is ever called for a given payment — see
// claimIcloudCheckAsPaid's comment (lib/db.ts) for why. Called from both
// the PayMongo webhook (app/api/webhooks/paymongo/route.ts) and the
// result page's own fallback re-verification, so either one racing ahead
// of the other is safe.
export async function processIcloudCheckPayment(checkId: string, paymongoPaymentId: string) {
  const claimed = await claimIcloudCheckAsPaid(checkId, paymongoPaymentId);
  if (!claimed) {
    // Already claimed (duplicate webhook delivery, or the other caller
    // won the race) — do NOT call SICKW again, just report current state.
    return getIcloudCheckById(checkId);
  }

  const result = await checkIcloudStatus(claimed.imei);
  if (result.ok) {
    await markIcloudCheckChecked(claimed.id, result.icloudStatus, result.summary, result.rawResponse);
  } else {
    await markIcloudCheckFailed(claimed.id, result.error, result.rawResponse);
  }
  revalidatePath("/admin/tools/icloud-checks");
  return getIcloudCheckById(checkId);
}

// ---------- Admin: iCloud Status Checks (Tools) ----------

// Re-runs the SICKW call for a paid check that came back check_failed —
// never touches payment state or re-charges the customer, since they
// already paid; this is purely "the API call failed, try again."
export async function retryIcloudCheck(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = str(formData, "id");
  const check = await getIcloudCheckById(id);
  if (!check || check.status !== "check_failed") return;

  const result = await checkIcloudStatus(check.imei);
  if (result.ok) {
    await markIcloudCheckChecked(check.id, result.icloudStatus, result.summary, result.rawResponse);
  } else {
    await markIcloudCheckFailed(check.id, result.error, result.rawResponse);
  }
  revalidatePath("/admin/tools/icloud-checks");
}

// Bookkeeping only — this app has no automated refund flow, so the actual
// refund still happens by hand in the PayMongo dashboard. This just marks
// the row so it stops showing up as an unresolved check_failed.
export async function markIcloudRefundNeeded(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = str(formData, "id");
  const adminNote = str(formData, "adminNote");
  await markIcloudCheckRefundNeeded(id, adminNote);
  revalidatePath("/admin/tools/icloud-checks");
}

// ---------- Admin: Home Service Requests ----------

// Statuses a sibling request must NOT be in to get swept into a cascaded
// (re)assignment — once a technician has actually started or finished a
// device's job, or it's cancelled, silently reassigning it out from under
// that state would be wrong even though the rest of the booking is moving.
const CASCADE_EXCLUDED_STATUSES = new Set(["In Progress", "Completed", "Cancelled"]);

export async function reassignRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return;
  const requestId = str(formData, "id");
  const technicianId = str(formData, "technicianId") || null;
  const req = await getRequestById(requestId);
  if (!req) return;

  const technicians = await getTechnicians();
  const tech = technicianId ? technicians.find((t) => t.id === technicianId) : null;
  const lookups = await getLookups();
  const assignedStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Assigned");
  const statusLabel = (statusId: string) => lookups.find((l) => l.id === statusId)?.label ?? "";

  async function applyAssignment(target: HomeServiceRequest) {
    if (technicianId) {
      const nextBranchId = tech?.branchIds[0] ?? target.branchId;
      if (assignedStatus && target.statusId !== assignedStatus.id) {
        const statusHistory = [...target.statusHistory, { statusId: assignedStatus.id, at: new Date().toISOString() }];
        await query("update home_service_requests set assigned_technician_id=$1, auto_assigned=false, branch_id=$2, status_id=$3, status_history=$4 where id=$5", [
          technicianId,
          nextBranchId,
          assignedStatus.id,
          JSON.stringify(statusHistory),
          target.id,
        ]);
      } else {
        await query("update home_service_requests set assigned_technician_id=$1, auto_assigned=false, branch_id=$2 where id=$3", [
          technicianId,
          nextBranchId,
          target.id,
        ]);
      }
    } else {
      await query("update home_service_requests set assigned_technician_id=null, auto_assigned=false where id=$1", [target.id]);
    }
  }

  await applyAssignment(req);
  if (technicianId) {
    // SMS is reserved for the Home Service Request OTP/confirmation flow —
    // the assigned technician already gets a push notification
    // (notifyTechnician) and the customer isn't texted for every internal
    // assignment change.
    await logActivity(
      "home_service_request",
      req.id,
      `Manually reassigned to ${tech?.name ?? technicianId} by ${user?.name ?? "Admin"}`,
      user?.name ?? "Admin"
    );
    await notifyTechnician(technicianId, `New job assigned: ${req.reference} — ${req.customerName || "a customer"}`, "/technician");
  } else {
    await logActivity("home_service_request", req.id, `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  }

  // A technician does the whole visit to one address, so (re)assigning one
  // device in a multi-device booking cascades the same technician to every
  // other device in that booking still open enough to move (see
  // CASCADE_EXCLUDED_STATUSES) — same for clearing an assignment.
  if (req.bookingGroupId) {
    const siblings = (await getRequestsByBookingGroup(req.bookingGroupId)).filter(
      (s) => s.id !== req.id && !CASCADE_EXCLUDED_STATUSES.has(statusLabel(s.statusId))
    );
    for (const sibling of siblings) {
      await applyAssignment(sibling);
      await logActivity(
        "home_service_request",
        sibling.id,
        technicianId
          ? `Auto-${sibling.assignedTechnicianId ? "reassigned" : "assigned"} to ${tech?.name ?? technicianId} — same visit as ${req.reference}, updated by ${user?.name ?? "Admin"}`
          : `Unassigned — same visit as ${req.reference}, updated by ${user?.name ?? "Admin"}`,
        user?.name ?? "Admin"
      );
      revalidatePath(`/admin/requests/${sibling.id}`);
    }
  }

  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
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
  const cancelled = status.label === "Cancelled";
  if (cancelled) {
    // Cancelling auto-trashes the request (reversible from Trash) so it stops
    // cluttering the active queue; the linked Customer/CRM record is a
    // separate table and is never touched, so that history stays intact.
    await query(
      "update home_service_requests set status_id=$1, status_history=$2, deleted_at=now() where id=$3",
      [statusId, JSON.stringify(statusHistory), requestId]
    );
  } else {
    await query("update home_service_requests set status_id=$1, status_history=$2 where id=$3", [statusId, JSON.stringify(statusHistory), requestId]);
  }

  let emailNote = "";
  if (cancelled && req.email) {
    try {
      await sendCancellationEmail(req.email, { customerName: req.customerName, reference: req.reference, reason: "" });
      emailNote = ` — cancellation email sent to ${req.email}`;
    } catch (err) {
      emailNote = ` — cancellation email failed to send to ${req.email} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }
  await logActivity(
    "home_service_request",
    req.id,
    `Status changed to "${status.label}" by ${user?.name ?? "Admin"}${cancelled ? " — moved to Trash" : ""}${emailNote}`,
    user?.name ?? "Admin"
  );
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/technician");
  if (cancelled) {
    revalidatePath("/admin/pos");
    revalidatePath("/admin/sales/home-service");
    revalidatePath("/admin/sales/materials");
    revalidatePath("/admin/trash");
    revalidatePath("/admin");
  }
}

// Moves a home service request to Trash — hides it from the normal list,
// technician board, and sales reports, but it can still be restored from
// Trash. Only permanentlyDeleteHomeServiceRequest actually erases it.
// Manual "Move to Trash" (any status); changeRequestStatus/technicianUpdateStatus
// also auto-trash a request the moment its status becomes "Cancelled", so this
// is still gated by canDeleteHomeServiceRequests — owner admins always, branch
// admins only when explicitly granted (Staff Accounts).
export async function deleteHomeServiceRequest(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canDeleteHomeServiceRequests(actor)) return;

  const requestId = str(formData, "id");
  await query("update home_service_requests set deleted_at=now() where id=$1", [requestId]);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales/home-service");
  revalidatePath("/admin/sales/materials");
  revalidatePath("/technician");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

export async function restoreHomeServiceRequest(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canDeleteHomeServiceRequests(actor)) return;

  const requestId = str(formData, "id");
  await query("update home_service_requests set deleted_at=null where id=$1", [requestId]);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales/home-service");
  revalidatePath("/admin/sales/materials");
  revalidatePath("/technician");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

// Actually erases a trashed home service request — its checklists
// (service_agreements), notifications, and progress notes all cascade with
// it; any POS sale tied to it just loses that reference (kept, not
// deleted). Only reachable from Trash, so a request always passes through
// the reversible trash step first.
export async function permanentlyDeleteHomeServiceRequest(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canDeleteHomeServiceRequests(actor)) return;

  const requestId = str(formData, "id");
  await query("delete from home_service_requests where id=$1 and deleted_at is not null", [requestId]);
  revalidatePath("/admin/trash");
}

export async function updateRequestNotes(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return;
  const requestId = str(formData, "id");
  const notes = str(formData, "adminNotes");
  await query("update home_service_requests set admin_notes=$1 where id=$2", [notes, requestId]);
  revalidatePath(`/admin/requests/${requestId}`);
}

// Waives the flat per-visit Home Service fee for a request — the fee
// itself stays computed from province as always (lib/homeServiceFees.ts);
// this only marks that this request's copy should be treated as ₱0
// wherever it's quoted/displayed. A waiver record is created and lands
// straight in Trash (deleted_at set immediately) — Trash is the only
// place it's ever managed from afterward (Restore / Delete Permanently),
// and nothing about the waiver is shown on the request itself. Gated by
// the dedicated canWaiveServiceFee permission (independent of
// canManageRequests) on top of the section-level access every action on
// this page already requires.
export async function waiveServiceFee(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user) || !canWaiveServiceFee(user)) return;
  const requestId = str(formData, "id");
  const req = await getRequestById(requestId);
  if (!req || req.serviceFeeWaived) return;
  const amount = serviceFeeAmount(req.province, req.city) ?? 0;
  await query("update home_service_requests set service_fee_waived=true where id=$1", [requestId]);
  await query(
    `insert into service_fee_waivers (request_id, queue_branch_id, reference, customer_name, amount, waived_by, deleted_at)
     values ($1,$2,$3,$4,$5,$6,now())`,
    [requestId, req.queueBranchId, req.reference, req.customerName, amount, user?.name ?? "Admin"]
  );
  await logActivity("home_service_request", requestId, `Service fee waived by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/trash");
  revalidatePath("/technician");
}

// The only way to undo a waiver — from its entry in Trash. Un-waives the
// fee on the request and clears the waiver entry.
export async function restoreServiceFeeWaiver(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user) || !canWaiveServiceFee(user)) return;
  const id = str(formData, "id");
  const waiver = await queryOne<{ request_id: string }>("select request_id from service_fee_waivers where id=$1 and deleted_at is not null", [id]);
  if (!waiver) return;
  await query("update home_service_requests set service_fee_waived=false where id=$1", [waiver.request_id]);
  await query("delete from service_fee_waivers where id=$1", [id]);
  await logActivity("home_service_request", waiver.request_id, `Service fee restored (un-waived) by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath(`/admin/requests/${waiver.request_id}`);
  revalidatePath("/admin/trash");
  revalidatePath("/technician");
}

// Stops tracking a waiver — the fee stays waived on the request; this
// just clears the Trash entry, same "no more undo path" semantics as
// every other Delete Permanently action in this app.
export async function permanentlyDeleteServiceFeeWaiver(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user) || !canWaiveServiceFee(user)) return;
  const id = str(formData, "id");
  await query("delete from service_fee_waivers where id=$1 and deleted_at is not null", [id]);
  revalidatePath("/admin/trash");
}

// ---------- Sales: Business Expenses ----------

export async function createExpense(formData: FormData) {
  const actor = await requireRole("owner_admin", "branch_admin");
  if (!actor) return;

  const description = str(formData, "description");
  const amount = Math.max(0, Number(str(formData, "amount")) || 0);
  const target = str(formData, "target") as Expense["target"];
  const technicianName =
    target === "technician_final_total_sales" || target === "owner_total_sales" ? str(formData, "technicianName") || null : null;
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
  if (!canAccessCrm(user)) return;
  const name = str(formData, "name");
  if (!name) return;
  const lookups = await getLookups();
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead = await queryOne<{ id: string }>(
    "insert into leads (name, phone, email, source, status_id, assigned_to, follow_up_date, notes, branch_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [
      name,
      str(formData, "phone"),
      str(formData, "email"),
      str(formData, "source"),
      leadStatuses[0]?.id ?? null,
      user?.id ?? null,
      str(formData, "followUpDate") || null,
      str(formData, "notes"),
      str(formData, "branchId") || null,
    ]
  );
  await logActivity("lead", lead!.id, `Lead created by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
}

export async function updateLeadStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!canAccessCrm(user)) return;
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
  if (!canAccessCrm(user)) return;
  const leadId = str(formData, "id");
  const assignedTo = str(formData, "assignedTo") || null;
  const users = await getUsers();
  const assignee = users.find((u) => u.id === assignedTo);
  await query("update leads set assigned_to=$1 where id=$2", [assignedTo, leadId]);
  await logActivity("lead", leadId, assignee ? `Assigned to ${assignee.name} by ${user?.name ?? "Admin"}` : `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

const MAX_BROADCAST_PHOTOS = 4;

export type BroadcastResult =
  | { ok: true; scheduled: false; sent: number; failed: number; total: number }
  | { ok: true; scheduled: true; scheduledAt: string; total: number }
  | { ok: false; error: string };

// Announcements/promos go to every distinct email on file across leads and
// customers — deduped since a converted lead's email also appears on their
// customer record. Owner-admin only: this reaches people across every
// branch at once, unlike the rest of CRM which branch admins can touch
// within their own branch's leads.
//
// A blank "scheduledAt" sends immediately, same as before. A future
// "scheduledAt" instead queues a crm_broadcasts row with status "pending"
// and returns without sending anything — the send-scheduled-broadcasts
// cron (app/api/cron/send-scheduled-broadcasts) picks it up once due,
// recomputing the recipient list fresh at that time.
export async function sendCrmBroadcast(_prev: BroadcastResult | undefined, formData: FormData): Promise<BroadcastResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") return { ok: false, error: "Owner admin access required." };

  const subject = str(formData, "subject");
  const message = str(formData, "message");
  if (!subject || !message) return { ok: false, error: "Please provide both a subject and a message." };

  const photos = listStr(formData, "photos")
    .filter((p) => p.startsWith("data:image/"))
    .slice(0, MAX_BROADCAST_PHOTOS);

  const scheduledAtRaw = str(formData, "scheduledAt");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return { ok: false, error: "That schedule date/time isn't valid." };
  const isFutureSchedule = !!scheduledAt && scheduledAt.getTime() > Date.now();

  const recipients = await getCrmBroadcastRecipients();
  if (recipients.length === 0) return { ok: false, error: "No leads or customers have an email on file." };

  if (isFutureSchedule) {
    await createCrmBroadcast({
      subject,
      message,
      photos,
      scheduledAt,
      status: "pending",
      recipientEstimate: recipients.length,
      sentCount: 0,
      failedCount: 0,
      createdBy: user.name,
      sentAt: null,
    });
    revalidatePath("/admin/crm/broadcast");
    return { ok: true, scheduled: true, scheduledAt: scheduledAt!.toISOString(), total: recipients.length };
  }

  let sent = 0;
  let failed = 0;
  for (const email of recipients) {
    try {
      await sendBroadcastEmail(email, { subject, message, photos });
      sent++;
    } catch {
      failed++;
    }
  }

  await createCrmBroadcast({
    subject,
    message,
    photos,
    scheduledAt: null,
    status: failed === recipients.length ? "failed" : "sent",
    recipientEstimate: recipients.length,
    sentCount: sent,
    failedCount: failed,
    createdBy: user.name,
    sentAt: new Date(),
  });
  revalidatePath("/admin/crm/broadcast");

  return { ok: true, scheduled: false, sent, failed, total: recipients.length };
}

// Cancels a still-pending scheduled broadcast before the cron sends it —
// no-ops if it already sent (cancelCrmBroadcast only touches status='pending' rows).
export async function cancelScheduledBroadcast(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") return;
  const id = str(formData, "id");
  if (!id) return;
  await cancelCrmBroadcast(id);
  revalidatePath("/admin/crm/broadcast");
}

export async function addLeadNote(formData: FormData) {
  const user = await getCurrentUser();
  if (!canAccessCrm(user)) return;
  const leadId = str(formData, "id");
  const note = str(formData, "note");
  const followUpDate = str(formData, "followUpDate");
  const emailToCustomer = formData.has("emailToCustomer");
  if (!note) return;
  if (followUpDate) {
    await query("update leads set notes = notes || case when notes = '' then '' else E'\\n' end || $1, follow_up_date=$2 where id=$3", [note, followUpDate, leadId]);
  } else {
    await query("update leads set notes = notes || case when notes = '' then '' else E'\\n' end || $1 where id=$2", [note, leadId]);
  }

  let emailNote = "";
  if (emailToCustomer) {
    const lead = await queryOne<{ name: string; email: string }>("select name, email from leads where id=$1", [leadId]);
    if (lead?.email) {
      try {
        await sendLeadReplyEmail(lead.email, { customerName: lead.name, message: note });
        emailNote = ` — emailed to ${lead.email}`;
      } catch (err) {
        emailNote = ` — email failed to send to ${lead.email} (${err instanceof Error ? err.message : "unknown error"})`;
      }
    } else {
      emailNote = " — no email on file, not sent";
    }
  }

  await logActivity("lead", leadId, `Note added by ${user?.name ?? "Admin"}: ${note}${emailNote}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function convertLeadToCustomer(formData: FormData) {
  const user = await getCurrentUser();
  if (!canAccessCrm(user)) return;
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
  if (!canAccessCrm(user)) return;
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
  if (!canAccessCrm(user)) return;
  const customerId = str(formData, "id");
  const note = str(formData, "note");
  if (!note) return;
  await query("update customers set notes = notes || case when notes = '' then '' else E'\\n' end || $1 where id=$2", [note, customerId]);
  await logActivity("customer", customerId, `Note added by ${user?.name ?? "Admin"}: ${note}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${customerId}`);
}

// Logs one message into a lead/customer's Conversation thread — a
// chat-style timeline distinct from the single freeform "notes" field,
// so staff can record the actual back-and-forth (calls, texts, emails, or
// just a quick note) in order, not just a running summary blurb.
export async function addConversationMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!canAccessCrm(user)) return;
  const entityType = str(formData, "entityType");
  if (entityType !== "lead" && entityType !== "customer") return;
  const entityId = str(formData, "entityId");
  const message = str(formData, "message");
  if (!message) return;
  const direction = str(formData, "direction") === "inbound" ? "inbound" : "outbound";
  const channelRaw = str(formData, "channel");
  const channel = (["note", "call", "sms", "email", "chat"] as const).includes(channelRaw as never) ? channelRaw : "note";

  await query(
    "insert into conversations (entity_type, entity_id, channel, direction, message, staff_name) values ($1,$2,$3,$4,$5,$6)",
    [entityType, entityId, channel, direction, message, user?.name ?? "Staff"]
  );
  revalidatePath(`/admin/crm/${entityId}`);
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
  const cancelled = status.label === "Cancelled";
  // Cancelling auto-trashes the request (reversible from Trash); the linked
  // Customer/CRM record lives in a separate table and is untouched.
  await query(
    `update home_service_requests set status_id=$1, status_history=$2, admin_notes=$3${cancelled ? ", deleted_at=now()" : ""} where id=$4`,
    [statusId, JSON.stringify(statusHistory), adminNotes, requestId]
  );

  let emailNote = "";
  if (cancelled && req.email) {
    try {
      await sendCancellationEmail(req.email, { customerName: req.customerName, reference: req.reference, reason: note });
      emailNote = ` — cancellation email sent to ${req.email}`;
    } catch (err) {
      emailNote = ` — cancellation email failed to send to ${req.email} (${err instanceof Error ? err.message : "unknown error"})`;
    }
  }
  await logActivity(
    "home_service_request",
    req.id,
    `Status updated to "${status.label}" by technician ${user?.name ?? ""}${note ? ` — ${note}` : ""}${cancelled ? " — moved to Trash" : ""}${emailNote}`,
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
  if (cancelled) {
    revalidatePath("/admin/pos");
    revalidatePath("/admin/sales/home-service");
    revalidatePath("/admin/sales/materials");
    revalidatePath("/admin/trash");
  }
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
export async function checkSmsStatus(): Promise<SmsAccountStatus> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") return { ok: false, error: "Owner admin access required." };
  return getAccountStatus();
}

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

// ---------- Web Push subscriptions ----------
// Called directly from PushSubscribe.tsx (not a <form>), so these take
// plain arguments rather than FormData.

export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await getCurrentUser();
  if (!user) return;
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,$2,$3,$4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );
}

export async function removePushSubscription(endpoint: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await query("delete from push_subscriptions where endpoint=$1 and user_id=$2", [endpoint, user.id]);
}
