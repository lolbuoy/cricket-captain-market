// ============================================
// server.js — Dev server with Cricbuzz scraping proxy
// Replaces http-server. No API key needed!
//
// Usage: node server.js
// Opens on http://localhost:8080
// ============================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const STATIC_DIR = __dirname;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ── Cricbuzz Scraper ──

// Fetch a URL with proper headers to avoid blocks
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

// Scrape Cricbuzz live scores page for current matches
async function scrapeLiveMatches() {
  try {
    const { body } = await fetchUrl('https://www.cricbuzz.com/cricket-match/live-scores');

    // Parse match cards from the HTML
    const matches = [];
    // Match pattern: match links with scores
    const matchRegex = /href="\/live-cricket-scores\/(\d+)\/([^"]+)"[^>]*>.*?<\/a>/gs;
    
    // Simpler approach: extract from the structured HTML elements
    // Look for match title patterns like "IndiaIND255-5 (20)New ZealandNZ25-0 (2)"
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
  } catch (err) {
    console.error('Failed to scrape live matches:', err.message);
    return [];
  }
}

// Scrape a specific match's live score page
async function scrapeMatchScore(matchId) {
  try {
    // Try the scorecard page first for detailed data
    const { body } = await fetchUrl(`https://www.cricbuzz.com/live-cricket-scores/${matchId}`);

    const result = { matchId, scores: [], batting: [], bowling: [], status: '', name: '', venue: '' };

    // Extract match name from <title>
    const titleMatch = body.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      result.name = titleMatch[1].replace(' | Cricbuzz.com', '').replace('Cricket commentary | ', '').trim();
    }

    // Extract from og:description which has structured score data
    // Format: "Follow NZ 25/0 (2) vs IND 255/5 ..."
    const ogMatch = body.match(/og:description[^>]*content="([^"]+)"/);
    if (ogMatch) {
      const desc = ogMatch[1];
      // Parse scores from "TEAM1 R/W (O) vs TEAM2 R/W (O)"
      // Pattern: "Follow NZ 25/0 (2) vs IND\n255/5"
      const scorePattern = /(\w[\w\s]*?)\s+(\d+)\/(\d+)\s*\(([0-9.]+)\)/g;
      let sm;
      while ((sm = scorePattern.exec(desc)) !== null) {
        let teamName = sm[1].trim().replace(/^Follow\s+/i, ''); // Strip "Follow" prefix
        result.scores.push({
          inning: teamName + ' Innings',
          team: teamName,
          runs: parseInt(sm[2]),
          wickets: parseInt(sm[3]),
          overs: sm[4],
        });
      }

      // Extract batsmen names from og:description
      // Pattern: "(Batsman1 R(B) Batsman2 R(B))"
      const batPattern = /\(([A-Z][\w\s]+?\s+\d+\([^)]+\)(?:\s+[A-Z][\w\s]+?\s+\d+\([^)]+\))*)\)/;
      const batMatch = batPattern.exec(desc);
      if (batMatch) {
        const batStr = batMatch[1];
        const playerPattern = /([A-Z][\w\s]+?)\s+(\d+)\((\d+)\)/g;
        let pm;
        while ((pm = playerPattern.exec(batStr)) !== null) {
          result.batting.push({
            name: pm[1].trim(),
            runs: parseInt(pm[2]),
            balls: parseInt(pm[3]),
          });
        }
      }
    }

    // Extract match status from common HTML patterns
    const statusMatch = body.match(/cb-text-live[^>]*>([^<]+)</);
    if (statusMatch) {
      result.status = statusMatch[1].trim();
    }
    // Alternative status patterns
    if (!result.status) {
      const statusAlt = body.match(/cb-text-complete[^>]*>([^<]+)</);
      if (statusAlt) result.status = statusAlt[1].trim();
    }
    if (!result.status) {
      const statusNeed = body.match(/(need \d+ runs[^<]*)/i);
      if (statusNeed) result.status = statusNeed[1].trim();
    }

    // Extract venue
    const venueMatch = body.match(/itemtype="http:\/\/schema\.org\/SportsEvent"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
    if (venueMatch) {
      result.venue = venueMatch[1].trim();
    }

    // Also try to parse recent balls from the page
    // Pattern: "Recent : ... 0 0 1 4 6 W | 1 2 0 4 6 0"
    const recentMatch = body.match(/Recent\s*:?\s*([^<]{10,100})/);
    if (recentMatch) {
      result.recentBalls = recentMatch[1].trim();
    }

    // Reverse scores order if needed — first innings should be first
    // Usually og:description shows batting team first (current innings)
    if (result.scores.length === 2) {
      // Keep as-is — second innings is typically shown first in og:description
      // We'll handle ordering in the client
    }

    return result;
  } catch (err) {
    console.error(`Failed to scrape match ${matchId}:`, err.message);
    return null;
  }
}

// ── Server ──

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for API endpoints
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');
  };

  // ── API Endpoints ──

  // GET /api/scrape/live — List of live matches
  if (pathname === '/api/scrape/live') {
    setCors();
    try {
      const matches = await scrapeLiveMatches();
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', matches }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // GET /api/scrape/match/:id — Scrape a specific match score
  const matchRoute = pathname.match(/^\/api\/scrape\/match\/(\d+)$/);
  if (matchRoute) {
    setCors();
    try {
      const data = await scrapeMatchScore(matchRoute[1]);
      res.writeHead(200);
      res.end(JSON.stringify({ status: data ? 'success' : 'error', data }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // GET /api/scrape/find — Find India vs NZ match automatically
  if (pathname === '/api/scrape/find') {
    setCors();
    try {
      const matches = await scrapeLiveMatches();
      const indNz = matches.find(m =>
        m.slug && (m.slug.includes('ind-vs-nz') || m.slug.includes('nz-vs-ind'))
      );
      if (indNz) {
        const data = await scrapeMatchScore(indNz.id);
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'success', match: indNz, data }));
      } else {
        // Return first live match if no IND vs NZ
        const first = matches[0];
        const data = first ? await scrapeMatchScore(first.id) : null;
        res.writeHead(200);
        res.end(JSON.stringify({
          status: first ? 'success' : 'no_matches',
          match: first || null,
          data,
        }));
      }
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // ── Static Files ──
  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🏏 Cricket Captain × Market`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Scraper: http://localhost:${PORT}/api/scrape/find`);
  console.log(`  ─────────────────────────────`);
  console.log(`  No API key needed! Scraping Cricbuzz for live data.\n`);
});
