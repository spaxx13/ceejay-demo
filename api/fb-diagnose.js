const facebook = require('../lib/facebook');

// Manual-only, read-only diagnostic — not on any cron schedule (see
// vercel.json). Confirms:
//   1. What Facebook Page FB_PAGE_ID/FB_PAGE_ACCESS_TOKEN actually points to
//      (name, username, link, fan_count) — to catch posting to a different
//      or orphaned Page than the one the shop's followers actually follow.
//   2. The real status of a specific post (?postId=<id>, defaults to the
//      last known post) — is_published/privacy/permalink_url — to tell a
//      near-zero-reach post apart from an actually restricted one.
// Nothing is posted or changed by this route.
module.exports = async (req, res) => {
  const postId = req.query.postId || '108999749137894_1588337296660807';
  try {
    const [page, post] = await Promise.all([
      facebook.getPageProfile(),
      facebook.getPostStatus(postId),
    ]);
    res.status(200).json({ page, post });
  } catch (err) {
    console.error('[fb-diagnose] failed:', err);
    res.status(500).json({ error: err.message });
  }
};
