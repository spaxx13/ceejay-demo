const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/autoposter-config');
const { isDryRun } = require('../lib/dryRun');

// Triggered by the Vercel Cron job for homeservice (see vercel.json).
// Hit manually with ?dryRun=1 to download, convert and caption without
// posting to Facebook or recording anything.
module.exports = async (req, res) => {
  const dryRun = isDryRun(req);
  try {
    const result = await runPipeline(BRANCHES.homeservice, { dryRun });
    console.log('[post-homeservice]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-homeservice] failed:', err);
    res.status(500).json({ branch: 'homeservice', dryRun, error: err.message });
  }
};
