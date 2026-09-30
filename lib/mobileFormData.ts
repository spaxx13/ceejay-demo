// JSON body → FormData for the mobile API's action wrappers, matching what
// the web forms' `new FormData(formElement)` produces: booleans are only
// set when true ("on"), mirroring the checkbox `.has()` convention the
// actions check against; null/undefined keys are omitted.
export function jsonToFormData(body: Record<string, unknown>, overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, String(value));
    }
  }
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

export function parseJsonBody(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
