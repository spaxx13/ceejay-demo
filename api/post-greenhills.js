const { runPipeline } = require('../lib/pipeline');
const { BRANCHES } = require('../lib/config');

// Triggered by the Vercel Cron job for greenhills (see vercel.json).
module.exports = async (req, res) => {
  try {
    const result = await runPipeline(BRANCHES.greenhills);
    console.log('[post-greenhills]', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('[post-greenhills] failed:', err);
    res.status(500).json({ branch: 'greenhills', error: err.message });
  }
};
