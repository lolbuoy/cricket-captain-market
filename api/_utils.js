// ============================================
// Shared utility for Vercel API routes
// Comprehensive Cricbuzz scraping
// ============================================

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ── List live/recent matches ──
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

// ── Scrape full match data: scores, scorecard, status, toss ──
async function scrapeFullMatch(matchId) {
  // Fetch both live scores page and scorecard page in parallel
  const [scoresPage, scorecardPage, infoPage] = await Promise.all([
    fetchUrl(`https://www.cricbuzz.com/live-cricket-scores/${matchId}`).catch(() => ({ body: '' })),
    fetchUrl(`https://www.cricbuzz.com/live-cricket-scorecard/${matchId}`).catch(() => ({ body: '' })),
    fetchUrl(`https://www.cricbuzz.com/cricket-match-facts/${matchId}`).catch(() => ({ body: '' })),
  ]);

  const result = {
    matchId,
    name: '',
    venue: '',
    format: 'T20',
    totalOvers: 20,
    matchStatus: 'unknown',  // upcoming, live, innings_break, complete
    resultText: '',
    toss: { winner: '', decision: '' },
    team1: '',
    team2: '',
    innings: [],   // Array of { battingTeam, bowlingTeam, runs, wickets, overs, batting: [], bowling: [], fow: [] }
    mom: '',
    momStats: '',
  };

  const body = scoresPage.body;
  const scBody = scorecardPage.body;
  const infoBody = infoPage.body;

  // ── Match name ──
  const titleMatch = body.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    result.name = titleMatch[1].replace(' | Cricbuzz.com', '').replace('Cricket commentary | ', '').trim();
  }

  // ── Format detection ──
  const nameLower = result.name.toLowerCase();
  if (nameLower.includes('test')) { result.format = 'Test'; result.totalOvers = 90; }
  else if (nameLower.includes('odi') || nameLower.includes('one day')) { result.format = 'ODI'; result.totalOvers = 50; }
  else if (nameLower.includes('t20') || nameLower.includes('twenty20') || nameLower.includes('t20i')) { result.format = 'T20'; result.totalOvers = 20; }

  // ── Match status (from og:description and body) ──
  const ogMatch = body.match(/og:description[^>]*content="([^"]+)"/);
  const ogDesc = ogMatch ? ogMatch[1] : '';

  // Check for result text
  const resultPatterns = [
    body.match(/cb-text-complete[^>]*>([^<]+)</),
    body.match(/(India won by[^<]+)/i),
    body.match(/(New Zealand won by[^<]+)/i),
    body.match(/([A-Z][\w\s]+ won by [^<]+)/),
    body.match(/(Match tied[^<]*)/i),
    body.match(/(No result[^<]*)/i),
  ];
  for (const rm of resultPatterns) {
    if (rm) { result.resultText = rm[1].trim(); result.matchStatus = 'complete'; break; }
  }

  // Live status
  if (!result.resultText) {
    const liveMatch = body.match(/cb-text-live[^>]*>([^<]+)</);
    if (liveMatch) {
      result.matchStatus = 'live';
      const liveText = liveMatch[1].trim().toLowerCase();
      if (liveText.includes('innings break')) result.matchStatus = 'innings_break';
    }
  }

  // Upcoming
  if (result.matchStatus === 'unknown') {
    const upcomingMatch = body.match(/cb-text-preview[^>]*>([^<]+)</);
    if (upcomingMatch) result.matchStatus = 'upcoming';
  }

  // ── Toss info (from info page or main page) ──
  const tossMatch = infoBody.match(/Toss[^<]*<[^>]*>([^<]+)/i) || body.match(/Toss[^<]*<[^>]*>([^<]+)/i);
  if (tossMatch) {
    const tossText = tossMatch[1].trim();
    result.toss.fullText = tossText;
    // Parse "India won the toss and opted to bat"
    const tossDetailMatch = tossText.match(/([\w\s]+)\s*(?:won|wins)\s*(?:the\s+)?toss\s+(?:and\s+)?(?:opt(?:ed|s)\s+to\s+|chose\s+to\s+|elected\s+to\s+)(bat|bowl|field)/i);
    if (tossDetailMatch) {
      result.toss.winner = tossDetailMatch[1].trim();
      result.toss.decision = tossDetailMatch[2].toLowerCase() === 'bat' ? 'bat' : 'bowl';
    }
  }

  // ── Venue ──
  const venueMatch = infoBody.match(/Venue[^<]*<[^>]*>([^<]+)/i) || body.match(/Venue[^<]*<[^>]*>([^<]+)/i);
  if (venueMatch) result.venue = venueMatch[1].trim();
  if (!result.venue) {
    const venueAlt = body.match(/itemprop="location"[^>]*>([^<]+)/);
    if (venueAlt) result.venue = venueAlt[1].trim();
  }

  // ── Man of the Match ──
  // Use tight regex: only capture short alphabetic names (max 60 chars)
  const momMatch = infoBody.match(/Man of the Match[^<]*<[^>]*>[^>]*>([A-Z][A-Za-z\s.'-]{1,60})</i) ||
                   infoBody.match(/Player of the Match[^<]*<[^>]*>[^>]*>([A-Z][A-Za-z\s.'-]{1,60})</i);
  if (momMatch) {
    const momText = momMatch[1].trim();
    // Sanity check — must look like a name, not code
    if (momText.length < 60 && !momText.includes('{') && !momText.includes('function')) {
      result.mom = momText;
    }
  }

  // ── Parse scores from og:description ──
  if (ogDesc) {
    // The og:description format varies. Examples:
    // "Follow NZ 159 vs IND 255/5 (Lockie Ferguson 6(7) )"
    // "IND 255/5 (20) vs NZ 159/10 (20)"
    // Normalize whitespace first
    const descClean = ogDesc.replace(/\s+/g, ' ').trim();

    // Pattern 1: "TEAM RUNS/WICKETS (OVERS)" — with overs
    const scoreWithOvers = /(?:Follow\s+)?(\b[A-Z]{2,5}\b)\s+(\d+)\/(\d+)\s*\((\d+(?:\.\d+)?)\)/g;
    let sm;
    while ((sm = scoreWithOvers.exec(descClean)) !== null) {
      let team = sm[1].trim();
      if (!result.innings.find(i => i.battingTeam === team)) {
        result.innings.push({
          battingTeam: team, runs: parseInt(sm[2]), wickets: parseInt(sm[3]),
          overs: sm[4], batting: [], bowling: [], fow: [],
        });
      }
    }

    // Pattern 2: "TEAM RUNS/WICKETS" — no overs (in-progress)
    const scoreNoOvers = /(?:Follow\s+)?(\b[A-Z]{2,5}\b)\s+(\d+)\/(\d+)(?:\s|$|\()/g;
    let snm;
    while ((snm = scoreNoOvers.exec(descClean)) !== null) {
      let team = snm[1].trim();
      if (!result.innings.find(i => i.battingTeam === team)) {
        result.innings.push({
          battingTeam: team, runs: parseInt(snm[2]), wickets: parseInt(snm[3]),
          overs: '?', batting: [], bowling: [], fow: [],
        });
      }
    }

    // Pattern 3: "TEAM RUNS" — all out, no wickets shown (e.g. "NZ 159")  
    const scoreAllOut = /(?:Follow\s+)?(\b[A-Z]{2,5}\b)\s+(\d{2,4})(?:\s+vs\s|\s*\||\s*$|\s+\()/g;
    let cam;
    while ((cam = scoreAllOut.exec(descClean)) !== null) {
      let team = cam[1].trim();
      if (!result.innings.find(i => i.battingTeam === team)) {
        result.innings.push({
          battingTeam: team, runs: parseInt(cam[2]), wickets: 10,
          overs: String(result.totalOvers), batting: [], bowling: [], fow: [],
        });
      }
    }
  }

  // Also try extracting from the Title or result text
  // India won by 96 runs — from the result we can reconstruct if needed
  if (result.innings.length === 0 && result.resultText) {
    // If we have the result but no innings, try parsing the result text
    const wonBy = result.resultText.match(/(\w[\w\s]+?) won by (\d+) runs/i);
    if (wonBy) {
      // Team that won bat first if they won by runs
      result.team1 = wonBy[1].trim();
    }
  }

  // ── Set teams from scores ──
  // If a team won by runs, they bat first → ensure correct order
  if (result.innings.length >= 2 && result.resultText) {
    const wonByRuns = result.resultText.match(/([\w\s]+?) won by \d+ runs/i);
    if (wonByRuns) {
      const winnerName = wonByRuns[1].trim().toLowerCase();
      // Winner bat first when winning by runs
      const winIdx = result.innings.findIndex(i =>
        winnerName.includes(i.battingTeam.toLowerCase()) ||
        i.battingTeam.toLowerCase().includes(winnerName.substring(0, 3))
      );
      if (winIdx === 1) {
        // Swap — winner should be innings[0]
        result.innings = [result.innings[1], result.innings[0]];
      }
    }
    const wonByWickets = result.resultText.match(/([\w\s]+?) won by \d+ wickets/i);
    if (wonByWickets) {
      const winnerName = wonByWickets[1].trim().toLowerCase();
      // Winner bat second when winning by wickets
      const winIdx = result.innings.findIndex(i =>
        winnerName.includes(i.battingTeam.toLowerCase()) ||
        i.battingTeam.toLowerCase().includes(winnerName.substring(0, 3))
      );
      if (winIdx === 0) {
        // Swap — winner should be innings[1]
        result.innings = [result.innings[1], result.innings[0]];
      }
    }
  }

  if (result.innings.length >= 2) {
    result.team1 = result.innings[0].battingTeam;
    result.team2 = result.innings[1].battingTeam;
    result.innings[0].bowlingTeam = result.team2;
    result.innings[1].bowlingTeam = result.team1;
  } else if (result.innings.length === 1) {
    result.team1 = result.innings[0].battingTeam;
    // Try getting team2 from name
    const nameTeams = result.name.match(/(\w[\w\s]*?)\s+vs\s+(\w[\w\s]*?),/i);
    if (nameTeams) {
      const t1Short = result.team1.toLowerCase();
      const n1 = nameTeams[1].toLowerCase();
      const n2 = nameTeams[2].toLowerCase();
      result.team2 = (n1.includes(t1Short) || t1Short.includes(n1.substring(0,3))) ? nameTeams[2].trim() : nameTeams[1].trim();
    }
    result.innings[0].bowlingTeam = result.team2;
  }

  // ── Parse scorecard HTML for detailed batting/bowling ──
  if (scBody) {
    parseScorecard(scBody, result);
  }

  // ── Recent balls ──
  const recentMatch = body.match(/Recent\s*:?\s*([^<]{10,100})/);
  if (recentMatch) result.recentBalls = recentMatch[1].trim();

  return result;
}

// Parse the Cricbuzz scorecard page HTML for detailed stats
function parseScorecard(html, result) {
  // Cricbuzz uses specific CSS classes for scorecard tables
  // We need to parse the raw HTML since it's server-rendered

  // Pattern for batting entries: player name, dismissal text, runs, balls, 4s, 6s, SR
  // Cricbuzz scorecard format in HTML is structured with cb-col divs
  // Each batting row has: name, dismissal, R, B, 4s, 6s, SR

  // Try to find innings sections
  // Each innings starts with a team header containing the team name
  const inningsSections = html.split(/cb-scrd-hdr-rw/g);

  // Alternative: parse individual batting/bowling entries
  // Batting rows typically have pattern: player name → dismissal → R → B → 4s → 6s → SR
  // Let's use a more robust regex approach

  // Find all batsmen entries
  // Pattern: profile link → player name, then numeric values in subsequent cells
  const batRegex = /profiles\/\d+\/[^"]+">([^<]+)<\/a>(?:<\/span>)?\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([0-9.]+)<\/td>/g;

  // Simplified: look for score-like patterns near player names
  // Cricbuzz uses the class "cb-col cb-col-100 cb-scrd-itms" for each scorecard item

  // Let's try to extract from the text content by looking at the ordering
  // The scorecard page lists batsmen for innings 1, then bowling for innings 1,
  // then batsmen for innings 2, then bowling for innings 2

  // For now, populate what we have from the scores page
  // The full HTML parsing would need the actual HTML structure
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

module.exports = { fetchUrl, scrapeLiveMatches, scrapeFullMatch, loadEnv };
