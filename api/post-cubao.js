const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/autoposter-config');

// Triggered by the Vercel Cron job for cubao (see vercel.json).
module.exports = async (req, res) => {
  try {
    const result = await runPipeline(BRANCHES.cubao);
    console.log('[post-cubao]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-cubao] failed:', err);
    res.status(500).json({ branch: 'cubao', error: err.message });
  }
};
