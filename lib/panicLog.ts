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
// guessing wrong. The diagnosis below is a rule-based triage aid for a
// technician — informed best guesses from known panic patterns, not a
// certified diagnosis; always confirm with a physical inspection. Confidence
// and per-part likelihood figures are the shop's own estimates of how often
// each cause turns out to be right in practice, not a statistic computed
// from this specific log.

export type AffectedPart = {
  part: string;
  // Likelihood (0-100) that this specific part is the culprit, relative to
  // the other listed parts for this diagnosis. null when the diagnosis is
  // software-side and no hardware part is implicated at all.
  likelihood: number | null;
};

export type PanicDiagnosis = {
  detectedProblem: string;
  primaryCause: string;
  // Overall confidence (0-100) that this diagnosis correctly identifies the
  // issue, based on how specific/reliable the matched panic pattern is.
  confidence: number;
  affectedParts: AffectedPart[];
  recommendation: string;
};

export type PanicLogSummary = {
  device: string | null; // raw Apple model identifier, e.g. "iPhone14,5"
  deviceName: string | null; // friendly marketing name, e.g. "iPhone 13"
  osVersion: string | null;
  buildVersion: string | null;
  incidentDate: string | null;
  incidentId: string | null;
  panicType: string | null;
  panicString: string | null;
  diagnosis: PanicDiagnosis | null;
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

// Apple's internal model identifier -> the name printed on the box. Covers
// iPhone 6s through the 16 lineup, which is the range a repair shop
// realistically sees. An identifier not in this table just falls back to
// showing the raw code — better than guessing wrong on a model we've never
// seen (e.g. a future release after this list was last updated).
const IPHONE_MODEL_NAMES: Record<string, string> = {
  "iPhone8,1": "iPhone 6s",
  "iPhone8,2": "iPhone 6s Plus",
  "iPhone8,4": "iPhone SE (1st generation)",
  "iPhone9,1": "iPhone 7",
  "iPhone9,3": "iPhone 7",
  "iPhone9,2": "iPhone 7 Plus",
  "iPhone9,4": "iPhone 7 Plus",
  "iPhone10,1": "iPhone 8",
  "iPhone10,4": "iPhone 8",
  "iPhone10,2": "iPhone 8 Plus",
  "iPhone10,5": "iPhone 8 Plus",
  "iPhone10,3": "iPhone X",
  "iPhone10,6": "iPhone X",
  "iPhone11,2": "iPhone XS",
  "iPhone11,4": "iPhone XS Max",
  "iPhone11,6": "iPhone XS Max",
  "iPhone11,8": "iPhone XR",
  "iPhone12,1": "iPhone 11",
  "iPhone12,3": "iPhone 11 Pro",
  "iPhone12,5": "iPhone 11 Pro Max",
  "iPhone12,8": "iPhone SE (2nd generation)",
  "iPhone13,1": "iPhone 12 mini",
  "iPhone13,2": "iPhone 12",
  "iPhone13,3": "iPhone 12 Pro",
  "iPhone13,4": "iPhone 12 Pro Max",
  "iPhone14,4": "iPhone 13 mini",
  "iPhone14,5": "iPhone 13",
  "iPhone14,2": "iPhone 13 Pro",
  "iPhone14,3": "iPhone 13 Pro Max",
  "iPhone14,6": "iPhone SE (3rd generation)",
  "iPhone14,7": "iPhone 14",
  "iPhone14,8": "iPhone 14 Plus",
  "iPhone15,2": "iPhone 14 Pro",
  "iPhone15,3": "iPhone 14 Pro Max",
  "iPhone15,4": "iPhone 15",
  "iPhone15,5": "iPhone 15 Plus",
  "iPhone16,1": "iPhone 15 Pro",
  "iPhone16,2": "iPhone 15 Pro Max",
  "iPhone17,3": "iPhone 16",
  "iPhone17,4": "iPhone 16 Plus",
  "iPhone17,1": "iPhone 16 Pro",
  "iPhone17,2": "iPhone 16 Pro Max",
};

function friendlyDeviceName(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().replace(/\s+/g, "");
  return IPHONE_MODEL_NAMES[key] ?? null;
}

// Ordered most-specific-first: the first rule whose pattern matches the
// panic text is taken as the top likely cause. A watchdog timeout is
// checked before subsystem-keyword rules because it names the *mechanism*
// of the crash (a process stopped responding) regardless of which daemon
// is named — e.g. "watchdog timeout: backlightd" is a hung software
// process, not a hardware backlight fault, even though "backlight" appears.
const DIAGNOSIS_RULES: { pattern: RegExp; diagnosis: (m: RegExpMatchArray) => PanicDiagnosis }[] = [
  {
    pattern: /watchdog timeout:?\s*([A-Za-z0-9_.\-]+)?/i,
    diagnosis: (m) => ({
      detectedProblem: m[1] ? `Software watchdog timeout — "${m[1]}" stopped responding and was force-restarted.` : "Software watchdog timeout — a process stopped responding and was force-restarted.",
      primaryCause: "A frozen app or system process failed to respond within its allotted time, so the watchdog restarted the device. This is a software/firmware symptom, not a component failure.",
      confidence: 85,
      affectedParts: [{ part: "No specific hardware part — software/firmware issue", likelihood: null }],
      recommendation: "Update to the latest iOS version and monitor for recurrence. If it keeps happening after a clean restart, back up and restore the device via DFU before suspecting hardware.",
    }),
  },
  {
    pattern: /\b(i2c|spi)\b[^\n]*(timeout|time-?out|error|fail|no ack|not responding)/i,
    diagnosis: (m) => ({
      detectedProblem: `Hardware communication failure on the ${m[1].toUpperCase()} bus — a component failed to respond to the system controller.`,
      primaryCause: "A chip on this bus (commonly the display's backlight/touch controller, or another peripheral IC) isn't responding — usually a damaged flex cable/connector, or a failed IC.",
      confidence: 70,
      affectedParts: [
        { part: "Display flex cable / connector", likelihood: 55 },
        { part: "Display assembly (backlight/touch controller)", likelihood: 30 },
        { part: "Logic board connector for the affected bus", likelihood: 15 },
      ],
      recommendation: "Reseat the display flex cable/connector first. If the panic recurs, test with a known-good display; if it still occurs, the fault is likely on the logic board and may need board-level repair.",
    }),
  },
  {
    pattern: /backlight|iobacklight|display pipe|iomobileframebuffer/i,
    diagnosis: () => ({
      detectedProblem: "Display/backlight subsystem fault reported by the kernel.",
      primaryCause: "The display pipeline or backlight driver reported an error — often a display assembly or its connecting flex cable, less commonly the display driver IC on the logic board.",
      confidence: 55,
      affectedParts: [
        { part: "Display assembly (LCD/OLED)", likelihood: 60 },
        { part: "Display flex cable / connector", likelihood: 40 },
      ],
      recommendation: "Inspect and reseat the display connector. If the issue persists with a known-good display installed, escalate to logic-board-level display driver inspection.",
    }),
  },
  {
    pattern: /applesmc|\bsmc\b|\bpmu\b|power management/i,
    diagnosis: () => ({
      detectedProblem: "Power management (SMC/PMU) fault detected.",
      primaryCause: "The System Management Controller flagged an abnormal power condition — commonly a degraded battery, a loose battery connector, or a fault in the power management IC.",
      confidence: 65,
      affectedParts: [
        { part: "Battery", likelihood: 60 },
        { part: "Battery connector / flex cable", likelihood: 25 },
        { part: "Power management IC (logic board)", likelihood: 15 },
      ],
      recommendation: "Check battery health/cycle count and replace if degraded. If the panic recurs with a new, properly seated battery, the power management IC likely needs board-level repair.",
    }),
  },
  {
    pattern: /battery/i,
    diagnosis: () => ({
      detectedProblem: "Battery-related fault mentioned in the panic log.",
      primaryCause: "Likely a degraded, swollen, or poorly connected battery causing an unstable power supply.",
      confidence: 45,
      affectedParts: [
        { part: "Battery", likelihood: 70 },
        { part: "Battery connector / flex cable", likelihood: 30 },
      ],
      recommendation: "Check battery health and physical condition (swelling); replace if degraded, and confirm the connector is fully seated after replacement.",
    }),
  },
  {
    pattern: /baseband|modem panic|\bqmi\b/i,
    diagnosis: () => ({
      detectedProblem: "Baseband (cellular modem) crash detected.",
      primaryCause: "The cellular baseband processor crashed or stopped responding — often baseband firmware corruption, occasionally a hardware fault in the modem/RF section.",
      confidence: 60,
      affectedParts: [
        { part: "Baseband/modem IC (logic board)", likelihood: 60 },
        { part: "Antenna flex cables / RF connectors", likelihood: 40 },
      ],
      recommendation: "Try a full iOS reinstall via DFU restore first to rule out firmware corruption. If baseband panics continue, inspect antenna connectors and consider modem IC-level repair.",
    }),
  },
  {
    pattern: /thermal (shutdown|panic|trap)|over-?temp/i,
    diagnosis: () => ({
      detectedProblem: "Thermal shutdown — the device exceeded a safe operating temperature.",
      primaryCause: "Excessive internal heat, often from a failing battery, a shorted component, or heavy sustained use/charging in a hot environment.",
      confidence: 60,
      affectedParts: [
        { part: "Battery", likelihood: 50 },
        { part: "Charging IC", likelihood: 30 },
        { part: "Logic board (possible short)", likelihood: 20 },
      ],
      recommendation: "Check the battery for swelling/damage, test with a different (certified) charger and cable, and inspect the logic board for signs of a short or liquid damage.",
    }),
  },
  {
    pattern: /\bnand\b|ans2|flash storage[^\n]*(error|fail)/i,
    diagnosis: () => ({
      detectedProblem: "Storage (NAND flash) or filesystem error reported by the kernel.",
      primaryCause: "The flash storage or its controller reported a read/write failure — from NAND wear/corruption, or a logic board-level storage fault.",
      confidence: 65,
      affectedParts: [{ part: "NAND flash storage (logic board)", likelihood: 100 }],
      recommendation: "Back up any recoverable data immediately, then attempt a DFU restore. If storage errors persist, the NAND chip likely needs replacement — data recovery may be required first.",
    }),
  },
  {
    pattern: /multitouch|digitizer[^\n]*(fail|timeout|error)/i,
    diagnosis: () => ({
      detectedProblem: "Touch/digitizer controller fault detected.",
      primaryCause: "The touch controller failed to respond — usually a damaged digitizer/display assembly or its connector.",
      confidence: 60,
      affectedParts: [
        { part: "Display assembly (digitizer)", likelihood: 70 },
        { part: "Display flex cable / connector", likelihood: 30 },
      ],
      recommendation: "Reseat the display connector and retest. If touch issues continue, replace the display assembly.",
    }),
  },
  {
    pattern: /jetsam|out of memory|low memory/i,
    diagnosis: () => ({
      detectedProblem: "Memory-pressure crash (jetsam) — the system ran critically low on memory.",
      primaryCause: "Usually caused by a misbehaving app consuming excessive memory, not a hardware fault.",
      confidence: 80,
      affectedParts: [{ part: "No specific hardware part — software/app issue", likelihood: null }],
      recommendation: "Identify and update/remove the offending app if named in the log. Rarely indicates a hardware problem unless it recurs after a clean restore.",
    }),
  },
  {
    pattern: /panic\(cpu|kernel panic|fatal exception|trap number/i,
    diagnosis: () => ({
      detectedProblem: "Kernel-level panic (system crash) with no specific hardware subsystem identified in the log.",
      primaryCause: "The exact trigger couldn't be pinpointed from the available text — commonly a software/firmware fault, though hardware can't be ruled out without further testing.",
      confidence: 30,
      affectedParts: [{ part: "Undetermined from this log — review the full panic string/backtrace, or reproduce and capture a fresh log", likelihood: null }],
      recommendation: "Update to the latest iOS version and monitor. If panics continue, run a full hardware diagnostic and inspect the logic board for physical damage or corrosion.",
    }),
  },
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

  // Search the panic string first (it's the authoritative signal) and fall
  // back to the whole log only if there's no panic string to go on.
  const searchText = panicString ?? content;
  let diagnosis: PanicDiagnosis | null = null;
  for (const rule of DIAGNOSIS_RULES) {
    const m = searchText.match(rule.pattern);
    if (m) {
      diagnosis = rule.diagnosis(m);
      break;
    }
  }

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

  return {
    device,
    deviceName: friendlyDeviceName(device),
    osVersion,
    buildVersion,
    incidentDate,
    incidentId,
    panicType,
    panicString,
    diagnosis,
    looksLikePanicLog,
    raw,
  };
}
