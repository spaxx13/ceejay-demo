const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/autoposter-config');

// Triggered by the Vercel Cron job for homeservice (see vercel.json).
module.exports = async (req, res) => {
  try {
    const result = await runPipeline(BRANCHES.homeservice);
    console.log('[post-homeservice]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-homeservice] failed:', err);
    res.status(500).json({ branch: 'homeservice', error: err.message });
  }
};
