"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { CHECKLIST_TEMPLATE } from "./checklist";
import {
  query,
  queryOne,
  getUserAuthByEmail,
  getUsers,
  getZones,
  getTechnicians,
  getLookups,
  getCustomers,
  getRequestById,
  getServiceAgreements,
  getInventory,
  getCustomFormFields,
  logActivity,
  notifyAdmins,
} from "./db";
import { getCurrentUser, setSession, clearSession, requireRole } from "./auth";
import type {
  Role,
  LookupKind,
  StockMovementType,
  PaymentMethod,
  CustomFieldType,
  ChecklistItem,
  ChecklistResult,
  ChecklistPhase,
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

// ---------- Auth ----------

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const user = await getUserAuthByEmail(email);
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await setSession(user.id);
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
  const technicianId = str(formData, "technicianId") || null;
  if (!name || !email || !password || !role) return;

  const existing = await getUserAuthByEmail(email);
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await query("insert into users (name, email, password_hash, role, technician_id) values ($1,$2,$3,$4,$5)", [
    name,
    email,
    passwordHash,
    role,
    role === "technician" ? technicianId : null,
  ]);
  revalidatePath("/admin/users");
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
  const technicianId = str(formData, "technicianId") || null;
  const password = str(formData, "password");

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query("update users set name=$1, email=$2, password_hash=$3, role=$4, technician_id=$5 where id=$6", [
      name,
      email || user.email,
      passwordHash,
      role,
      role === "technician" ? technicianId : null,
      userId,
    ]);
  } else {
    await query("update users set name=$1, email=$2, role=$3, technician_id=$4 where id=$5", [
      name,
      email || user.email,
      role,
      role === "technician" ? technicianId : null,
      userId,
    ]);
  }
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  if (userId === actor.id) return; // can't lock yourself out
  await query("update users set active = not active where id=$1", [userId]);
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

// ---------- Zones ----------

export async function createZone(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const zone = await queryOne<{ id: string }>(
    "insert into zones (name, city, province, notes) values ($1,$2,$3,$4) returning id",
    [name, str(formData, "city"), str(formData, "province"), str(formData, "notes")]
  );
  const techIds = listStr(formData, "technicianIds");
  if (zone && techIds.length > 0) {
    await query("update technicians set zone_ids = array(select distinct unnest(zone_ids || $1::uuid[])) where id = any($2::uuid[])", [
      [zone.id],
      techIds,
    ]);
  }
  revalidatePath("/admin/zones");
}

export async function updateZone(formData: FormData) {
  const zoneId = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return;
  await query("update zones set name=$1, city=$2, province=$3, notes=$4 where id=$5", [
    name,
    str(formData, "city"),
    str(formData, "province"),
    str(formData, "notes"),
    zoneId,
  ]);
  const techIds = new Set(listStr(formData, "technicianIds"));
  const technicians = await getTechnicians();
  for (const t of technicians) {
    const shouldCover = techIds.has(t.id);
    const covers = t.zoneIds.includes(zoneId);
    if (shouldCover && !covers) {
      await query("update technicians set zone_ids = array_append(zone_ids, $1::uuid) where id=$2", [zoneId, t.id]);
    } else if (!shouldCover && covers) {
      await query("update technicians set zone_ids = array_remove(zone_ids, $1::uuid) where id=$2", [zoneId, t.id]);
    }
  }
  revalidatePath("/admin/zones");
}

export async function toggleZoneActive(formData: FormData) {
  const zoneId = str(formData, "id");
  await query("update zones set active = not active where id=$1", [zoneId]);
  revalidatePath("/admin/zones");
}

// ---------- Technicians ----------

export async function createTechnician(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  await query(
    "insert into technicians (name, contact_number, email, employment_status, branch_ids, zone_ids) values ($1,$2,$3,$4,$5,$6)",
    [
      name,
      str(formData, "contactNumber"),
      str(formData, "email"),
      str(formData, "employmentStatus") || "full_time",
      listStr(formData, "branchIds"),
      listStr(formData, "zoneIds"),
    ]
  );
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/zones");
}

