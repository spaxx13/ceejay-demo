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
  SiteContent,
  RequestFormContent,
  CustomFormField,
  ServiceAgreement,
  ChecklistItem,
  Notification,
} from "./types";

// In-memory demo data store — no database. Everything lives in process
// memory and resets on server restart. `globalThis` keeps state stable
// across Next.js dev-mode hot reloads within the same run.

type Store = {
  users: User[];
  branches: Branch[];
  zones: Zone[];
  technicians: Technician[];
  customers: Customer[];
  lookups: LookupItem[];
  deviceModels: DeviceModel[];
  leads: Lead[];
  requests: HomeServiceRequest[];
  activity: ActivityLog[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  sales: Sale[];
  siteContent: SiteContent;
  requestFormContent: RequestFormContent;
  customFormFields: CustomFormField[];
  serviceAgreements: ServiceAgreement[];
  notifications: Notification[];
  seq: number;
};

// The shop's paper "Post-Repair Checklist" (Section II of the Service
// Agreement), digitized row for row. `key` must stay stable — it's how a
// ServiceAgreement's saved item results map back to this template.
export const CHECKLIST_TEMPLATE: Omit<ChecklistItem, "result" | "notes">[] = [
  { key: "lcd_function", label: "LCD Function (if repaired)", helpText: "Check for responsiveness, dead pixels, abnormal colors, touch issues" },
  { key: "battery_function", label: "Battery Function (if repaired)", helpText: "Check charging, discharge, and reported health" },
  { key: "charging_function", label: "Charging Function (if repaired)", helpText: "Test charging with charger" },
  { key: "front_camera", label: "Front Camera", helpText: "Test photo and video functionality" },
  { key: "back_camera", label: "Back Camera", helpText: "Test photo and video functionality, flash" },
  { key: "wifi_network", label: "Wi-Fi Network", helpText: "Test connection to a known Wi-Fi network" },
  { key: "power_volume", label: "Power/Volume Trigger", helpText: "Test all buttons for responsiveness" },
  { key: "microphone", label: "Microphone (Call/Voice Memo)", helpText: "Test during a call or voice recording" },
  { key: "physical_condition", label: "Overall Physical Condition", helpText: "Check for new damage or changes from pre-repair condition" },
  { key: "system_errors", label: "Parts-Fit / Liquid Damage / Other System Errors", helpText: "System error showing up on the device" },
];

// Verbatim from the shop's printed Service Agreement, Section III.
export const SERVICE_AGREEMENT_TERMS = [
  "Warranty Coverage: The warranty only covers the items that were repaired. Other issues beyond what was repaired are not covered.",
  "Increased Risk for Bloated Battery/OLED-Frame Separation: For bloated battery and OLED/Frame damage, the technician is not liable for any damage during the repair. These conditions increase the risk of OLED damage. If the customer agrees to proceed with the repair, Ceejay Apple Services is not liable for any damage to the LCD.",
  "Customer Responsibility (Post-Repair): It is the customer's responsibility to ensure that the iPhone is functioning and has no damage after the repair. Once the customer signs off the post-repair checklist, Ceejay Apple Services is not liable for any damage after the service.",
  "Timely Reporting of Issues: It is the customer's responsibility to report any issues promptly.",
  "LCD/OLED Replacement Warranty: LCD/OLED repair has a 3-day warranty for ghost touch or non-responsive issues only. Any bleeding, crack, lines, or physical damage is not covered under any warranty, as this is a result of the owner's mishandling.",
  "Battery Warranty: One-month warranty for quick discharge issue (3 hours or less at 100% charge). Bloated and other issues caused by misuse, over-charging, or use of chargers not intended for iPhone use are not covered.",
];

const DEFAULT_SITE_CONTENT: SiteContent = {
  heroKicker: "Apple Specialists · Multi-Brand Repair",
  heroHeadlinePrefix: "Cellphone repair that",
  heroHeadlineHighlight: "comes to you",
  heroHeadlineSuffix: "— or waits for you at the counter.",
  heroSubtext:
    "Screen cracked? Battery dying? Book a technician to your doorstep, or visit one of our branches for same-day diagnostics.",
  primaryCtaLabel: "Book Home Service",
  secondaryCtaLabel: "Find a Branch",
  ctaBannerTitle: "Don't want to leave the house?",
  ctaBannerSubtitle: "A technician can come to you — just tell us where and when.",
  ctaBannerButtonLabel: "Book Home Service",
};

const DEFAULT_REQUEST_FORM_CONTENT: RequestFormContent = {
  pageKicker: "Ceejay Cellphone Repair Shop",
  pageTitle: "Home Service Request",
  pageSubtitle: "Tell us about your device and we'll send a technician to your area.",
  submitButtonLabel: "Submit Request",
  successTitle: "Request submitted!",
  successBody: "We'll contact you to confirm your appointment. Please keep your reference number for follow-up.",
};

// The 13 built-in fields, seeded as ordinary CustomFormField rows so they're
// editable/reorderable/removable through the same admin UI as custom
// fields. `type` is filler for these — rendering dispatches on systemKey.
const DEFAULT_SYSTEM_FIELDS: Omit<CustomFormField, "id">[] = [
  { key: "name", systemKey: "name", label: "Full Name", placeholder: "Juan Dela Cruz", type: "text", required: true, options: [], order: 0, active: true },
  { key: "phone", systemKey: "phone", label: "Mobile Number", placeholder: "0917 123 4567", type: "text", required: true, options: [], order: 1, active: true },
  { key: "email", systemKey: "email", label: "Email (optional)", placeholder: "juan@email.com", type: "text", required: false, options: [], order: 2, active: true },
  { key: "device_brand", systemKey: "device_brand", label: "Device Brand", placeholder: "", type: "select", required: true, options: [], order: 3, active: true },
  { key: "device_model", systemKey: "device_model", label: "Device Model", placeholder: "Specify brand & model", type: "select", required: false, options: [], order: 4, active: true },
  { key: "service_type", systemKey: "service_type", label: "Service Type", placeholder: "", type: "select", required: true, options: [], order: 5, active: true },
  { key: "issue", systemKey: "issue", label: "Describe the Issue", placeholder: "e.g. Cracked screen, battery drains fast...", type: "textarea", required: true, options: [], order: 6, active: true },
  { key: "photo", systemKey: "photo", label: "Photo of the Issue (optional)", placeholder: "", type: "text", required: false, options: [], order: 7, active: true },
  { key: "street", systemKey: "street", label: "Street Address / House No.", placeholder: "e.g. 123 Mabini St.", type: "text", required: true, options: [], order: 8, active: true },
  { key: "city", systemKey: "city", label: "City / Municipality", placeholder: "e.g. Quezon City", type: "text", required: true, options: [], order: 9, active: true },
  { key: "province", systemKey: "province", label: "Province", placeholder: "e.g. Metro Manila", type: "text", required: false, options: [], order: 10, active: true },
  { key: "landmark", systemKey: "landmark", label: "Landmark (optional)", placeholder: "e.g. Near Jollibee", type: "text", required: false, options: [], order: 11, active: true },
  { key: "datetime", systemKey: "datetime", label: "Preferred Date", placeholder: "", type: "date", required: true, options: [], order: 12, active: true },
];

function id(store: Store, prefix: string) {
  store.seq += 1;
  return `${prefix}-${store.seq}`;
}

// This repo is public, so seeded account passwords can't be hardcoded in
// source. Each reads from an env var (set these in Vercel's dashboard, or
// in a local .env.local — both are gitignored) and falls back to a
// randomly generated one-time password printed to the server console, so
// the demo still works out of the box without ever committing a real
// credential.
function seedPassword(envVar: string, label: string): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  const words = ["Coral", "Ember", "Falcon", "Granite", "Harbor", "Indigo", "Juniper", "Kestrel", "Lumen", "Meadow", "Nectar", "Onyx", "Pixel", "Quartz", "Ripple", "Solstice", "Thicket", "Umber", "Violet", "Willow"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const generated = `${pick()}${pick()}${Math.floor(1000 + Math.random() * 9000)}!`;
  console.log(`[seed] No ${envVar} set — generated a one-time ${label} password: ${generated}`);
  return generated;
}

function seed(): Store {
  const store: Store = {
    users: [],
    branches: [],
    zones: [],
    technicians: [],
    customers: [],
    lookups: [],
    deviceModels: [],
    leads: [],
    requests: [],
    activity: [],
    inventory: [],
    stockMovements: [],
    sales: [],
    siteContent: { ...DEFAULT_SITE_CONTENT },
    requestFormContent: { ...DEFAULT_REQUEST_FORM_CONTENT },
    customFormFields: [],
    serviceAgreements: [],
    notifications: [],
    seq: 0,
  };

  store.customFormFields = DEFAULT_SYSTEM_FIELDS.map((f) => ({ ...f, id: id(store, "field") }));

  store.branches = [
    { id: id(store, "br"), name: "Cubao", address: "Level 4, Farmers Plaza Cubao, Quezon City", contactNumber: "09455060002", active: true },
    { id: id(store, "br"), name: "Greenhills", address: "Level 3, Vmall Greenhills, San Juan City", contactNumber: "09152127000", active: true },
    { id: id(store, "br"), name: "Malolos", address: "Puregold Jr. Crossing, Malolos, Bulacan", contactNumber: "09673100077", active: true },
  ];

  // Zones intentionally start empty — per owner decision, no predefined
  // Philippine location list is hardcoded. Admins add zones as coverage
  // is learned.
  store.zones = [];

  // Device brands/models: Apple pre-seeded as a starting convenience, fully
  // editable via Admin > Device Catalog.
  const appleBrand: LookupItem = { id: id(store, "brand"), kind: "device_brand", label: "Apple", order: 0, active: true };
  const samsungBrand: LookupItem = { id: id(store, "brand"), kind: "device_brand", label: "Samsung", order: 1, active: true };
  store.lookups.push(appleBrand, samsungBrand);
  store.deviceModels = [
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPhone 15 Pro Max", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPhone 15", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPhone 14", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPhone 13", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPhone SE (2022)", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "iPad Pro 12.9\"", active: true },
    { id: id(store, "model"), brandId: appleBrand.id, name: "MacBook Pro 14\"", active: true },
    { id: id(store, "model"), brandId: samsungBrand.id, name: "Galaxy S24", active: true },
  ];

  const leadStatuses = ["New", "Contacted", "Quoted", "Converted", "Lost"];
  leadStatuses.forEach((label, i) =>
    store.lookups.push({ id: id(store, "ls"), kind: "lead_status", label, order: i, active: true })
  );

  const requestStatuses = ["Pending", "Assigned", "En Route", "In Progress", "Completed", "Cancelled"];
  requestStatuses.forEach((label, i) =>
    store.lookups.push({ id: id(store, "rs"), kind: "request_status", label, order: i, active: true })
  );

  const serviceTypes = ["Screen Repair", "Battery Replacement", "Water Damage", "Charging Port", "Software / Data Recovery", "Diagnostic Checkup"];
  serviceTypes.forEach((label, i) =>
    store.lookups.push({ id: id(store, "st"), kind: "service_type", label, order: i, active: true })
  );

  const sources = ["Walk-in", "Home Service", "Referral", "Facebook", "Website"];
  sources.forEach((label, i) =>
    store.lookups.push({ id: id(store, "src"), kind: "customer_source", label, order: i, active: true })
  );

  store.technicians = [
    { id: id(store, "tech"), name: "Marco Reyes", contactNumber: "0917-200-0001", email: "marco@ceejay.ph", employmentStatus: "full_time", branchIds: [store.branches[0].id], zoneIds: [], active: true },
    { id: id(store, "tech"), name: "Liza Fernandez", contactNumber: "0917-200-0002", email: "liza@ceejay.ph", employmentStatus: "full_time", branchIds: [store.branches[1].id], zoneIds: [], active: true },
    { id: id(store, "tech"), name: "Jun Santos", contactNumber: "0917-200-0003", email: "jun@ceejay.ph", employmentStatus: "part_time", branchIds: [store.branches[2].id], zoneIds: [], active: true },
  ];

  store.users = [
    { id: id(store, "user"), name: "Ceejay Owner", email: "ceejay.spaxx@yahoo.com", password: seedPassword("SEED_ADMIN_PASSWORD", "owner admin"), role: "owner_admin", technicianId: null, active: true },
    { id: id(store, "user"), name: "Branch Admin", email: "branch@ceejay.ph", password: seedPassword("SEED_BRANCH_PASSWORD", "branch admin"), role: "branch_admin", technicianId: null, active: true },
    { id: id(store, "user"), name: "Marco Reyes", email: "marco@ceejay.ph", password: seedPassword("SEED_TECH_PASSWORD", "technician"), role: "technician", technicianId: store.technicians[0].id, active: true },
  ];

  // Parts inventory: categories are admin-editable lookups like everything
  // else. A handful of starter items are seeded per branch, a couple
  // intentionally below reorder level to demo the low-stock indicator.
  const categoryLabels = ["Screens", "Batteries", "Charging Accessories", "Tools & Small Parts"];
  const categories = categoryLabels.map((label, i) => {
    const cat: LookupItem = { id: id(store, "cat"), kind: "inventory_category", label, order: i, active: true };
    store.lookups.push(cat);
    return cat;
  });
  const [screens, batteries, charging, tools] = categories;
  const [brDowntown, brUptown, brCentral] = store.branches;

  store.inventory = [
    { id: id(store, "inv"), sku: "SCR-IP14-BLK", name: "iPhone 14 Screen Assembly (Black)", categoryId: screens.id, branchId: brDowntown.id, quantityOnHand: 8, reorderLevel: 3, unitCost: 3200, unitPrice: 5500, active: true },
    { id: id(store, "inv"), sku: "SCR-IP13-BLK", name: "iPhone 13 Screen Assembly (Black)", categoryId: screens.id, branchId: brDowntown.id, quantityOnHand: 2, reorderLevel: 3, unitCost: 2800, unitPrice: 4800, active: true },
    { id: id(store, "inv"), sku: "BAT-IP14", name: "iPhone 14 Battery", categoryId: batteries.id, branchId: brDowntown.id, quantityOnHand: 12, reorderLevel: 5, unitCost: 900, unitPrice: 1800, active: true },
    { id: id(store, "inv"), sku: "CHG-LTN-1M", name: "Lightning Cable 1m", categoryId: charging.id, branchId: brDowntown.id, quantityOnHand: 25, reorderLevel: 10, unitCost: 150, unitPrice: 350, active: true },

    { id: id(store, "inv"), sku: "SCR-IP15-WHT", name: "iPhone 15 Screen Assembly (White)", categoryId: screens.id, branchId: brUptown.id, quantityOnHand: 5, reorderLevel: 3, unitCost: 3800, unitPrice: 6200, active: true },
    { id: id(store, "inv"), sku: "BAT-IP13", name: "iPhone 13 Battery", categoryId: batteries.id, branchId: brUptown.id, quantityOnHand: 1, reorderLevel: 5, unitCost: 850, unitPrice: 1700, active: true },
    { id: id(store, "inv"), sku: "TOOL-KIT-01", name: "Precision Repair Tool Kit", categoryId: tools.id, branchId: brUptown.id, quantityOnHand: 6, reorderLevel: 2, unitCost: 500, unitPrice: 900, active: true },

    { id: id(store, "inv"), sku: "BAT-S24", name: "Samsung Galaxy S24 Battery", categoryId: batteries.id, branchId: brCentral.id, quantityOnHand: 4, reorderLevel: 4, unitCost: 950, unitPrice: 1900, active: true },
    { id: id(store, "inv"), sku: "CHG-USBC-1M", name: "USB-C Cable 1m", categoryId: charging.id, branchId: brCentral.id, quantityOnHand: 30, reorderLevel: 10, unitCost: 130, unitPrice: 300, active: true },
    { id: id(store, "inv"), sku: "TOOL-SUCTION", name: "Suction Cup Opening Tool", categoryId: tools.id, branchId: brCentral.id, quantityOnHand: 0, reorderLevel: 3, unitCost: 80, unitPrice: 200, active: true },
  ];

  return store;
}

const g = globalThis as unknown as { __ceejayStore?: Store };
if (!g.__ceejayStore) {
  g.__ceejayStore = seed();
}
export const store = g.__ceejayStore;

export function nextId(prefix: string) {
  return id(store, prefix);
}

export function logActivity(entityType: ActivityLog["entityType"], entityId: string, message: string, actor: string) {
  store.activity.push({
    id: nextId("act"),
    entityType,
    entityId,
    message,
    actor,
    at: new Date().toISOString(),
  });
}

export function notifyAdmins(type: Notification["type"], requestId: string, message: string) {
  store.notifications.push({
    id: nextId("notif"),
    type,
    requestId,
    message,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}
