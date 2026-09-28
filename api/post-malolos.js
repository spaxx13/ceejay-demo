const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/autoposter-config');
const { isDryRun } = require('../lib/dryRun');

// Triggered by the Vercel Cron job for malolos (see vercel.json).
// Hit manually with ?dryRun=1 to download, convert and caption without
// posting to Facebook or recording anything.
module.exports = async (req, res) => {
  const dryRun = isDryRun(req);
  try {
    const result = await runPipeline(BRANCHES.malolos, { dryRun });
    console.log('[post-malolos]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-malolos] failed:', err);
    res.status(500).json({ branch: 'malolos', dryRun, error: err.message });
  }
};
