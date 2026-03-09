const { scrapeLiveMatches } = require('../_utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const matches = await scrapeLiveMatches();
    res.status(200).json({ status: 'success', matches });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
};
