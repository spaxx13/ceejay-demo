const drive = require('./googleDrive');
const supabase = require('./supabase');
const { generateCaption, mimeTypeFor } = require('./caption');
const facebook = require('./facebook');
const { MAX_PHOTOS_PER_POST } = require('./config');

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

  // Download all photos for this day.
  const images = [];
  for (const file of dayFiles) {
    const buffer = await drive.downloadFile(file.id, accessToken);
    images.push({ buffer, mimeType: mimeTypeFor(file), driveId: file.id, name: file.name });
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
    caption,
    fbPostId,
  };
}

module.exports = { runPipeline };
