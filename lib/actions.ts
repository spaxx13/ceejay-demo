"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { store, nextId, logActivity, notifyAdmins, CHECKLIST_TEMPLATE } from "./store";
import { getCurrentUser, setSession, clearSession, requireRole } from "./auth";
import type {
  Branch,
  Zone,
  Technician,
  Role,
  User,
  LookupItem,
  LookupKind,
  DeviceModel,
  Lead,
  Customer,
  HomeServiceRequest,
  EmploymentStatus,
  InventoryItem,
  StockMovementType,
  Sale,
  SaleLineItem,
  PaymentMethod,
  CustomFieldType,
  CustomFormField,
  ServiceAgreement,
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
  const user = store.users.find((u) => u.email.toLowerCase() === email && u.active);
  if (!user || user.password !== password) {
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
  const technicianId = str(formData, "technicianId");
  if (!name || !email || !password || !role) return;
  if (store.users.some((u) => u.email.toLowerCase() === email)) return;

  const user: User = {
    id: nextId("user"),
    name,
    email,
    password,
    role,
    technicianId: role === "technician" ? technicianId || null : null,
    active: true,
  };
  store.users.push(user);
  revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  const user = store.users.find((u) => u.id === userId);
  if (!user) return;

  const email = str(formData, "email").toLowerCase();
  if (email && store.users.some((u) => u.id !== userId && u.email.toLowerCase() === email)) return;

  user.name = str(formData, "name") || user.name;
  if (email) user.email = email;
  const password = str(formData, "password");
  if (password) user.password = password;
  user.role = (str(formData, "role") || user.role) as Role;
  const technicianId = str(formData, "technicianId");
  user.technicianId = user.role === "technician" ? technicianId || null : null;
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  const actor = await requireRole("owner_admin");
  if (!actor) return;

  const userId = str(formData, "id");
  if (userId === actor.id) return; // can't lock yourself out
  const user = store.users.find((u) => u.id === userId);
  if (user) user.active = !user.active;
  revalidatePath("/admin/users");
}

// ---------- Branches ----------

export async function createBranch(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const branch: Branch = {
    id: nextId("br"),
    name,
    address: str(formData, "address"),
    contactNumber: str(formData, "contactNumber"),
    active: true,
  };
  store.branches.push(branch);
  revalidatePath("/admin/branches");
}

export async function updateBranch(formData: FormData) {
  const branchId = str(formData, "id");
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) return;
  branch.name = str(formData, "name") || branch.name;
  branch.address = str(formData, "address");
  branch.contactNumber = str(formData, "contactNumber");
  revalidatePath("/admin/branches");
}

export async function toggleBranchActive(formData: FormData) {
  const branchId = str(formData, "id");
  const branch = store.branches.find((b) => b.id === branchId);
  if (branch) branch.active = !branch.active;
  revalidatePath("/admin/branches");
}

// ---------- Zones ----------

export async function createZone(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const zone: Zone = {
    id: nextId("zone"),
    name,
    city: str(formData, "city"),
    province: str(formData, "province"),
    notes: str(formData, "notes"),
    active: true,
    roundRobinCursor: 0,
  };
  store.zones.push(zone);
  const techIds = listStr(formData, "technicianIds");
  for (const t of store.technicians) {
    if (techIds.includes(t.id) && !t.zoneIds.includes(zone.id)) t.zoneIds.push(zone.id);
  }
  revalidatePath("/admin/zones");
}

export async function updateZone(formData: FormData) {
  const zoneId = str(formData, "id");
  const zone = store.zones.find((z) => z.id === zoneId);
  if (!zone) return;
  zone.name = str(formData, "name") || zone.name;
  zone.city = str(formData, "city");
  zone.province = str(formData, "province");
  zone.notes = str(formData, "notes");
  const techIds = new Set(listStr(formData, "technicianIds"));
  for (const t of store.technicians) {
    const shouldCover = techIds.has(t.id);
    const covers = t.zoneIds.includes(zone.id);
    if (shouldCover && !covers) t.zoneIds.push(zone.id);
    if (!shouldCover && covers) t.zoneIds = t.zoneIds.filter((id) => id !== zone.id);
  }
  revalidatePath("/admin/zones");
}

