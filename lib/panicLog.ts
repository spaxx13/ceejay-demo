// Best-effort parser for Apple panic logs (.ips crash/panic reports from
// iPhone Settings > Privacy & Security > Analytics & Improvements > Analytics
// Data, or exported via Xcode/Console). Runs entirely client-side — nothing
// here touches the server or a database, the file never leaves the browser.
//
// Apple doesn't publish a stable schema for these, and the format has
// changed across iOS versions (plain-text key/value headers on older
// devices, a two-line JSON envelope+payload on newer ones), so this reads
// defensively: try structured JSON first, fall back to line-based regex
// extraction, and if neither finds a field just leave it blank rather than
// guessing wrong. The keyword hints are informational triage aids for a
// technician, not a certified diagnosis.

export type PanicLogSummary = {
  device: string | null;
  osVersion: string | null;
  buildVersion: string | null;
  incidentDate: string | null;
  incidentId: string | null;
  panicType: string | null;
  panicString: string | null;
  hints: string[];
  looksLikePanicLog: boolean;
  raw: string;
};

type Json = Record<string, unknown>;

function firstString(obj: Json, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function tryParseJson(text: string): Json | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Json) : null;
  } catch {
    return null;
  }
}

// Modern .ips files are a small JSON "envelope" line, a newline, then the
// full JSON "payload" — most of the useful fields live in the payload.
function parseStructured(content: string): { header: Json; payload: Json } | { payload: Json } | null {
  const trimmed = content.trim();
  const newlineIdx = trimmed.indexOf("\n");
  if (newlineIdx > 0) {
    const header = tryParseJson(trimmed.slice(0, newlineIdx));
    const payload = tryParseJson(trimmed.slice(newlineIdx + 1));
    if (header && payload) return { header, payload };
  }
  const wholeAsJson = tryParseJson(trimmed);
  if (wholeAsJson) return { payload: wholeAsJson };
  return null;
}

function lineValue(content: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*:\\s*(.+)$`, "im");
    const m = content.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

const HINT_RULES: { pattern: RegExp; hint: string }[] = [
  { pattern: /watchdog/i, hint: "Mentions a watchdog timeout — usually a software hang (an app or daemon stopped responding) rather than a hardware fault." },
  { pattern: /backlight|display pipe|iobacklight/i, hint: "Mentions the display/backlight subsystem — may point to a display module or display cable/connector fault." },
  { pattern: /\bsmc\b|battery/i, hint: "Mentions the battery or power management (SMC) — may indicate a battery or power-related fault." },
  { pattern: /baseband|modem|cellular|qmi/i, hint: "Mentions the baseband/modem — may indicate a cellular/baseband hardware fault or a bad connection to it." },
  { pattern: /\bi2c\b|\bspi\b/i, hint: "Mentions an I2C/SPI bus timeout — often a specific chip/component failing to respond, worth checking its connector/flex cable." },
  { pattern: /thermal|overheat/i, hint: "Mentions a thermal event — check for a cause of overheating (blocked vents, damaged battery, etc.)." },
  { pattern: /jetsam|out of memory|low memory/i, hint: "Memory-pressure related (jetsam) — usually a software/app issue, not hardware." },
  { pattern: /kernel panic|fatal exception|trap number|panic\(cpu/i, hint: "This is a kernel-level panic — the device crashed at the OS level, not just a single app." },
  { pattern: /nand|flash storage|filesystem/i, hint: "Mentions NAND/flash storage or the filesystem — may indicate a storage-related fault." },
  { pattern: /touch|multitouch/i, hint: "Mentions the touch/multitouch subsystem — may point to a digitizer or display-touch fault." },
];

export function parsePanicLog(content: string): PanicLogSummary {
  const raw = content;
  const structured = parseStructured(content);

  let device: string | null = null;
  let osVersion: string | null = null;
  let buildVersion: string | null = null;
  let incidentDate: string | null = null;
  let incidentId: string | null = null;
  let panicString: string | null = null;

  if (structured) {
    const merged: Json = "header" in structured ? { ...structured.header, ...structured.payload } : structured.payload;
    device = firstString(merged, ["product", "model", "modelCode", "hardwareModel"]);
    osVersion = firstString(merged, ["os_version", "osVersion", "build_version", "iOSVersion"]);
    buildVersion = firstString(merged, ["build", "buildVersion", "os_build"]);
    incidentDate = firstString(merged, ["date", "timestamp", "incident_date"]);
    incidentId = firstString(merged, ["incident_id", "incidentId", "incident_identifier"]);
    panicString = firstString(merged, ["panicString", "panic_string", "panicFlags", "reason"]);
  }

  // Fall back to (or supplement with) plain-text header parsing — covers
  // older iOS panic logs, and fills in anything structured parsing missed.
  device ??= lineValue(content, ["Hardware Model", "Product"]);
  osVersion ??= lineValue(content, ["OS Version", "iOS Version"]);
  buildVersion ??= lineValue(content, ["Build Version", "Build"]);
  incidentDate ??= lineValue(content, ["Date/Time", "Date"]);
  incidentId ??= lineValue(content, ["Incident Identifier"]);

  if (!panicString) {
    const panicSection = content.match(/Panic String:\s*([\s\S]{1,600}?)(?:\n\s*\n|\nPanic Log Version|\nKernel|$)/i);
    if (panicSection) panicString = panicSection[1].trim();
    else {
      const panicLine = content.match(/panic\([^\n]*\)[^\n]*/i);
      if (panicLine) panicString = panicLine[0].trim();
    }
  }

  const searchText = `${panicString ?? ""}\n${content}`;
  const hints = HINT_RULES.filter((r) => r.pattern.test(searchText)).map((r) => r.hint);

  let panicType: string | null = null;
  if (panicString) {
    if (/watchdog/i.test(panicString)) panicType = "Watchdog Timeout";
    else if (/kernel panic|panic\(cpu/i.test(panicString)) panicType = "Kernel Panic";
    else if (/fatal exception|trap number/i.test(panicString)) panicType = "Fatal Exception";
    else panicType = "Panic";
  }

  // panicString is only ever set via structured extraction above (a named
  // JSON field, a "Panic String:" section, or a matched "panic(...)" line)
  // — never a loose keyword search — so its presence is a real signal, not
  // just the word "panic" appearing incidentally somewhere in the input.
  const looksLikePanicLog = !!(device || osVersion || incidentId || panicString);

  return { device, osVersion, buildVersion, incidentDate, incidentId, panicType, panicString, hints, looksLikePanicLog, raw };
}
