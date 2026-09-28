// Normalizes photos coming out of Google Drive into plain JPEGs before they
// are sent to the Claude API (which only accepts jpeg/png/gif/webp) and to
// Facebook. Phones upload HEIC/HEIF a lot, and Drive's reported mimeType is
// not trustworthy (it's often derived from the filename), so the real format
// is sniffed from the file's magic bytes.
//
// Decoders:
//   - sharp        jpeg / png / gif / webp / tiff / avif -> resize + JPEG encode
//   - heic-decode  HEIC/HEIF (HEVC) -> raw RGBA pixels, handed to sharp for
//                  resize + JPEG encode. Prebuilt sharp ships libheif without
//                  an HEVC decoder, so it cannot open .heic files itself.
//                  heic-decode is the pure JS/WASM libheif build underneath
//                  heic-convert; using it directly skips heic-convert's slow
//                  pure-JS JPEG re-encode (jpeg-js) and one full-size copy.

const sharp = require('sharp');

// Long-edge cap. Plenty for Facebook and for vision-based captioning.
const MAX_DIMENSION = 1600;
// Per-photo byte cap (Claude's per-image limit is 5 MB; Facebook's is 4 MB
// for JPEG, but at 1600px the JPEG is well under both).
const MAX_BYTES = 5 * 1024 * 1024;
const JPEG_QUALITIES = [85, 75, 65, 55, 45];

const HEIF_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis', // HEIC image / image sequence
  'hevc', 'hevx', 'hevm', 'hevs', // HEVC image sequence
  'mif1', 'msf1', // generic HEIF (usually HEVC coded)
]);
const AVIF_BRANDS = new Set(['avif', 'avis']);

/**
 * Detects the real image format from the leading bytes.
 * @param {Buffer} buffer
 * @returns {'jpeg'|'png'|'gif'|'webp'|'heic'|'avif'|'tiff'|'bmp'|'unknown'}
 */
function detectFormat(buffer) {
  if (!buffer || buffer.length < 12) return 'unknown';

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (HEIF_BRANDS.has(brand)) return 'heic';
    if (AVIF_BRANDS.has(brand)) return 'avif';
    // Unknown ISO-BMFF brand — check the compatible brands list too, since
    // some encoders put e.g. 'mif1' as major brand and 'heic' as compatible.
    const compat = buffer.toString('ascii', 16, Math.min(buffer.length, 64)).toLowerCase();
    for (const b of HEIF_BRANDS) if (compat.includes(b)) return 'heic';
    for (const b of AVIF_BRANDS) if (compat.includes(b)) return 'avif';
    return 'unknown';
  }
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return 'tiff';
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'bmp';
  return 'unknown';
}

/**
 * Decodes the primary image of a HEIC/HEIF file to raw RGBA pixels.
 * libheif applies the file's rotation/mirror transforms, so the result is
 * already upright.
 * @returns {Promise<{data: Buffer, width: number, height: number}>}
 */
async function decodeHeic(buffer) {
  // Lazy-require: heic-decode pulls in a WASM libheif build, only pay for
  // it when a HEIC actually shows up.
  const decode = require('heic-decode');
  const { width, height, data } = await decode({ buffer });
  return { data: Buffer.from(data.buffer, data.byteOffset, data.byteLength), width, height };
}

/**
 * Converts any supported image into a JPEG no larger than MAX_DIMENSION on
 * its long edge and MAX_BYTES in size. EXIF orientation is applied so phone
 * photos don't come out sideways. Throws if the input can't be decoded.
 *
 * @param {Buffer} buffer raw file bytes
 * @returns {Promise<{buffer: Buffer, mimeType: 'image/jpeg', width: number, height: number, sourceFormat: string}>}
 */
async function normalizeToJpeg(buffer) {
  const sourceFormat = detectFormat(buffer);

  let input = buffer;
  let inputOptions = { failOn: 'none', animated: false };
  if (sourceFormat === 'heic') {
    let decoded;
    try {
      decoded = await decodeHeic(buffer);
    } catch (err) {
      throw new Error(`cannot decode HEIC: ${err && err.message ? err.message : err}`);
    }
    input = decoded.data;
    inputOptions = { raw: { width: decoded.width, height: decoded.height, channels: 4 } };
  }
  // Everything else (including 'unknown') is handed to sharp, which throws a
  // descriptive error if it can't open the bytes.

  let lastError = null;
  for (const quality of JPEG_QUALITIES) {
    const pipeline = sharp(input, inputOptions)
      .rotate() // honour EXIF orientation (no-op for raw HEIC pixels), then strip it
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' }) // drop alpha (png/webp) onto white
      .jpeg({ quality, mozjpeg: true });

    try {
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      if (data.length <= MAX_BYTES) {
        return {
          buffer: data,
          mimeType: 'image/jpeg',
          width: info.width,
          height: info.height,
          sourceFormat,
        };
      }
      lastError = new Error(`JPEG still ${data.length} bytes at quality ${quality}`);
    } catch (err) {
      // Decode/encode failure — no point retrying at a lower quality.
      throw new Error(`cannot decode image (detected ${sourceFormat}): ${err.message}`);
    }
  }

  throw new Error(
    `could not compress image under ${MAX_BYTES} bytes: ${lastError ? lastError.message : 'unknown'}`
  );
}

module.exports = { detectFormat, normalizeToJpeg, MAX_DIMENSION, MAX_BYTES };