export async function toggleZoneActive(formData: FormData) {
  const zoneId = str(formData, "id");
  const zone = store.zones.find((z) => z.id === zoneId);
  if (zone) zone.active = !zone.active;
  revalidatePath("/admin/zones");
}

// ---------- Technicians ----------

export async function createTechnician(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const tech: Technician = {
    id: nextId("tech"),
    name,
    contactNumber: str(formData, "contactNumber"),
    email: str(formData, "email"),
    employmentStatus: (str(formData, "employmentStatus") || "full_time") as EmploymentStatus,
    branchIds: listStr(formData, "branchIds"),
    zoneIds: listStr(formData, "zoneIds"),
    active: true,
  };
  store.technicians.push(tech);
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/zones");
}

export async function updateTechnician(formData: FormData) {
  const techId = str(formData, "id");
  const tech = store.technicians.find((t) => t.id === techId);
  if (!tech) return;
  tech.name = str(formData, "name") || tech.name;
  tech.contactNumber = str(formData, "contactNumber");
  tech.email = str(formData, "email");
  tech.employmentStatus = (str(formData, "employmentStatus") || tech.employmentStatus) as EmploymentStatus;
  tech.branchIds = listStr(formData, "branchIds");
  tech.zoneIds = listStr(formData, "zoneIds");
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/zones");
}

export async function toggleTechnicianActive(formData: FormData) {
  const techId = str(formData, "id");
  const tech = store.technicians.find((t) => t.id === techId);
  if (tech) tech.active = !tech.active;
  revalidatePath("/admin/technicians");
}

// ---------- Device Brands / Models ----------

export async function createDeviceBrand(formData: FormData) {
  const label = str(formData, "label");
  if (!label) return;
  const order = store.lookups.filter((l) => l.kind === "device_brand").length;
  store.lookups.push({ id: nextId("brand"), kind: "device_brand", label, order, active: true });
  revalidatePath("/admin/device-catalog");
}

export async function toggleLookupActive(formData: FormData) {
  const itemId = str(formData, "id");
  const item = store.lookups.find((l) => l.id === itemId);
  if (item) item.active = !item.active;
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/inventory");
}

export async function updateLookupLabel(formData: FormData) {
  const itemId = str(formData, "id");
  const label = str(formData, "label");
  const item = store.lookups.find((l) => l.id === itemId);
  if (item && label) item.label = label;
  revalidatePath("/admin/device-catalog");
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/inventory");
}

export async function createDeviceModel(formData: FormData) {
  const name = str(formData, "name");
  const brandId = str(formData, "brandId");
  if (!name || !brandId) return;
  const model: DeviceModel = { id: nextId("model"), brandId, name, active: true };
  store.deviceModels.push(model);
  revalidatePath("/admin/device-catalog");
}

export async function toggleDeviceModelActive(formData: FormData) {
  const modelId = str(formData, "id");
  const model = store.deviceModels.find((m) => m.id === modelId);
  if (model) model.active = !model.active;
  revalidatePath("/admin/device-catalog");
}

// ---------- Generic lookups (service types, customer sources, statuses) ----------

export async function createLookup(formData: FormData) {
  const kind = str(formData, "kind") as LookupKind;
  const label = str(formData, "label");
  if (!label || !kind) return;
  const order = store.lookups.filter((l) => l.kind === kind).length;
  const item: LookupItem = { id: nextId("lk"), kind, label, order, active: true };
  store.lookups.push(item);
  revalidatePath("/admin/service-types");
  revalidatePath("/admin/statuses");
  revalidatePath("/admin/inventory");
}

