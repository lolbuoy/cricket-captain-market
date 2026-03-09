const { loadEnv } = require('./_utils');

module.exports = (req, res) => {
  loadEnv();
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const config = {
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  };

  // Never expose service role key
  res.status(200).json({ status: 'ok', config });
};
