// Posts a multi-photo "album" post to the shop's Facebook Page.
// Two-step Graph API flow: upload each photo unpublished, then attach the
// resulting photo IDs to one feed post.

const GRAPH_VERSION = 'v21.0';

function pageId() {
  return process.env.FB_PAGE_ID;
}

function pageToken() {
  return process.env.FB_PAGE_ACCESS_TOKEN;
}

/** Parses a Graph API response body, tolerating non-JSON (e.g. HTML 5xx pages). */
async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/**
 * Read-only preflight used by dry runs: confirms the Page token works and
 * belongs to FB_PAGE_ID, without posting anything. Never throws; returns
 * { ok, pageId, pageName } or { ok: false, error }.
 */
async function checkPageAccess() {
  const id = pageId();
  const token = pageToken();
  if (!id || !token) {
    return { ok: false, error: `missing env var ${!id ? 'FB_PAGE_ID' : 'FB_PAGE_ACCESS_TOKEN'}` };
  }
  try {
    const params = new URLSearchParams({ fields: 'id,name', access_token: token });
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me?${params}`);
    const data = await readJson(res);
    if (!res.ok || !data.id) {
      return { ok: false, error: `Graph API ${res.status}: ${JSON.stringify(data.error || data)}` };
    }
    if (String(data.id) !== String(id)) {
      return {
        ok: false,
        pageId: data.id,
        pageName: data.name,
        error: `token belongs to "${data.name}" (id ${data.id}) but FB_PAGE_ID is ${id}`,
      };
    }
    return { ok: true, pageId: data.id, pageName: data.name };
  } catch (err) {
    return { ok: false, error: `network error: ${err.message}` };
  }
}

/**
 * Uploads one photo to the Page without publishing it standalone.
 * Returns the photo's Graph API id, for use in a later /feed post.
 */
async function uploadUnpublishedPhoto(buffer, mimeType) {
  const form = new FormData();
  form.append('published', 'false');
  form.append('access_token', pageToken());
  form.append('source', new Blob([buffer], { type: mimeType }), 'photo.jpg');

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId()}/photos`;
  const res = await fetch(url, { method: 'POST', body: form });

  const data = await readJson(res);
  if (!res.ok || !data.id) {
    throw new Error(`Facebook photo upload failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

/**
 * Publishes one feed post carrying the given caption and all previously
 * uploaded (unpublished) photo ids as an album.
 */
async function publishAlbumPost(caption, photoIds) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId()}/feed`;

  const body = new URLSearchParams({
    message: caption,
    access_token: pageToken(),
  });

  photoIds.forEach((id, i) => {
    body.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
  });

  const res = await fetch(url, { method: 'POST', body });
  const data = await readJson(res);

  if (!res.ok || !data.id) {
    throw new Error(`Facebook feed post failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.id; // the Page post id
}

module.exports = { checkPageAccess, uploadUnpublishedPhoto, publishAlbumPost };