export async function reorderLookup(formData: FormData) {
  const itemId = str(formData, "id");
  const direction = str(formData, "direction");
  const item = store.lookups.find((l) => l.id === itemId);
  if (!item) return;
  const siblings = store.lookups.filter((l) => l.kind === item.kind).sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((s) => s.id === item.id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  const tmp = item.order;
  item.order = other.order;
  other.order = tmp;
  revalidatePath("/admin/statuses");
}

// ---------- Site Content (public landing page) ----------

export async function updateSiteContent(formData: FormData) {
  const sc = store.siteContent;
  sc.heroKicker = str(formData, "heroKicker") || sc.heroKicker;
  sc.heroHeadlinePrefix = str(formData, "heroHeadlinePrefix");
  sc.heroHeadlineHighlight = str(formData, "heroHeadlineHighlight");
  sc.heroHeadlineSuffix = str(formData, "heroHeadlineSuffix");
  sc.heroSubtext = str(formData, "heroSubtext");
  sc.primaryCtaLabel = str(formData, "primaryCtaLabel") || sc.primaryCtaLabel;
  sc.secondaryCtaLabel = str(formData, "secondaryCtaLabel") || sc.secondaryCtaLabel;
  sc.ctaBannerTitle = str(formData, "ctaBannerTitle");
  sc.ctaBannerSubtitle = str(formData, "ctaBannerSubtitle");
  sc.ctaBannerButtonLabel = str(formData, "ctaBannerButtonLabel") || sc.ctaBannerButtonLabel;
  revalidatePath("/");
  revalidatePath("/admin/site-content");
}

// ---------- Request Form Content (public home service form) ----------

export async function updateRequestFormContent(formData: FormData) {
  const rc = store.requestFormContent;
  const set = <K extends keyof typeof rc>(key: K, required = true) => {
    const value = str(formData, key as string);
    rc[key] = (required ? value || rc[key] : value) as (typeof rc)[K];
  };
  set("pageKicker");
  set("pageTitle");
  set("pageSubtitle", false);
  set("submitButtonLabel");
  set("successTitle");
  set("successBody", false);
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// ---------- Custom Form Fields (public home service form) ----------

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function createCustomField(formData: FormData) {
  const label = str(formData, "label");
  const type = str(formData, "type") as CustomFieldType;
  if (!label || !type) return;
  const key = slugify(label) || nextId("field");
  const options = str(formData, "options")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const field: CustomFormField = {
    id: nextId("cf"),
    key,
    systemKey: null,
    label,
    placeholder: str(formData, "placeholder"),
    type,
    required: formData.has("required"),
    options: type === "select" ? options : [],
    order: store.customFormFields.length,
    active: true,
  };
  store.customFormFields.push(field);
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// Type is editable for every field, built-in or custom — see CustomFieldType
// in types.ts for how the handful of catalog-backed built-ins (device
// brand/model, service type) and photo behave when switched away from
// their natural type.
export async function updateCustomField(formData: FormData) {
  const fieldId = str(formData, "id");
  const field = store.customFormFields.find((f) => f.id === fieldId);
  if (!field) return;
  field.label = str(formData, "label") || field.label;
  field.placeholder = str(formData, "placeholder");
  field.required = formData.has("required");
  field.type = (str(formData, "type") || field.type) as CustomFieldType;
  const options = str(formData, "options")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  field.options = field.type === "select" ? options : [];
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

// Fields are switched off rather than hard-deleted — even built-in ones —
// so historical requests that captured them stay intelligible. This is
// what "delete a field" means functionally: it disappears from the public
// form and stops being enforced.
export async function toggleCustomFieldActive(formData: FormData) {
  const fieldId = str(formData, "id");
  const field = store.customFormFields.find((f) => f.id === fieldId);
  if (field) field.active = !field.active;
  revalidatePath("/request");
  revalidatePath("/admin/request-form");
}

export async function reorderCustomField(formData: FormData) {
  const fieldId = str(formData, "id");
  const direction = str(formData, "direction");
  const sorted = [...store.customFormFields].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((f) => f.id === fieldId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
  const tmp = sorted[idx].order;
  sorted[idx].order = sorted[swapIdx].order;
  sorted[swapIdx].order = tmp;
  revalidatePath("/admin/request-form");
}

// ---------- Inventory ----------

export async function createInventoryItem(formData: FormData) {
  const name = str(formData, "name");
  const branchId = str(formData, "branchId");
  if (!name || !branchId) return;
  const item: InventoryItem = {
    id: nextId("inv"),
    sku: str(formData, "sku"),
    name,
    categoryId: str(formData, "categoryId"),
    branchId,
    quantityOnHand: Math.max(0, Number(str(formData, "quantityOnHand")) || 0),
    reorderLevel: Math.max(0, Number(str(formData, "reorderLevel")) || 0),
    unitCost: Math.max(0, Number(str(formData, "unitCost")) || 0),
    unitPrice: Math.max(0, Number(str(formData, "unitPrice")) || 0),
    active: true,
  };
  store.inventory.push(item);
  if (item.quantityOnHand > 0) {
    const user = await getCurrentUser();
    store.stockMovements.push({
      id: nextId("mv"),
      itemId: item.id,
      branchId: item.branchId,
      type: "in",
      quantity: item.quantityOnHand,
      reason: "Initial stock",
      referenceSaleId: null,
      actor: user?.name ?? "Admin",
      at: new Date().toISOString(),
    });
  }
  revalidatePath("/admin/inventory");
}

export async function updateInventoryItem(formData: FormData) {
  const itemId = str(formData, "id");
  const item = store.inventory.find((i) => i.id === itemId);
  if (!item) return;
  item.sku = str(formData, "sku");
  item.name = str(formData, "name") || item.name;
  item.categoryId = str(formData, "categoryId");
  item.branchId = str(formData, "branchId") || item.branchId;
  item.reorderLevel = Math.max(0, Number(str(formData, "reorderLevel")) || 0);
  item.unitCost = Math.max(0, Number(str(formData, "unitCost")) || 0);
  item.unitPrice = Math.max(0, Number(str(formData, "unitPrice")) || 0);
  revalidatePath("/admin/inventory");
}

export async function toggleInventoryItemActive(formData: FormData) {
  const itemId = str(formData, "id");
  const item = store.inventory.find((i) => i.id === itemId);
  if (item) item.active = !item.active;
  revalidatePath("/admin/inventory");
}

export async function adjustStock(formData: FormData) {
  const user = await getCurrentUser();
  const itemId = str(formData, "itemId");
  const type = str(formData, "type") as StockMovementType;
  const rawQty = Math.max(0, Number(str(formData, "quantity")) || 0);
  const reason = str(formData, "reason");
  const item = store.inventory.find((i) => i.id === itemId);
  if (!item || rawQty <= 0) return;

  let delta = 0;
  if (type === "in") delta = rawQty;
  else if (type === "out") delta = -Math.min(rawQty, item.quantityOnHand);
  else delta = rawQty - item.quantityOnHand; // adjustment: rawQty is the new counted total

  item.quantityOnHand = Math.max(0, item.quantityOnHand + delta);
  store.stockMovements.push({
    id: nextId("mv"),
    itemId: item.id,
    branchId: item.branchId,
    type,
    quantity: delta,
    reason: reason || (type === "adjustment" ? "Stock count correction" : type === "in" ? "Restock" : "Manual deduction"),
    referenceSaleId: null,
    actor: user?.name ?? "Admin",
    at: new Date().toISOString(),
  });
  revalidatePath("/admin/inventory");
}

// ---------- Point of Sale ----------

export type CreateSaleResult = { ok: true; saleId: string; reference: string } | { ok: false; error: string };

type SaleLineInput = { kind: "inventory" | "service"; itemId?: string; description: string; quantity: number; unitPrice: number };

export async function createSale(
  _prev: CreateSaleResult | undefined,
  formData: FormData
): Promise<CreateSaleResult> {
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

  // Verify stock for inventory lines before committing anything.
  for (const line of lines) {
    if (line.kind === "inventory" && line.itemId) {
      const item = store.inventory.find((i) => i.id === line.itemId);
      if (!item) return { ok: false, error: `Item no longer available: ${line.description}` };
      if (item.quantityOnHand < line.quantity) {
        return { ok: false, error: `Not enough stock for ${item.name} (${item.quantityOnHand} on hand).` };
      }
    }
  }

  let customer = customerPhone ? store.customers.find((c) => c.phone.replace(/[\s-]/g, "") === customerPhone.replace(/[\s-]/g, "")) : undefined;
  if (!customer && customerPhone) {
    customer = {
      id: nextId("cust"),
      name: customerName,
      phone: customerPhone,
      email: "",
      street: "",
      zoneId: null,
      province: "",
      landmark: "",
      source: "Walk-in",
      createdAt: new Date().toISOString(),
      notes: "",
    };
    store.customers.push(customer);
    logActivity("customer", customer.id, "Customer created from a POS sale", user.name);
  }

  const saleLineItems: SaleLineItem[] = lines.map((l) => ({
    id: nextId("sli"),
    kind: l.kind,
    itemId: l.itemId ?? null,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
  }));
  const subtotal = saleLineItems.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const reference = `SALE-${new Date().getFullYear()}-${String(store.sales.length + 1).padStart(4, "0")}`;

  const sale: Sale = {
    id: nextId("sale"),
    reference,
    branchId,
    customerId: customer?.id ?? null,
    customerName,
    customerPhone,
    homeServiceRequestId,
    lineItems: saleLineItems,
    discount,
    subtotal,
    total,
    paymentMethod,
    cashierName: user.name,
    createdAt: new Date().toISOString(),
  };
  store.sales.push(sale);

  for (const line of saleLineItems) {
    if (line.kind === "inventory" && line.itemId) {
      const item = store.inventory.find((i) => i.id === line.itemId)!;
      item.quantityOnHand -= line.quantity;
      store.stockMovements.push({
        id: nextId("mv"),
        itemId: item.id,
        branchId: item.branchId,
        type: "out",
        quantity: -line.quantity,
        reason: `Sold on ${reference}`,
        referenceSaleId: sale.id,
        actor: user.name,
        at: new Date().toISOString(),
      });
    }
  }

  if (customer) {
    logActivity("customer", customer.id, `Sale ${reference} recorded (₱${total.toLocaleString()}) by ${user.name}`, user.name);
  }
  if (homeServiceRequestId) {
    logActivity("home_service_request", homeServiceRequestId, `Sale ${reference} recorded for this job (₱${total.toLocaleString()}) by ${user.name}`, user.name);
  }

  revalidatePath("/admin/pos");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, saleId: sale.id, reference };
}

// ---------- Public Home Service Request ----------

export type SubmitResult = { ok: true; reference: string } | { ok: false; error: string };

function matchZone(cityInput: string): Zone | null {
  const norm = cityInput.trim().toLowerCase();
  if (!norm) return null;
  return (
    store.zones.find((z) => z.active && z.city.trim().toLowerCase() === norm) ??
    store.zones.find((z) => z.active && (z.city.toLowerCase().includes(norm) || norm.includes(z.city.toLowerCase()))) ??
    null
  );
}

function pickTechnicianRoundRobin(zone: Zone): Technician | null {
  const eligible = store.technicians.filter((t) => t.active && t.zoneIds.includes(zone.id));
  if (eligible.length === 0) return null;
  const idx = zone.roundRobinCursor % eligible.length;
  zone.roundRobinCursor += 1;
  return eligible[idx];
}

// System fields carry fixed input names (independent of the admin's chosen
// display order) so this reads the same regardless of how fields are
// arranged — only whether each one is active/required, from
// store.customFormFields, changes what's enforced.
export async function submitHomeServiceRequest(
  _prev: SubmitResult | undefined,
  formData: FormData
): Promise<SubmitResult> {
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

  const systemFields = store.customFormFields.filter((f) => f.systemKey);
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
  for (const f of store.customFormFields.filter((f) => f.active && !f.systemKey)) {
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
  let customer = phone ? store.customers.find((c) => c.phone.replace(/[\s-]/g, "") === phone.replace(/[\s-]/g, "")) : undefined;
  const zone = isActive("city") ? matchZone(city) : null;

  if (!customer && (name || phone)) {
    customer = {
      id: nextId("cust"),
      name,
      phone,
      email,
      street,
      zoneId: zone?.id ?? null,
      province,
      landmark,
      source: "Home Service",
      createdAt: new Date().toISOString(),
      notes: "",
    };
    store.customers.push(customer);
    logActivity("customer", customer.id, "Customer created from Home Service Request form", "System");
  }

  const requestStatuses = store.lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  const initialStatus = requestStatuses[0];

  const assignedTech = zone ? pickTechnicianRoundRobin(zone) : null;
  const assignedStatus = assignedTech
    ? requestStatuses.find((s) => s.label === "Assigned") ?? initialStatus
    : initialStatus;

  const reference = `HSR-${new Date().getFullYear()}-${String(store.requests.length + 1).padStart(4, "0")}`;

  const request: HomeServiceRequest = {
    id: nextId("req"),
    reference,
    customerId: customer?.id ?? null,
    customerName: name,
    phone,
    email,
    deviceBrandId: deviceBrandId || null,
    deviceModelId: deviceModelId || null,
    deviceOther,
    serviceTypeId,
    issueDescription,
    photoDataUrl,
    street,
    landmark,
    province,
    city,
    lat: str(formData, "lat") ? Number(str(formData, "lat")) : null,
    lng: str(formData, "lng") ? Number(str(formData, "lng")) : null,
    zoneId: zone?.id ?? null,
    unzoned: !zone,
    preferredDatetime,
    statusId: assignedStatus.id,
    assignedTechnicianId: assignedTech?.id ?? null,
    autoAssigned: !!assignedTech,
    branchId: assignedTech?.branchIds[0] ?? null,
    adminNotes: "",
    createdAt: new Date().toISOString(),
    statusHistory: [{ statusId: initialStatus.id, at: new Date().toISOString() }],
    customFields,
  };
  if (assignedTech) {
    request.statusHistory.push({ statusId: assignedStatus.id, at: new Date().toISOString() });
  }
  store.requests.push(request);

  logActivity(
    "home_service_request",
    request.id,
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

export async function submitContactInquiry(
  _prev: ContactResult | undefined,
  formData: FormData
): Promise<ContactResult> {
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

  const leadStatuses = store.lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead: Lead = {
    id: nextId("lead"),
    customerId: null,
    name,
    phone,
    email,
    source: "Website",
    statusId: leadStatuses[0]?.id ?? "",
    assignedTo: null,
    followUpDate: null,
    notes: message,
    createdAt: new Date().toISOString(),
  };
  store.leads.push(lead);
  logActivity("lead", lead.id, "Inquiry submitted via website contact form", "System");
  revalidatePath("/admin/crm");
  return { ok: true };
}

// ---------- Admin: Home Service Requests ----------

export async function reassignRequest(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = str(formData, "id");
  const technicianId = str(formData, "technicianId");
  const req = store.requests.find((r) => r.id === requestId);
  if (!req) return;
  req.assignedTechnicianId = technicianId || null;
  req.autoAssigned = false;
  if (technicianId) {
    const tech = store.technicians.find((t) => t.id === technicianId);
    if (tech) req.branchId = tech.branchIds[0] ?? req.branchId;
    const assignedStatus = store.lookups.find((l) => l.kind === "request_status" && l.label === "Assigned");
    if (assignedStatus && req.statusId !== assignedStatus.id) {
      req.statusId = assignedStatus.id;
      req.statusHistory.push({ statusId: assignedStatus.id, at: new Date().toISOString() });
    }
    logActivity("home_service_request", req.id, `Manually reassigned to ${tech?.name ?? technicianId} by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  } else {
    logActivity("home_service_request", req.id, `Unassigned by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  }
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
}

export async function changeRequestStatus(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const req = store.requests.find((r) => r.id === requestId);
  const status = store.lookups.find((l) => l.id === statusId);
  if (!req || !status) return;
  req.statusId = statusId;
  req.statusHistory.push({ statusId, at: new Date().toISOString() });
  logActivity("home_service_request", req.id, `Status changed to "${status.label}" by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/technician");
}

export async function updateRequestNotes(formData: FormData) {
  const requestId = str(formData, "id");
  const notes = str(formData, "adminNotes");
  const req = store.requests.find((r) => r.id === requestId);
  if (!req) return;
  req.adminNotes = notes;
  revalidatePath(`/admin/requests/${requestId}`);
}

// ---------- CRM: Leads & Customers ----------

export async function createLead(formData: FormData) {
  const user = await getCurrentUser();
  const name = str(formData, "name");
  if (!name) return;
  const leadStatuses = store.lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const lead: Lead = {
    id: nextId("lead"),
    customerId: null,
    name,
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    source: str(formData, "source"),
    statusId: leadStatuses[0]?.id ?? "",
    assignedTo: user?.id ?? null,
    followUpDate: str(formData, "followUpDate") || null,
    notes: str(formData, "notes"),
    createdAt: new Date().toISOString(),
  };
  store.leads.push(lead);
  logActivity("lead", lead.id, `Lead created by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
}

export async function updateLeadStatus(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const lead = store.leads.find((l) => l.id === leadId);
  const status = store.lookups.find((l) => l.id === statusId);
  if (!lead || !status) return;
  lead.statusId = statusId;
  logActivity("lead", lead.id, `Status changed to "${status.label}" by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function addLeadNote(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const note = str(formData, "note");
  const followUpDate = str(formData, "followUpDate");
  const lead = store.leads.find((l) => l.id === leadId);
  if (!lead || !note) return;
  lead.notes = lead.notes ? `${lead.notes}\n${note}` : note;
  if (followUpDate) lead.followUpDate = followUpDate;
  logActivity("lead", lead.id, `Note added by ${user?.name ?? "Admin"}: ${note}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function convertLeadToCustomer(formData: FormData) {
  const user = await getCurrentUser();
  const leadId = str(formData, "id");
  const lead = store.leads.find((l) => l.id === leadId);
  if (!lead) return;
  let customer = lead.customerId ? store.customers.find((c) => c.id === lead.customerId) : undefined;
  if (!customer) {
    customer = {
      id: nextId("cust"),
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      street: "",
      zoneId: null,
      province: "",
      landmark: "",
      source: lead.source || "Referral",
      createdAt: new Date().toISOString(),
      notes: `Converted from lead ${lead.id}`,
    };
    store.customers.push(customer);
    lead.customerId = customer.id;
  }
  const converted = store.lookups.find((l) => l.kind === "lead_status" && l.label === "Converted");
  if (converted) lead.statusId = converted.id;
  logActivity("lead", lead.id, `Converted to customer by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  logActivity("customer", customer.id, `Created via lead conversion by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
}

export async function createCustomer(formData: FormData) {
  const user = await getCurrentUser();
  const name = str(formData, "name");
  if (!name) return;
  const customer: Customer = {
    id: nextId("cust"),
    name,
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    street: str(formData, "street"),
    zoneId: str(formData, "zoneId") || null,
    province: str(formData, "province"),
    landmark: str(formData, "landmark"),
    source: str(formData, "source") || "Walk-in",
    createdAt: new Date().toISOString(),
    notes: str(formData, "notes"),
  };
  store.customers.push(customer);
  logActivity("customer", customer.id, `Customer created by ${user?.name ?? "Admin"}`, user?.name ?? "Admin");
  revalidatePath("/admin/crm");
}

export async function addCustomerNote(formData: FormData) {
  const user = await getCurrentUser();
  const customerId = str(formData, "id");
  const note = str(formData, "note");
  const customer = store.customers.find((c) => c.id === customerId);
  if (!customer || !note) return;
  customer.notes = customer.notes ? `${customer.notes}\n${note}` : note;
  logActivity("customer", customer.id, `Note added by ${user?.name ?? "Admin"}: ${note}`, user?.name ?? "Admin");
  revalidatePath(`/admin/crm/${customerId}`);
}

// ---------- Technician view ----------

export async function technicianUpdateStatus(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = str(formData, "id");
  const statusId = str(formData, "statusId");
  const note = str(formData, "note");
  const req = store.requests.find((r) => r.id === requestId);
  const status = store.lookups.find((l) => l.id === statusId);
  if (!req || !status) return;
  req.statusId = statusId;
  req.statusHistory.push({ statusId, at: new Date().toISOString() });
  if (note) req.adminNotes = req.adminNotes ? `${req.adminNotes}\n[${user?.name}] ${note}` : `[${user?.name}] ${note}`;
  logActivity("home_service_request", req.id, `Status updated to "${status.label}" by technician ${user?.name ?? ""}${note ? ` — ${note}` : ""}`, user?.name ?? "Technician");
  if (status.label === "In Progress") {
    notifyAdmins(
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

export type SubmitChecklistResult =
  | { ok: true; agreementId: string; phase: ChecklistPhase }
  | { ok: false; error: string };

export async function submitChecklist(
  _prev: SubmitChecklistResult | undefined,
  formData: FormData
): Promise<SubmitChecklistResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") return { ok: false, error: "You must be signed in as the assigned technician." };

  const requestId = str(formData, "requestId");
  const phase = str(formData, "phase") as ChecklistPhase;
  if (phase !== "pre_repair" && phase !== "post_repair") return { ok: false, error: "Invalid checklist phase." };

  const req = store.requests.find((r) => r.id === requestId);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.assignedTechnicianId !== user.technicianId) {
    return { ok: false, error: "This job isn't assigned to you." };
  }

  const existingForPhase = store.serviceAgreements.find((a) => a.requestId === req.id && a.phase === phase);
  if (existingForPhase) return { ok: false, error: "This checklist has already been completed." };

  const preAgreement = store.serviceAgreements.find((a) => a.requestId === req.id && a.phase === "pre_repair");
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

  const technician = store.technicians.find((t) => t.id === user.technicianId);
  const brand = store.lookups.find((l) => l.id === req.deviceBrandId);
  const model = store.deviceModels.find((m) => m.id === req.deviceModelId);
  const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "Device";

  const prefix = phase === "pre_repair" ? "PRC" : "SA";
  const seq = store.serviceAgreements.filter((a) => a.phase === phase).length + 1;
  const reference = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const agreement: ServiceAgreement = {
    id: nextId("sa"),
    requestId: req.id,
    phase,
    reference,
    customerName: req.customerName,
    deviceLabel,
    branchId: req.branchId,
    technicianId: user.technicianId,
    technicianName: technician?.name ?? user.name,
    items,
    summaryNotes: str(formData, "summaryNotes"),
    agreedToTerms,
    customerSignatureDataUrl,
    technicianSignatureDataUrl,
    receiptPhotoDataUrl,
    completedAt: now,
    sentToCustomerAt: null,
    createdAt: now,
  };
  store.serviceAgreements.push(agreement);

  if (phase === "pre_repair") {
    logActivity(
      "home_service_request",
      req.id,
      `Pre-repair checklist ${reference} completed by ${agreement.technicianName} — post-repair checklist is now open.`,
      agreement.technicianName
    );
  } else {
    // No email/SMS provider is configured in this demo — sending both
    // checklists is stubbed by timestamping and logging it, same
    // convention as reminders elsewhere in the app.
    agreement.sentToCustomerAt = now;
    if (preAgreement) preAgreement.sentToCustomerAt = now;

    const completedStatus = store.lookups.find((l) => l.kind === "request_status" && l.label === "Completed");
    if (completedStatus && req.statusId !== completedStatus.id) {
      req.statusId = completedStatus.id;
      req.statusHistory.push({ statusId: completedStatus.id, at: now });
    }

    logActivity(
      "home_service_request",
      req.id,
      `Post-repair checklist ${reference} completed by ${agreement.technicianName} — case auto-marked Completed. Pre-repair (${preAgreement?.reference ?? "—"}) and post-repair (${reference}) checklists sent to ${req.email || req.phone} (stubbed — no email/SMS provider configured)`,
      agreement.technicianName
    );
    notifyAdmins(
      "checklist_completed",
      req.id,
      `${agreement.technicianName} completed the post-repair checklist for ${req.reference} (${req.customerName}) — case marked Completed and both checklists sent to the customer.`
    );
  }

  revalidatePath("/technician");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  return { ok: true, agreementId: agreement.id, phase };
}

export async function markNotificationRead(formData: FormData) {
  const id = str(formData, "id");
  const n = store.notifications.find((n) => n.id === id);
  if (n) n.readAt = new Date().toISOString();
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllNotificationsRead() {
  const now = new Date().toISOString();
  for (const n of store.notifications) {
    if (!n.readAt) n.readAt = now;
  }
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
