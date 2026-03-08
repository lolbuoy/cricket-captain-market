// ============================================
// scraper.js — Cricbuzz Web Scraper Client
// Uses the local proxy server at /api/scrape/*
// No API key needed!
// ============================================

class CricbuzzScraper {
  constructor() {
    this.baseUrl = '/api/scrape';
    this.isConnected = false;
    this.currentMatchId = null;
    this.pollingInterval = null;
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // Check if the scraper proxy is available
  async isAvailable() {
    try {
      const res = await fetch(`${this.baseUrl}/live`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return data.status === 'success';
    } catch {
      return false;
    }
  }

  // Find the India vs NZ match (or any live match)
  async findMatch() {
    try {
      const res = await fetch(`${this.baseUrl}/find`);
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        this.currentMatchId = data.match.id;
        return {
          id: data.match.id,
          slug: data.match.slug,
          ...data.data,
        };
      }
      return null;
    } catch (err) {
      console.warn('Scraper findMatch failed:', err);
      return null;
    }
  }

  // Fetch score for a specific match
  async fetchScore(matchId) {
    try {
      const res = await fetch(`${this.baseUrl}/match/${matchId}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn('Scraper fetchScore failed:', err);
      return null;
    }
  }

  // Start polling for live updates
  startPolling(matchId, intervalMs = 15000) {
    this.currentMatchId = matchId;
    this.isConnected = true;
    this.emit('liveStatus', { isLive: true, matchId, source: 'scraper' });

    // Immediate first fetch
    this._poll(matchId);

    // Then poll
    this.pollingInterval = setInterval(() => {
      this._poll(matchId);
    }, intervalMs);
  }

  async _poll(matchId) {
    const data = await this.fetchScore(matchId);
    if (data) {
      const parsed = this.normalize(data);
      this.emit('liveUpdate', { raw: data, parsed, source: 'scraper' });
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isConnected = false;
    this.emit('liveStatus', { isLive: false, source: 'scraper' });
  }

  // Normalize scraped data to the same format as CricketAPI
  normalize(data) {
    return {
      innings: (data.scores || []).length,
      scores: (data.scores || []).map(s => ({
        inning: s.inning || s.team || 'Innings',
        runs: s.runs,
        wickets: s.wickets,
        overs: s.overs,
      })),
      batting: (data.batting || []).map(b => ({
        name: b.name,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        dismissal: b.dismissal || '',
      })),
      bowling: (data.bowling || []).map(b => ({
        name: b.name,
        overs: b.overs || 0,
        runs: b.runs || 0,
        wickets: b.wickets || 0,
        economy: b.economy || 0,
      })),
      status: data.status || '',
      name: data.name || '',
      venue: data.venue || '',
      matchStarted: true,
      matchEnded: false,
      teams: [],
      recentBalls: data.recentBalls || '',
    };
  }
}
