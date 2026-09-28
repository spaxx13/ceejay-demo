const drive = require('./googleDrive');
const supabase = require('./supabase');
const { generateCaption } = require('./caption');
const facebook = require('./facebook');
const { normalizeToJpeg } = require('./image');
const { MAX_PHOTOS_PER_POST } = require('./autoposter-config');

/**
 * Runs the full pipeline for one branch/service.
 *
 * Failure policy: one bad photo never fails the day. A photo that cannot be
 * downloaded/converted, or that Facebook refuses, is skipped with a warning
 * naming the file and the rest of the day still goes out. Only an error that
 * affects every photo (Drive auth, Claude down, Facebook token) fails the run,
 * so the same day is retried on the next cron tick.
 *
 * @param {object} branch - an entry from lib/autoposter-config.js BRANCHES
 * @param {{dryRun?: boolean}} [options] - dryRun downloads, converts and
 *   writes the caption but does NOT post to Facebook or record anything in
 *   Supabase, so a route can be hit manually to test safely.
 * @returns {Promise<object>} a summary of what happened
 */
async function runPipeline(branch, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const tag = `[${branch.key}${dryRun ? ' dry-run' : ''}]`;
  const startedAt = Date.now();
  const timings = {};
  const lap = (name, t0) => {
    timings[name] = (timings[name] || 0) + (Date.now() - t0);
  };

  const folderId = process.env[branch.folderIdEnv];
  if (!folderId) {
    throw new Error(`Missing env var ${branch.folderIdEnv} for branch ${branch.key}`);
  }

  let t = Date.now();
  const accessToken = await drive.getAccessToken();
  const files = await drive.listImagesInFolder(folderId, accessToken);
  lap('driveList', t);

  if (files.length === 0) {
    return { branch: branch.key, dryRun, posted: false, reason: 'no photos in folder' };
  }

  const byDay = drive.groupByDay(files);
  const postedDates = await supabase.getPostedDates(branch.key);
  const dayToPost = drive.pickOldestUnpostedDay(byDay, postedDates);

  if (!dayToPost) {
    return { branch: branch.key, dryRun, posted: false, reason: 'no closed, unposted day found' };
  }

  const dayFiles = byDay.get(dayToPost).slice(0, MAX_PHOTOS_PER_POST);

  // Download and normalize every photo for this day to a resized JPEG, one at
  // a time to keep peak memory low. Drive's mimeType is ignored: phones upload
  // HEIC with misleading types, and Claude only accepts jpeg/png/gif/webp.
  const images = [];
  const skipped = [];
  for (const file of dayFiles) {
    t = Date.now();
    try {
      const raw = await drive.downloadFile(file.id, accessToken);
      const jpeg = await normalizeToJpeg(raw);
      images.push({
        buffer: jpeg.buffer,
        mimeType: jpeg.mimeType,
        driveId: file.id,
        name: file.name,
      });
      console.log(
        `${tag} normalized ${file.name}: ${jpeg.sourceFormat} ${raw.length}B -> jpeg ${jpeg.width}x${jpeg.height} ${jpeg.buffer.length}B in ${Date.now() - t}ms`
      );
    } catch (err) {
      console.warn(
        `${tag} skipping ${file.name} (${file.id}, drive mimeType ${file.mimeType}): ${err.message}`
      );
      skipped.push({ name: file.name, driveId: file.id, stage: 'convert', error: err.message });
    }
    lap('normalize', t);
  }

  if (images.length === 0) {
    // Nothing usable for this day. Record it (with no photos) so the branch
    // moves on to the next day tomorrow instead of failing on this one
    // forever; the warnings above name every file so it can be fixed by hand.
    console.error(
      `${tag} all ${dayFiles.length} photo(s) for ${dayToPost} failed to convert; marking day as skipped`
    );
    if (!dryRun) await supabase.recordPost(branch.key, dayToPost, [], null);
    return {
      branch: branch.key,
      dryRun,
      posted: false,
      day: dayToPost,
      reason: 'no photo could be converted',
      skipped,
      elapsedMs: Date.now() - startedAt,
      timings,
    };
  }

  // Ask Claude for a caption based on the actual photos.
  t = Date.now();
  const caption = await generateCaption(branch, images);
  lap('caption', t);

  if (dryRun) {
    return {
      branch: branch.key,
      dryRun: true,
      posted: false,
      reason: 'dry run: nothing posted or recorded',
      day: dayToPost,
      photoCount: images.length,
      photos: images.map((img) => ({ name: img.name, bytes: img.buffer.length })),
      skipped,
      caption,
      elapsedMs: Date.now() - startedAt,
      timings,
    };
  }

  // Upload each photo unpublished, then publish one album post. A single
  // rejected photo is skipped; only a total failure aborts (token problem).
  const photoIds = [];
  const posted = [];
  t = Date.now();
  for (const img of images) {
    try {
      const photoId = await facebook.uploadUnpublishedPhoto(img.buffer, img.mimeType);
      photoIds.push(photoId);
      posted.push(img.name);
    } catch (err) {
      console.warn(`${tag} skipping ${img.name} (${img.driveId}): Facebook rejected it: ${err.message}`);
      skipped.push({ name: img.name, driveId: img.driveId, stage: 'facebook', error: err.message });
    }
  }
  lap('facebookUpload', t);

  if (photoIds.length === 0) {
    throw new Error(
      `Facebook rejected every photo for ${dayToPost}: ${skipped
        .filter((s) => s.stage === 'facebook')
        .map((s) => `${s.name}: ${s.error}`)
        .join('; ')}`
    );
  }

  t = Date.now();
  const fbPostId = await facebook.publishAlbumPost(caption, photoIds);
  lap('facebookPublish', t);

  // Record so this day is never posted again.
  await supabase.recordPost(branch.key, dayToPost, photoIds, fbPostId);

  return {
    branch: branch.key,
    dryRun: false,
    posted: true,
    day: dayToPost,
    photoCount: photoIds.length,
    photos: posted,
    skipped,
    caption,
    fbPostId,
    elapsedMs: Date.now() - startedAt,
    timings,
  };
}

module.exports = { runPipeline };
