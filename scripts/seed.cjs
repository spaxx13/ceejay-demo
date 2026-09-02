// One-off seed script for the Supabase database — the DB equivalent of the
// old lib/store.ts seed() function. Run with:
//   node --env-file=.env.local scripts/seed.cjs
// Safe to re-run: it checks for existing rows and skips seeding if the
// branches table already has data.

const { Client } = require("pg");
const bcrypt = require("bcryptjs");

function seedPassword(envVar, label) {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  const words = ["Coral", "Ember", "Falcon", "Granite", "Harbor", "Indigo", "Juniper", "Kestrel", "Lumen", "Meadow", "Nectar", "Onyx", "Pixel", "Quartz", "Ripple", "Solstice", "Thicket", "Umber", "Violet", "Willow"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const generated = `${pick()}${pick()}${Math.floor(1000 + Math.random() * 9000)}!`;
  console.log(`[seed] No ${envVar} set — generated a one-time ${label} password: ${generated}`);
  return generated;
}

async function main() {
  const connectionString = (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "").split("?")[0];
  if (!connectionString) throw new Error("POSTGRES_URL / POSTGRES_URL_NON_POOLING not set");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const existing = await client.query("select count(*)::int as n from branches");
    if (existing.rows[0].n > 0) {
      console.log("[seed] branches table already has data — skipping (delete rows first if you want to reseed).");
      return;
    }

    await client.query("begin");

    // Custom form fields (the 13 built-in system fields)
    const systemFields = [
      ["name", "name", "Full Name", "Juan Dela Cruz", "text", true, [], 0],
      ["phone", "phone", "Mobile Number", "0917 123 4567", "text", true, [], 1],
      ["email", "email", "Email", "juan@email.com", "text", true, [], 2],
      ["device_brand", "device_brand", "Device Brand", "", "select", true, [], 3],
      ["device_model", "device_model", "Device Model", "Specify brand & model", "select", false, [], 4],
      ["service_type", "service_type", "Service Type", "", "select", true, [], 5],
      ["issue", "issue", "Describe the Issue", "e.g. Cracked screen, battery drains fast...", "textarea", true, [], 6],
      ["photo", "photo", "Photo of the Issue (optional)", "", "text", false, [], 7],
      ["street", "street", "Street Address / House No.", "e.g. 123 Mabini St.", "text", true, [], 8],
      ["city", "city", "City / Municipality", "e.g. Quezon City", "text", true, [], 9],
      ["province", "province", "Province", "e.g. Metro Manila", "text", false, [], 10],
      ["landmark", "landmark", "Landmark (optional)", "e.g. Near Jollibee", "text", false, [], 11],
      ["datetime", "datetime", "Preferred Date", "", "date", true, [], 12],
    ];
    for (const [key, systemKey, label, placeholder, type, required, options, order] of systemFields) {
      await client.query(
        "insert into custom_form_fields (key, system_key, label, placeholder, type, required, options, order_num) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [key, systemKey, label, placeholder, type, required, options, order]
      );
    }

    // Branches
    const branchRows = await client.query(
      `insert into branches (name, address, contact_number) values
        ('Cubao', 'Level 4, Farmers Plaza Cubao, Quezon City', '09455060002'),
        ('Greenhills', 'Level 3, Vmall Greenhills, San Juan City', '09152127000'),
        ('Malolos', 'Puregold Jr. Crossing, Malolos, Bulacan', '09673100077')
       returning id, name`
    );
    const branchByName = Object.fromEntries(branchRows.rows.map((r) => [r.name, r.id]));

    // Device brands/models
    const appleBrand = (await client.query("insert into lookups (kind, label, order_num) values ('device_brand','Apple',0) returning id")).rows[0].id;
    const samsungBrand = (await client.query("insert into lookups (kind, label, order_num) values ('device_brand','Samsung',1) returning id")).rows[0].id;
    const appleModels = ["iPhone 15 Pro Max", "iPhone 15", "iPhone 14", "iPhone 13", "iPhone SE (2022)", 'iPad Pro 12.9"', 'MacBook Pro 14"'];
    for (const name of appleModels) {
      await client.query("insert into device_models (brand_id, name) values ($1,$2)", [appleBrand, name]);
    }
    await client.query("insert into device_models (brand_id, name) values ($1,$2)", [samsungBrand, "Galaxy S24"]);

    // Lookups: statuses, service types, sources
    const leadStatuses = ["New", "Contacted", "Quoted", "Converted", "Lost"];
    for (let i = 0; i < leadStatuses.length; i++) {
      await client.query("insert into lookups (kind, label, order_num) values ('lead_status',$1,$2)", [leadStatuses[i], i]);
    }
    const requestStatuses = ["Pending", "Assigned", "En Route", "In Progress", "Completed", "Cancelled"];
    for (let i = 0; i < requestStatuses.length; i++) {
      await client.query("insert into lookups (kind, label, order_num) values ('request_status',$1,$2)", [requestStatuses[i], i]);
    }
    const serviceTypes = ["Screen Repair", "Battery Replacement", "Water Damage", "Charging Port", "Software / Data Recovery", "Diagnostic Checkup"];
    for (let i = 0; i < serviceTypes.length; i++) {
      await client.query("insert into lookups (kind, label, order_num) values ('service_type',$1,$2)", [serviceTypes[i], i]);
    }
    const sources = ["Walk-in", "Home Service", "Referral", "Facebook", "Website"];
    for (let i = 0; i < sources.length; i++) {
      await client.query("insert into lookups (kind, label, order_num) values ('customer_source',$1,$2)", [sources[i], i]);
    }
    const categoryLabels = ["Screens", "Batteries", "Charging Accessories", "Tools & Small Parts"];
    const categoryIds = {};
    for (let i = 0; i < categoryLabels.length; i++) {
      const row = await client.query("insert into lookups (kind, label, order_num) values ('inventory_category',$1,$2) returning id", [categoryLabels[i], i]);
      categoryIds[categoryLabels[i]] = row.rows[0].id;
    }
    const expenseCategories = ["Rent", "Utilities", "Supplies", "Salaries", "Miscellaneous"];
    for (let i = 0; i < expenseCategories.length; i++) {
      await client.query("insert into lookups (kind, label, order_num) values ('expense_category',$1,$2)", [expenseCategories[i], i]);
    }

    // Technicians
    const techRows = await client.query(
      `insert into technicians (name, contact_number, email, employment_status, branch_ids) values
        ('Marco Reyes', '0917-200-0001', 'marco@ceejay.ph', 'full_time', $1),
        ('Liza Fernandez', '0917-200-0002', 'liza@ceejay.ph', 'full_time', $2),
        ('Jun Santos', '0917-200-0003', 'jun@ceejay.ph', 'part_time', $3)
       returning id, name`,
      [[branchByName["Cubao"]], [branchByName["Greenhills"]], [branchByName["Malolos"]]]
    );
    const marcoId = techRows.rows.find((r) => r.name === "Marco Reyes").id;

    // Users (bcrypt-hashed passwords, from env vars)
    const adminHash = await bcrypt.hash(seedPassword("SEED_ADMIN_PASSWORD", "owner admin"), 10);
    const branchHash = await bcrypt.hash(seedPassword("SEED_BRANCH_PASSWORD", "branch admin"), 10);
    const techHash = await bcrypt.hash(seedPassword("SEED_TECH_PASSWORD", "technician"), 10);
    await client.query(
      `insert into users (name, email, password_hash, role, technician_id) values
        ('Ceejay Owner', 'ceejay.spaxx@yahoo.com', $1, 'owner_admin', null),
        ('Branch Admin', 'branch@ceejay.ph', $2, 'branch_admin', null),
        ('Marco Reyes', 'marco@ceejay.ph', $3, 'technician', $4)`,
      [adminHash, branchHash, techHash, marcoId]
    );

    // Inventory
    const inv = [
      ["SCR-IP14-BLK", "iPhone 14 Screen Assembly (Black)", "Screens", "Cubao", 8, 3, 3200, 5500],
      ["SCR-IP13-BLK", "iPhone 13 Screen Assembly (Black)", "Screens", "Cubao", 2, 3, 2800, 4800],
      ["BAT-IP14", "iPhone 14 Battery", "Batteries", "Cubao", 12, 5, 900, 1800],
      ["CHG-LTN-1M", "Lightning Cable 1m", "Charging Accessories", "Cubao", 25, 10, 150, 350],
      ["SCR-IP15-WHT", "iPhone 15 Screen Assembly (White)", "Screens", "Greenhills", 5, 3, 3800, 6200],
      ["BAT-IP13", "iPhone 13 Battery", "Batteries", "Greenhills", 1, 5, 850, 1700],
      ["TOOL-KIT-01", "Precision Repair Tool Kit", "Tools & Small Parts", "Greenhills", 6, 2, 500, 900],
      ["BAT-S24", "Samsung Galaxy S24 Battery", "Batteries", "Malolos", 4, 4, 950, 1900],
      ["CHG-USBC-1M", "USB-C Cable 1m", "Charging Accessories", "Malolos", 30, 10, 130, 300],
      ["TOOL-SUCTION", "Suction Cup Opening Tool", "Tools & Small Parts", "Malolos", 0, 3, 80, 200],
    ];
    for (const [sku, name, cat, branch, qty, reorder, cost, price] of inv) {
      await client.query(
        "insert into inventory_items (sku, name, category_id, branch_id, quantity_on_hand, reorder_level, unit_cost, unit_price) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [sku, name, categoryIds[cat], branchByName[branch], qty, reorder, cost, price]
      );
    }

    // Site content + request form content (singleton rows)
    await client.query(
      `insert into site_content (id, hero_kicker, hero_headline_prefix, hero_headline_highlight, hero_headline_suffix, hero_subtext, primary_cta_label, secondary_cta_label, cta_banner_title, cta_banner_subtitle, cta_banner_button_label)
       values (1, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "Apple Specialists · Multi-Brand Repair",
        "Cellphone repair that",
        "comes to you",
        "— or waits for you at the counter.",
        "Screen cracked? Battery dying? Book a technician to your doorstep, or visit one of our branches for same-day diagnostics.",
        "Book Home Service",
        "Find a Branch",
        "Don't want to leave the house?",
        "A technician can come to you — just tell us where and when.",
        "Book Home Service",
      ]
    );
    await client.query(
      `insert into request_form_content (id, page_kicker, page_title, page_subtitle, submit_button_label, success_title, success_body)
       values (1, $1,$2,$3,$4,$5,$6)`,
      [
        "Ceejay Cellphone Repair Shop",
        "Home Service Request",
        "Tell us about your device and we'll send a technician to your area.",
        "Submit Request",
        "Request submitted!",
        "We'll contact you to confirm your appointment. Please keep your reference number for follow-up.",
      ]
    );

    await client.query("commit");
    console.log("[seed] Done.");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[seed] FAILED:", e);
  process.exit(1);
});
