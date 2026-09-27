// Tracks which (branch, day) combinations have already been posted, so the
// same photos never get posted twice. Requires the `posted_batches` table —
// see supabase/migration.sql.

const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Returns a Set of 'YYYY-MM-DD' post_date strings already recorded for this branch. */
async function getPostedDates(branchKey) {
  const { data, error } = await client()
    .from('posted_batches')
    .select('post_date')
    .eq('branch', branchKey);

  if (error) throw new Error(`Supabase getPostedDates failed: ${error.message}`);
  return new Set((data || []).map((row) => row.post_date));
}

/** Records a successful post so it isn't repeated on the next cron run. */
async function recordPost(branchKey, postDate, photoIds, fbPostId) {
  const { error } = await client().from('posted_batches').insert({
    branch: branchKey,
    post_date: postDate,
    photo_ids: photoIds,
    fb_post_id: fbPostId,
  });

  if (error) throw new Error(`Supabase recordPost failed: ${error.message}`);
}

module.exports = { getPostedDates, recordPost };