export async function updateTechnician(formData: FormData) {
  const techId = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return;
  await query(
    "update technicians set name=$1, contact_number=$2, email=$3, employment_status=$4, branch_ids=$5, zone_ids=$6 where id=$7",
    [
      name,
      str(formData, "contactNumber"),
      str(formData, "email"),
      str(formData, "employmentStatus") || "full_time",
      listStr(formData, "branchIds"),
      listStr(formData, "zoneIds"),
      techId,
    ]
  );
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/zones");
}

export async function toggleTechnicianActive(formData: FormData) {
  const techId = str(formData, "id");
  await query("update technicians set active = not active where id=$1", [techId]);
  revalidatePath("/admin/technicians");
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

export async function toggleLookupActive(formData: FormData) {
  const itemId = str(formData, "id");
  await query("update lookups set active = not active where id=$1", [itemId]);
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/inventory");
}

export async function updateLookupLabel(formData: FormData) {
  const itemId = str(formData, "id");
  const label = str(formData, "label");
  if (!label) return;
  await query("update lookups set label=$1 where id=$2", [label, itemId]);
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/inventory");
}

export async function createDeviceModel(formData: FormData) {
  const name = str(formData, "name");
  const brandId = str(formData, "brandId");
  if (!name || !brandId) return;
  await query("insert into device_models (brand_id, name) values ($1,$2)", [brandId, name]);
  revalidatePath("/admin/device-catalog");
}

export async function toggleDeviceModelActive(formData: FormData) {
  const modelId = str(formData, "id");
  await query("update device_models set active = not active where id=$1", [modelId]);
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
  revalidatePath("/admin/inventory");
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

// ---------- Inventory ----------

export async function createInventoryItem(formData: FormData) {
  const name = str(formData, "name");
  const branchId = str(formData, "branchId");
  if (!name || !branchId) return;
  const quantityOnHand = Math.max(0, Number(str(formData, "quantityOnHand")) || 0);
  const item = await queryOne<{ id: string }>(
    "insert into inventory_items (sku, name, category_id, branch_id, quantity_on_hand, reorder_level, unit_cost, unit_price) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
    [
      str(formData, "sku"),
      name,
      str(formData, "categoryId") || null,
      branchId,
      quantityOnHand,
      Math.max(0, Number(str(formData, "reorderLevel")) || 0),
      Math.max(0, Number(str(formData, "unitCost")) || 0),
      Math.max(0, Number(str(formData, "unitPrice")) || 0),
    ]
  );
  if (item && quantityOnHand > 0) {
    const user = await getCurrentUser();
    await query("insert into stock_movements (item_id, branch_id, type, quantity, reason, actor) values ($1,$2,'in',$3,'Initial stock',$4)", [
      item.id,
      branchId,
      quantityOnHand,
      user?.name ?? "Admin",
    ]);
  }
  revalidatePath("/admin/inventory");
}

export async function updateInventoryItem(formData: FormData) {
  const itemId = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return;
  await query(
    "update inventory_items set sku=$1, name=$2, category_id=$3, branch_id=$4, reorder_level=$5, unit_cost=$6, unit_price=$7 where id=$8",
    [
      str(formData, "sku"),
      name,
      str(formData, "categoryId") || null,
      str(formData, "branchId") || null,
      Math.max(0, Number(str(formData, "reorderLevel")) || 0),
      Math.max(0, Number(str(formData, "unitCost")) || 0),
      Math.max(0, Number(str(formData, "unitPrice")) || 0),
      itemId,
    ]
  );
  revalidatePath("/admin/inventory");
}

export async function toggleInventoryItemActive(formData: FormData) {
  const itemId = str(formData, "id");
  await query("update inventory_items set active = not active where id=$1", [itemId]);
  revalidatePath("/admin/inventory");
}

export async function adjustStock(formData: FormData) {
  const user = await getCurrentUser();
  const itemId = str(formData, "itemId");
  const type = str(formData, "type") as StockMovementType;
  const rawQty = Math.max(0, Number(str(formData, "quantity")) || 0);
  const reason = str(formData, "reason");
  const inventory = await getInventory();
  const item = inventory.find((i) => i.id === itemId);
  if (!item || rawQty <= 0) return;

  let delta = 0;
  if (type === "in") delta = rawQty;
  else if (type === "out") delta = -Math.min(rawQty, item.quantityOnHand);
  else delta = rawQty - item.quantityOnHand; // adjustment: rawQty is the new counted total

  const newQty = Math.max(0, item.quantityOnHand + delta);
  await query("update inventory_items set quantity_on_hand=$1 where id=$2", [newQty, itemId]);
  await query("insert into stock_movements (item_id, branch_id, type, quantity, reason, actor) values ($1,$2,$3,$4,$5,$6)", [
    itemId,
    item.branchId,
    type,
    delta,
    reason || (type === "adjustment" ? "Stock count correction" : type === "in" ? "Restock" : "Manual deduction"),
    user?.name ?? "Admin",
  ]);
  revalidatePath("/admin/inventory");
}

// ---------- Point of Sale ----------

export type CreateSaleResult = { ok: true; saleId: string; reference: string } | { ok: false; error: string };

type SaleLineInput = { kind: "inventory" | "service"; itemId?: string; description: string; quantity: number; unitPrice: number };

export async function createSale(_prev: CreateSaleResult | undefined, formData: FormData): Promise<CreateSaleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in to record a sale." };

  const branchId = str(formData, "branchId");
  const paymentMethod = (str(formData, "paymentMethod") || "cash") as PaymentMethod;
  const discount = Math.max(0, Number(str(formData, "discount")) || 0);
  const customerName = str(formData, "customerName") || "Walk-in Customer";
  const customerPhone = str(formData, "customerPhone");
  const homeServiceRequestId = str(formData, "homeServiceRequestId") || null;
  const linesRaw = str(formData, "lines");

  if (!branchId) return { ok: false, error: "Select a branch." };

  let lines: SaleLineInput[] = [];
  try {
    lines = JSON.parse(linesRaw || "[]");
  } catch {
    lines = [];
  }
  lines = lines.filter((l) => l.description && l.quantity > 0 && l.unitPrice >= 0);
  if (lines.length === 0) return { ok: false, error: "Add at least one item or service line before charging." };

  const inventory = await getInventory();
  for (const line of lines) {
    if (line.kind === "inventory" && line.itemId) {
      const item = inventory.find((i) => i.id === line.itemId);
      if (!item) return { ok: false, error: `Item no longer available: ${line.description}` };
      if (item.quantityOnHand < line.quantity) {
        return { ok: false, error: `Not enough stock for ${item.name} (${item.quantityOnHand} on hand).` };
      }
    }
  }

  let customerId: string | null = null;
  let isNewCustomer = false;
  if (customerPhone) {
    const customers = await getCustomers();
    const existing = customers.find((c) => c.phone.replace(/[\s-]/g, "") === customerPhone.replace(/[\s-]/g, ""));
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await queryOne<{ id: string }>(
        "insert into customers (name, phone, source) values ($1,$2,'Walk-in') returning id",
        [customerName, customerPhone]
      );
      customerId = created!.id;
      isNewCustomer = true;
      await logActivity("customer", customerId, "Customer created from a POS sale", user.name);
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const salesCount = await queryOne<{ n: string }>("select count(*)::int as n from sales");
  const reference = `SALE-${new Date().getFullYear()}-${String(Number(salesCount!.n) + 1).padStart(4, "0")}`;

  const sale = await queryOne<{ id: string }>(
    `insert into sales (reference, branch_id, customer_id, customer_name, customer_phone, home_service_request_id, discount, subtotal, total, payment_method, cashier_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [reference, branchId, customerId, customerName, customerPhone, homeServiceRequestId, discount, subtotal, total, paymentMethod, user.name]
  );
  const saleId = sale!.id;

  for (const line of lines) {
    await query("insert into sale_line_items (sale_id, kind, item_id, description, quantity, unit_price) values ($1,$2,$3,$4,$5,$6)", [
      saleId,
      line.kind,
      line.itemId ?? null,
      line.description,
      line.quantity,
      line.unitPrice,
    ]);
    if (line.kind === "inventory" && line.itemId) {
      const item = inventory.find((i) => i.id === line.itemId)!;
      await query("update inventory_items set quantity_on_hand = quantity_on_hand - $1 where id=$2", [line.quantity, line.itemId]);
      await query("insert into stock_movements (item_id, branch_id, type, quantity, reason, reference_sale_id, actor) values ($1,$2,'out',$3,$4,$5,$6)", [
        line.itemId,
        item.branchId,
        -line.quantity,
        `Sold on ${reference}`,
        saleId,
        user.name,
      ]);
    }
  }

  if (customerId) {
    await logActivity("customer", customerId, `Sale ${reference} recorded (₱${total.toLocaleString()}) by ${user.name}`, user.name);
  }
  if (homeServiceRequestId) {
    await logActivity("home_service_request", homeServiceRequestId, `Sale ${reference} recorded for this job (₱${total.toLocaleString()}) by ${user.name}`, user.name);
  }
  void isNewCustomer;

  revalidatePath("/admin/pos");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, saleId, reference };
}

// ---------- Public Home Service Request ----------

export type SubmitResult = { ok: true; reference: string } | { ok: false; error: string };

type ZoneRow = Awaited<ReturnType<typeof getZones>>[number];

function matchZone(zones: ZoneRow[], cityInput: string): ZoneRow | null {
  const norm = cityInput.trim().toLowerCase();
  if (!norm) return null;
  return (
    zones.find((z) => z.active && z.city.trim().toLowerCase() === norm) ??
    zones.find((z) => z.active && (z.city.toLowerCase().includes(norm) || norm.includes(z.city.toLowerCase()))) ??
    null
  );
}

async function pickTechnicianRoundRobin(zone: ZoneRow) {
  const technicians = await getTechnicians();
  const eligible = technicians.filter((t) => t.active && t.zoneIds.includes(zone.id));
  if (eligible.length === 0) return null;
  const idx = zone.roundRobinCursor % eligible.length;
  await query("update zones set round_robin_cursor = round_robin_cursor + 1 where id=$1", [zone.id]);
  return eligible[idx];
}

// System fields carry fixed input names (independent of the admin's chosen
// display order) so this reads the same regardless of how fields are
// arranged — only whether each one is active/required, from the
// custom_form_fields table, changes what's enforced.
export async function submitHomeServiceRequest(_prev: SubmitResult | undefined, formData: FormData): Promise<SubmitResult> {
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
  const zones = await getZones();
  const zone = isActive("city") ? matchZone(zones, city) : null;

  if (!customerId && (name || phone)) {
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, street, zone_id, province, landmark, source) values ($1,$2,$3,$4,$5,$6,$7,'Home Service') returning id",
      [name, phone, email, street, zone?.id ?? null, province, landmark]
    );
    customerId = created!.id;
    await logActivity("customer", customerId, "Customer created from Home Service Request form", "System");
  }

  const allLookups = await getLookups();
  const requestStatuses = allLookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  const initialStatus = requestStatuses[0];

  const assignedTech = zone ? await pickTechnicianRoundRobin(zone) : null;
  const assignedStatus = assignedTech ? requestStatuses.find((s) => s.label === "Assigned") ?? initialStatus : initialStatus;

  const requestsCount = await queryOne<{ n: string }>("select count(*)::int as n from home_service_requests");
  const reference = `HSR-${new Date().getFullYear()}-${String(Number(requestsCount!.n) + 1).padStart(4, "0")}`;

  const now = new Date().toISOString();
  const statusHistory = [{ statusId: initialStatus.id, at: now }];
  if (assignedTech) statusHistory.push({ statusId: assignedStatus.id, at: now });

  const created = await queryOne<{ id: string }>(
    `insert into home_service_requests (
      reference, customer_id, customer_name, phone, email, device_brand_id, device_model_id, device_other, service_type_id,
      issue_description, photo_data_url, street, landmark, province, city, lat, lng, zone_id, unzoned, preferred_datetime,
      status_id, assigned_technician_id, auto_assigned, branch_id, status_history, custom_fields
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
    returning id`,
    [
      reference,
      customerId,
      name,
      phone,
      email,
      deviceBrandId || null,
      deviceModelId || null,
      deviceOther,
      serviceTypeId || null,
      issueDescription,
      photoDataUrl,
      street,
      landmark,
      province,
      city,
      str(formData, "lat") ? Number(str(formData, "lat")) : null,
      str(formData, "lng") ? Number(str(formData, "lng")) : null,
      zone?.id ?? null,
      !zone,
      preferredDatetime || null,
      assignedStatus.id,
      assignedTech?.id ?? null,
      !!assignedTech,
      assignedTech?.branchIds[0] ?? null,
      JSON.stringify(statusHistory),
      JSON.stringify(customFields),
    ]
  );

  await logActivity(
    "home_service_request",
    created!.id,
    assignedTech
      ? `Request ${reference} submitted and auto-assigned to ${assignedTech.name} (zone: ${zone!.name})`
      : zone
      ? `Request ${reference} submitted, matched to zone ${zone.name} but no technician covers it — sent to Unassigned queue`
      : `Request ${reference} submitted, no matching zone — flagged unzoned and sent to Unassigned queue`,
    "System"
  );

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
    await logActivity("home_service_request", req.id, `Manually reassigned to ${tech?.name ?? technicianId} by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  } else {
    await query("update home_service_requests set assigned_technician_id=null, auto_assigned=false where id=$1", [requestId]);
    await logActivity("home_service_request", req.id, `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  }
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
}

export async function changeRequestStatus(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const req = await getRequestById(requestId);
  const lookups = await getLookups();
  const status = lookups.find((l) => l.id === statusId);
  if (!req || !status) return;
  const statusHistory = [...req.statusHistory, { statusId, at: new Date().toISOString() }];
  await query("update home_service_requests set status_id=$1, status_history=$2 where id=$3", [statusId, JSON.stringify(statusHistory), requestId]);
  await logActivity("home_service_request", req.id, `Status changed to "${status.label}" by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/technician");
}

export async function updateRequestNotes(formData: FormData) {
  const requestId = str(formData, "id");
  const notes = str(formData, "adminNotes");
  await query("update home_service_requests set admin_notes=$1 where id=$2", [notes, requestId]);
  revalidatePath(`/admin/requests/${requestId}`);
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
    "insert into customers (name, phone, email, street, zone_id, province, landmark, source, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [
      name,
      str(formData, "phone"),
      str(formData, "email"),
      str(formData, "street"),
      str(formData, "zoneId") || null,
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
  await logActivity(
    "home_service_request",
    req.id,
    `Status updated to "${status.label}" by technician ${user?.name ?? ""}${note ? ` — ${note}` : ""}`,
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

// ---------- Pre-Repair / Post-Repair Checklists ----------

export type SubmitChecklistResult = { ok: true; agreementId: string; phase: ChecklistPhase } | { ok: false; error: string };

export async function submitChecklist(_prev: SubmitChecklistResult | undefined, formData: FormData): Promise<SubmitChecklistResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") return { ok: false, error: "You must be signed in as the assigned technician." };

  const requestId = str(formData, "requestId");
  const phase = str(formData, "phase") as ChecklistPhase;
  if (phase !== "pre_repair" && phase !== "post_repair") return { ok: false, error: "Invalid checklist phase." };

  const req = await getRequestById(requestId);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.assignedTechnicianId !== user.technicianId) {
    return { ok: false, error: "This job isn't assigned to you." };
  }

  const agreements = await getServiceAgreements();
  const existingForPhase = agreements.find((a) => a.requestId === req.id && a.phase === phase);
  if (existingForPhase) return { ok: false, error: "This checklist has already been completed." };

  const preAgreement = agreements.find((a) => a.requestId === req.id && a.phase === "pre_repair");
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
  if (phase === "post_repair") {
    receiptPhotoDataUrl = str(formData, "receiptPhotoDataUrl");
    if (!receiptPhotoDataUrl.startsWith("data:image/")) {
      return { ok: false, error: "A photo of the receipt is required to complete and close this case." };
    }
  }

  const technicians = await getTechnicians();
  const technician = technicians.find((t) => t.id === user.technicianId);
  const lookups = await getLookups();
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const deviceModels = await query<{ id: string; name: string }>("select id, name from device_models where id=$1", [req.deviceModelId]);
  const model = deviceModels[0];
  const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "Device";

  const prefix = phase === "pre_repair" ? "PRC" : "SA";
  const phaseCount = await queryOne<{ n: string }>("select count(*)::int as n from service_agreements where phase=$1", [phase]);
  const reference = `${prefix}-${new Date().getFullYear()}-${String(Number(phaseCount!.n) + 1).padStart(4, "0")}`;
  const technicianName = technician?.name ?? user.name;

  const created = await queryOne<{ id: string }>(
    `insert into service_agreements (
      request_id, phase, reference, customer_name, device_label, branch_id, technician_id, technician_name,
      items, summary_notes, agreed_to_terms, customer_signature_data_url, technician_signature_data_url, receipt_photo_data_url
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    returning id`,
    [
      req.id,
      phase,
      reference,
      req.customerName,
      deviceLabel,
      req.branchId,
      user.technicianId,
      technicianName,
      JSON.stringify(items),
      str(formData, "summaryNotes"),
      agreedToTerms,
      customerSignatureDataUrl,
      technicianSignatureDataUrl,
      receiptPhotoDataUrl,
    ]
  );
  const agreementId = created!.id;

  if (phase === "pre_repair") {
    await logActivity(
      "home_service_request",
      req.id,
      `Pre-repair checklist ${reference} completed by ${technicianName} — post-repair checklist is now open.`,
      technicianName
    );
  } else {
    const now = new Date().toISOString();
    await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, agreementId]);
    if (preAgreement) await query("update service_agreements set sent_to_customer_at=$1 where id=$2", [now, preAgreement.id]);

    const completedStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Completed");
    if (completedStatus && req.statusId !== completedStatus.id) {
      const statusHistory = [...req.statusHistory, { statusId: completedStatus.id, at: now }];
      await query("update home_service_requests set status_id=$1, status_history=$2 where id=$3", [completedStatus.id, JSON.stringify(statusHistory), req.id]);
    }

    await logActivity(
      "home_service_request",
      req.id,
      `Post-repair checklist ${reference} completed by ${technicianName} — case auto-marked Completed. Pre-repair (${preAgreement?.reference ?? "—"}) and post-repair (${reference}) checklists sent to ${req.email || req.phone} (stubbed — no email/SMS provider configured)`,
      technicianName
    );
    await notifyAdmins(
      "checklist_completed",
      req.id,
      `${technicianName} completed the post-repair checklist for ${req.reference} (${req.customerName}) — case marked Completed and both checklists sent to the customer.`
    );
  }

  revalidatePath("/technician");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  return { ok: true, agreementId, phase };
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
