const { scrapeLiveMatches, scrapeFullMatch } = require('../_utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const matches = await scrapeLiveMatches();

    // Try to find India vs NZ first
    const indNz = matches.find(m =>
      m.slug && (m.slug.includes('ind-vs-nz') || m.slug.includes('nz-vs-ind'))
    );

    const target = indNz || matches[0];

    if (target) {
      const data = await scrapeFullMatch(target.id);
      res.status(200).json({ status: 'success', match: target, data });
    } else {
      res.status(200).json({ status: 'no_matches', match: null, data: null });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
};
