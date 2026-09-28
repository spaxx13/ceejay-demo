// Shared helper for the api/post-*.js cron routes: `?dryRun=1` (or true/yes)
// runs the pipeline without posting to Facebook or writing to Supabase.
function isDryRun(req) {
  const q = (req && req.query && req.query.dryRun) || '';
  const v = String(Array.isArray(q) ? q[0] : q).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

module.exports = { isDryRun };
