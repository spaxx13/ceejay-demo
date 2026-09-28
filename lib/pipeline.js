const drive = require('./googleDrive');
const supabase = require('./supabase');
const { generateCaption } = require('./caption');
const facebook = require('./facebook');
const { normalizeToJpeg } = require('./image');
const { MAX_PHOTOS_PER_POST } = require('./autoposter-config');

/**
 * Runs the full pipeline for one branch/service.
 * @param {object} branch - an entry from lib/config.js BRANCHES
 * @returns {Promise<object>} a summary of what happened
 */
async function runPipeline(branch) {
  const folderId = process.env[branch.folderIdEnv];
  if (!folderId) {
    throw new Error(`Missing env var ${branch.folderIdEnv} for branch ${branch.key}`);
  }

  const accessToken = await drive.getAccessToken();
  const files = await drive.listImagesInFolder(folderId, accessToken);

  if (files.length === 0) {
    return { branch: branch.key, posted: false, reason: 'no photos in folder' };
  }

  const byDay = drive.groupByDay(files);
  const postedDates = await supabase.getPostedDates(branch.key);
  const dayToPost = drive.pickOldestUnpostedDay(byDay, postedDates);

  if (!dayToPost) {
    return { branch: branch.key, posted: false, reason: 'no closed, unposted day found' };
  }

  const dayFiles = byDay.get(dayToPost).slice(0, MAX_PHOTOS_PER_POST);

  // Download and normalize every photo for this day to a resized JPEG.
  // Drive's mimeType is ignored: phones upload HEIC with misleading types,
  // and Claude only accepts jpeg/png/gif/webp. A photo that can't be
  // converted is skipped (and never posted) instead of failing the batch.
  const images = [];
  const skipped = [];
  for (const file of dayFiles) {
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
        `[${branch.key}] normalized ${file.name}: ${jpeg.sourceFormat} ${raw.length}B -> jpeg ${jpeg.width}x${jpeg.height} ${jpeg.buffer.length}B`
      );
    } catch (err) {
      console.warn(
        `[${branch.key}] skipping ${file.name} (${file.id}, drive mimeType ${file.mimeType}): ${err.message}`
      );
      skipped.push({ name: file.name, driveId: file.id, error: err.message });
    }
  }

  if (images.length === 0) {
    throw new Error(
      `all ${dayFiles.length} photos for ${dayToPost} failed to convert: ${skipped
        .map((s) => s.name)
        .join(', ')}`
    );
  }

  // Ask Claude for a caption based on the actual photos.
  const caption = await generateCaption(branch, images);

  // Upload each photo unpublished, then publish one album post.
  const photoIds = [];
  for (const img of images) {
    const photoId = await facebook.uploadUnpublishedPhoto(img.buffer, img.mimeType);
    photoIds.push(photoId);
  }
  const fbPostId = await facebook.publishAlbumPost(caption, photoIds);

  // Record so this day is never posted again.
  await supabase.recordPost(branch.key, dayToPost, photoIds, fbPostId);

  return {
    branch: branch.key,
    posted: true,
    day: dayToPost,
    photoCount: images.length,
    skipped,
    caption,
    fbPostId,
  };
}

module.exports = { runPipeline };
