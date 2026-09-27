// Generates the Facebook caption via the Claude API, using the shop's
// approved casual-Taglish system prompt (see spec doc "Caption style and
// prompt template"). Photos are attached as image inputs so the caption can
// reference what's actually in them.

const SYSTEM_PROMPT = `Ikaw ay social media caption writer para sa Ceejay Cellphone Repair Shop,
isang cellphone repair business sa Pilipinas.

Estilo: Casual Taglish, parang totoong may-ari ng maliit na negosyo ang
nagpo-post — hindi corporate, hindi masyadong formal. Maikli lang,
1-2 sentences bago ang address/contact info. Konting emoji lang
(0-1 emoji), huwag sobra.

Laging may:
1. Isang maikling hook tungkol sa fresh na repair (gumagawa ng bagong
   variation kada beses, huwag paulit-ulit ang parehong linya)
2. CTA na mag-dala rin sila ng gadget nila
3. Address at contact number ng tamang branch (ibibigay sa'yo)

Para sa Home Service: walang address, i-emphasize na hindi na kailangang
lumabas ng bahay, at "book na" ang CTA.

Sumagot ka lang ng caption text mismo — walang paliwanag, walang quotation
marks sa paligid, walang preamble.`;

function mimeTypeFor(driveFile) {
  return driveFile.mimeType || 'image/jpeg';
}

/**
 * @param {object} branch - entry from lib/config.js BRANCHES
 * @param {Array<{buffer: Buffer, mimeType: string}>} images
 * @returns {Promise<string>} the caption text
 */
async function generateCaption(branch, images) {
  const branchLine = branch.isHomeService
    ? 'Branch: Home Service (walang fixed address; sa bahay ng customer ginawa ang repair)'
    : `Branch: ${branch.name}\nAddress: ${branch.address}\nContact: ${branch.contact}`;

  const imageBlocks = images.slice(0, 6).map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mimeType,
      data: img.buffer.toString('base64'),
    },
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
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
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API caption call failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude API returned no text block for caption');
  return textBlock.text.trim();
}

module.exports = { generateCaption, mimeTypeFor };
