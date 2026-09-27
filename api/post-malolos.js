const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/autoposter-config');

// Triggered by the Vercel Cron job for malolos (see vercel.json).
module.exports = async (req, res) => {
  try {
    const result = await runPipeline(BRANCHES.malolos);
    console.log('[post-malolos]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-malolos] failed:', err);
    res.status(500).json({ branch: 'malolos', error: err.message });
  }
};
