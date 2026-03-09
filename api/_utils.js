// Shared utility for Vercel API routes — Cricbuzz scraping
const https = require('https');

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function scrapeLiveMatches() {
  const { body } = await fetchUrl('https://www.cricbuzz.com/cricket-match/live-scores');
  const matches = [];
  const cardRegex = /live-cricket-scores\/(\d+)\/([a-z0-9\-]+)/g;
  let m;
  const seenIds = new Set();
  while ((m = cardRegex.exec(body)) !== null) {
    if (!seenIds.has(m[1])) {
      seenIds.add(m[1]);
      matches.push({ id: m[1], slug: m[2] });
    }
  }
  return matches;
}

async function scrapeMatchScore(matchId) {
  const { body } = await fetchUrl(`https://www.cricbuzz.com/live-cricket-scores/${matchId}`);
  const result = { matchId, scores: [], batting: [], bowling: [], status: '', name: '', venue: '' };

  // Match name from <title>
  const titleMatch = body.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    result.name = titleMatch[1].replace(' | Cricbuzz.com', '').replace('Cricket commentary | ', '').trim();
  }

  // Parse og:description for score data
  const ogMatch = body.match(/og:description[^>]*content="([^"]+)"/);
  if (ogMatch) {
    const desc = ogMatch[1];

    // Scores WITH overs: "IND 255/5 (20)"
    const scoreWithOvers = /(\w[\w\s]*?)\s+(\d+)\/(\d+)\s*\(([0-9.]+)\)/g;
    let sm;
    while ((sm = scoreWithOvers.exec(desc)) !== null) {
      let team = sm[1].trim().replace(/^Follow\s+/i, '');
      result.scores.push({ inning: team + ' Innings', team, runs: parseInt(sm[2]), wickets: parseInt(sm[3]), overs: sm[4] });
    }

    // Completed innings: "NZ 159" (no overs)
    const scoreComplete = /(\w[\w\s]*?)\s+(\d+)(?:\s+vs|\s*\||\s*$)/g;
    let cm;
    while ((cm = scoreComplete.exec(desc)) !== null) {
      let team = cm[1].trim().replace(/^Follow\s+/i, '');
      if (!result.scores.find(s => s.team === team)) {
        result.scores.push({ inning: team + ' Innings', team, runs: parseInt(cm[2]), wickets: 10, overs: '20' });
      }
    }

    // Batting: "(Finn Allen 4(4) Tim Seifert 20(8))"
    const batPattern = /\(([A-Z][\w\s]+?\s+\d+\([^)]+\)(?:\s+[A-Z][\w\s]+?\s+\d+\([^)]+\))*)\)/;
    const batMatch = batPattern.exec(desc);
    if (batMatch) {
      const playerPattern = /([A-Z][\w\s]+?)\s+(\d+)\((\d+)\)/g;
      let pm;
      while ((pm = playerPattern.exec(batMatch[1])) !== null) {
        result.batting.push({ name: pm[1].trim(), runs: parseInt(pm[2]), balls: parseInt(pm[3]) });
      }
    }
  }

  // Match status
  const statusMatch = body.match(/cb-text-live[^>]*>([^<]+)</) ||
                       body.match(/cb-text-complete[^>]*>([^<]+)</) ||
                       body.match(/(need \d+ runs[^<]*)/i);
  if (statusMatch) result.status = statusMatch[1].trim();

  // Recent balls
  const recentMatch = body.match(/Recent\s*:?\s*([^<]{10,100})/);
  if (recentMatch) result.recentBalls = recentMatch[1].trim();

  return result;
}

function loadEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      lines.forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match && !process.env[match[1].trim()]) {
          process.env[match[1].trim()] = match[2].trim();
        }
      });
    }
  } catch (e) { /* ignore */ }
}

module.exports = { fetchUrl, scrapeLiveMatches, scrapeMatchScore, loadEnv };
