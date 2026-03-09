// ============================================
// scraper.js — Client-side Cricbuzz data layer
// Fetches from /api/scrape/* endpoints
// Single source of truth for match state
// ============================================

class CricbuzzScraper {
  constructor() {
    this.matchData = null;
    this.matchId = null;
    this.pollTimer = null;
    this.isConnected = false;
    this.listeners = {};
  }

  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // Check if proxy server (local) or Vercel API is available
  async isAvailable() {
    try {
      const r = await fetch('/api/scrape/live', { signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch { return false; }
  }

  // Find a match (IND vs NZ first, then any live match)
  async findMatch() {
    try {
      const r = await fetch('/api/scrape/find');
      const json = await r.json();
      if (json.status === 'success' && json.data) {
        this.matchData = json.data;
        this.matchId = json.data.matchId;
        return json.data;
      }
    } catch (e) {
      console.error('Scraper findMatch error:', e);
    }
    return null;
  }

  // Fetch full data for a specific match
  async fetchMatch(matchId) {
    try {
      const r = await fetch(`/api/scrape/match/${matchId}`);
      const json = await r.json();
      if (json.status === 'success' && json.data) {
        this.matchData = json.data;
        this.matchId = matchId;
        return json.data;
      }
    } catch (e) {
      console.error('Scraper fetchMatch error:', e);
    }
    return null;
  }

  // Start polling for live updates
  startPolling(matchId, intervalMs = 15000) {
    this.stopPolling();
    this.isConnected = true;

    const poll = async () => {
      const data = await this.fetchMatch(matchId);
      if (data) {
        this.emit('matchUpdate', data);

        // Stop polling if match is complete
        if (data.matchStatus === 'complete') {
          this.stopPolling();
        }
      }
    };

    poll(); // Immediate first fetch
    this.pollTimer = setInterval(poll, intervalMs);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
  }

  // Get current match state
  getMatchData() {
    return this.matchData;
  }
}
