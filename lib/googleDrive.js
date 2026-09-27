// Google Drive access via a user OAuth refresh token (not a service account —
// this Google Cloud org blocks service-account key creation). See the
// "Google Drive OAuth" section of the project spec doc for how the
// credentials were obtained.

const { TIMEZONE } = require('./autoposter-config');

/**
 * Exchanges the long-lived refresh token for a short-lived access token.
 * Called fresh on every pipeline run (access tokens last ~1 hour, so there's
 * no point caching across invocations of a serverless function).
 */
async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Lists image files directly inside a Drive folder (non-trashed), oldest
 * first by creation time.
 */
async function listImagesInFolder(folderId, accessToken) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`
  );
  const fields = encodeURIComponent('files(id,name,mimeType,createdTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime&pageSize=1000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.files || [];
}

/** Downloads a single file's bytes as a Buffer. */
async function downloadFile(fileId, accessToken) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive download failed for ${fileId} (${res.status}): ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Returns YYYY-MM-DD for a file's createdTime, in the shop's timezone. */
function dayKeyFor(createdTimeIso) {
  const date = new Date(createdTimeIso);
  // en-CA gives YYYY-MM-DD directly.
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/** Today's YYYY-MM-DD in the shop's timezone. */
function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/** Groups files by day key. Returns a Map<dayKey, files[]>. */
function groupByDay(files) {
  const byDay = new Map();
  for (const file of files) {
    const key = dayKeyFor(file.createdTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(file);
  }
  return byDay;
}

/**
 * Picks the oldest day that:
 *  - is not already in postedDates
 *  - is strictly before today (i.e. the day is "closed", past the 11:59 PM
 *    cutoff, so no more photos will land in it)
 * Returns the day key, or null if there's nothing to post.
 */
function pickOldestUnpostedDay(byDay, postedDates) {
  const today = todayKey();
  const candidateDays = [...byDay.keys()]
    .filter((day) => day <= today && !postedDates.has(day))
    .sort(); // ascending, oldest first

  return candidateDays.length > 0 ? candidateDays[0] : null;
}

module.exports = {
  getAccessToken,
  listImagesInFolder,
  downloadFile,
  groupByDay,
  pickOldestUnpostedDay,
  todayKey,
};
