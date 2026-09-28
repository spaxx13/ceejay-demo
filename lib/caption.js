// Generates the Facebook caption via the Claude API, using the shop's
// approved casual-Taglish system prompt (see spec doc "Caption style and
// prompt template"). Photos are attached as image inputs so the caption can
// reference what's actually in them.

const SYSTEM_PROMPT = `Ikaw ay social media caption writer para sa Ceejay Cellphone Repair Shop,
isang cellphone repair business sa Pilipinas.

Estilo: Casual Taglish, parang totoong may-ari ng maliit na negosyo ang
nagpo-post — hindi corporate, hindi masyadong formal. Maikli lang,
1-2 sentences. Konting emoji lang (0-1 emoji), huwag sobra.

Laging may:
1. Isang maikling hook tungkol sa fresh na repair (gumagawa ng bagong
   variation kada beses, huwag paulit-ulit ang parehong linya)
2. CTA na mag-dala rin sila ng gadget nila

HUWAG isama ang address, contact number, o pangalan ng mall/building —
awtomatikong idadagdag ng system ang eksaktong address at contact ng branch
sa dulo ng caption mo. Ang ipinapakitang larawan ay sample lang ng buong
post, kaya huwag banggitin ang eksaktong bilang ng gadget o larawan.

Para sa Home Service: i-emphasize na hindi na kailangang lumabas ng bahay,
at "book na" ang CTA.

Sumagot ka lang ng caption text mismo — walang paliwanag, walang quotation
marks sa paligid, walang preamble.`;

// Claude only accepts these image media types. Photos are normalized to JPEG
// in lib/image.js before they get here; this is a last line of defence so a
// bad entry produces a clear error instead of a 400 from the API.
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// The caption only needs a sample of the day's photos; 3-4 is plenty and
// keeps vision token cost down.
const MAX_CAPTION_IMAGES = 4;

// Transient failures worth retrying: rate limit, overloaded, server errors,
// and network errors. 400s (bad request) are never retried.
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const RETRY_DELAYS_MS = [2000, 5000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls doFetch, retrying on transient HTTP statuses or network errors.
 * Returns the last Response (even if not ok) so the caller can log its body.
 */
async function fetchWithRetry(doFetch, onRetry) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res = null;
    try {
      res = await doFetch();
    } catch (err) {
      lastErr = err;
    }
    if (res && !RETRY_STATUSES.has(res.status)) return res;
    if (attempt === RETRY_DELAYS_MS.length) {
      if (res) return res;
      throw new Error(`Claude API request failed after ${attempt + 1} attempts: ${lastErr.message}`);
    }
    onRetry(attempt + 1, res ? `HTTP ${res.status}` : lastErr.message);
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
  return null; // unreachable
}

/**
 * The address/contact block appended after Claude's text. Built from config
 * so the post always carries the exact branch details — the model is told
 * not to write them itself, because it can garble them (e.g. "Level 3"
 * instead of "Level 4").
 */
function branchFooter(branch) {
  const lines = [];
  if (branch.address) lines.push(`📍 ${branch.address}`);
  if (branch.contact) lines.push(`📞 ${branch.contact}`);
  return lines.join('\n');
}

/**
 * Removes any address/contact lines the model wrote despite instructions, so
 * they don't duplicate (or contradict) the footer from config.
 */
function stripContactLines(text, branch) {
  const needles = [branch.contact].filter(Boolean);
  const phoneRe = /\b0\d{3}[- ]?\d{3}[- ]?\d{4}\b/g; // PH mobile number

  const lines = text.split('\n').filter((line) => {
    const l = line.trim();
    if (/^(📍|📞|☎️|📱)/u.test(l)) return false;
    if (/^(address|contact|tawag|text|call)\s*[:：]/i.test(l)) return false;
    return true;
  });

  // Inline phone numbers: drop just the number, keep the sentence. An inline
  // address is left alone (removing it would mangle the sentence; the exact
  // one from config still follows in the footer).
  let out = lines.join('\n');
  for (const n of needles) out = out.split(n).join('');
  out = out.replace(phoneRe, '');

  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {object} branch - entry from lib/autoposter-config.js BRANCHES
 * @param {Array<{buffer: Buffer, mimeType: string, name?: string}>} images
 *   already normalized (see lib/image.js normalizeToJpeg)
 * @returns {Promise<string>} the full caption text, footer included
 */
async function generateCaption(branch, images) {
  const branchLine = branch.isHomeService
    ? 'Branch: Home Service (sa bahay ng customer ginawa ang repair)'
    : `Branch: ${branch.name}`;

  const imageBlocks = images.slice(0, MAX_CAPTION_IMAGES).map((img) => {
    if (!ALLOWED_MEDIA_TYPES.has(img.mimeType)) {
      throw new Error(
        `Unsupported image media type ${img.mimeType} for ${img.name || 'image'}; normalize to JPEG first`
      );
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.buffer.toString('base64'),
      },
    };
  });

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `${branchLine}\n\nGumawa ng caption para sa mga larawang ito.`,
          },
        ],
      },
    ],
  });

  const imageSummary = images
    .slice(0, MAX_CAPTION_IMAGES)
    .map((img) => `${img.name || 'image'}:${img.mimeType}:${img.buffer.length}B`)
    .join(', ');

  const res = await fetchWithRetry(
    () =>
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody,
      }),
    (attempt, why) =>
      console.warn(`[caption] Claude API attempt ${attempt} for ${branch.key} failed (${why}); retrying`)
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[caption] Claude API call failed (${res.status}) for branch ${branch.key}; ` +
        `${imageBlocks.length} image(s) [${imageSummary}]. Response body: ${body}`
    );
    throw new Error(`Claude API caption call failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude API returned no text block for caption');

  const raw = textBlock.text.trim();
  if (!raw) throw new Error('Claude API returned an empty caption');
  let body = stripContactLines(raw, branch);
  if (!body) {
    // The whole reply was contact info; keep it rather than post nothing.
    console.warn(`[caption] stripping contact lines emptied the caption for ${branch.key}; using raw text`);
    body = raw;
  }
  const footer = branchFooter(branch);
  return footer ? `${body}\n\n${footer}` : body;
}

module.exports = { generateCaption, fetchWithRetry, stripContactLines, branchFooter, MAX_CAPTION_IMAGES };
