const { scrapeMatchScore } = require('../../_utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ status: 'error', error: 'Missing match ID' });
  }

  try {
    const data = await scrapeMatchScore(id);
    res.status(200).json({ status: data ? 'success' : 'error', data });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
};
