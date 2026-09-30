import "server-only";

// Supabase Storage over its plain REST API (no SDK) — the project already
// runs on Supabase Postgres, so the bucket lives next to the data. Server
// only: the service-role key never reaches the browser. Uploads go
// browser → Storage directly through a signed upload URL minted here, so a
// 20–40MB video never passes through a server action (6MB body cap);
// playback uses short-lived signed URLs since the bucket is private.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard > Project Settings >
// API Keys > service_role) is required. SUPABASE_URL is optional — it
// defaults to the shop's project below (the URL isn't a secret, only the
// key is), so only the key has to be configured.

const BUCKET = "unboxing-videos";
const DEFAULT_SUPABASE_URL = "https://fpvygxlxewygecdoujca.supabase.co";

function config() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { url, key } : null;
}

export function storageConfigured() {
  return config() !== null;
}

async function storageFetch(path: string, init: RequestInit) {
  const c = config();
  if (!c) throw new Error("Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const res = await fetch(`${c.url}/storage/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.key}`, apikey: c.key, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage ${res.status}: ${await res.text()}`);
  return res;
}

// One-time, token-scoped URL the browser PUTs the file to (same endpoint
// supabase-js's uploadToSignedUrl uses). Valid for a couple of hours.
export async function createSignedUploadUrl(objectPath: string): Promise<string> {
  const res = await storageFetch(`/object/upload/sign/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = (await res.json()) as { url: string };
  return `${config()!.url}/storage/v1${json.url}`;
}

export async function createSignedUrl(objectPath: string, expiresInSeconds = 60 * 60): Promise<string> {
  const res = await storageFetch(`/object/sign/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  const json = (await res.json()) as { signedURL: string };
  return `${config()!.url}/storage/v1${json.signedURL}`;
}

export async function deleteStorageObject(objectPath: string) {
  await storageFetch(`/object/${BUCKET}/${objectPath}`, { method: "DELETE" });
}

// Playback URL for a stored unboxing video, or null when there's none or
// storage isn't reachable — pages render "no video" rather than erroring.
export async function getUnboxingVideoUrl(objectPath: string | null): Promise<string | null> {
  if (!objectPath || !storageConfigured()) return null;
  try {
    return await createSignedUrl(objectPath);
  } catch {
    return null;
  }
}
