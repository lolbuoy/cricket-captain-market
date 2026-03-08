// ============================================
// api.js — CricketData.org Live API Integration
// ============================================

class CricketAPI {
  constructor() {
    this.baseUrl = 'https://api.cricapi.com/v1';
    this.apiKey = localStorage.getItem('cricketApiKey') || '';
    this.isLive = false;
    this.pollingInterval = null;
    this.currentMatchId = null;
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('cricketApiKey', key);
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return this.apiKey && this.apiKey.length > 10;
  }

  async fetchCurrentMatches() {
    if (!this.hasApiKey()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/currentMatches?apikey=${this.apiKey}&offset=0`);
      const data = await res.json();
      if (data.status === 'success') {
        return data.data || [];
      }
      return null;
    } catch (err) {
      console.warn('API fetch failed:', err);
      return null;
    }
  }

  async fetchMatchScorecard(matchId) {
    if (!this.hasApiKey() || !matchId) return null;
    try {
      const res = await fetch(`${this.baseUrl}/match_scorecard?apikey=${this.apiKey}&id=${matchId}`);
      const data = await res.json();
      if (data.status === 'success') {
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn('Scorecard fetch failed:', err);
      return null;
    }
  }

  async fetchBallByBall(matchId) {
    if (!this.hasApiKey() || !matchId) return null;
    try {
      const res = await fetch(`${this.baseUrl}/match_bbb?apikey=${this.apiKey}&id=${matchId}`);
      const data = await res.json();
      if (data.status === 'success') {
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn('Ball-by-ball fetch failed:', err);
      return null;
    }
  }

  async findLiveMatch() {
    const matches = await this.fetchCurrentMatches();
    if (!matches) return null;

    // Try to find India vs NZ T20 match
    const t20Final = matches.find(m => {
      const teams = (m.teams || []).join(' ').toLowerCase();
      return (teams.includes('india') && teams.includes('new zealand')) ||
             (teams.includes('ind') && teams.includes('nz'));
    });

    if (t20Final) return t20Final;

    // Return any live T20 match
    return matches.find(m =>
      m.matchType === 't20' && (m.matchStarted || m.matchEnded === false)
    ) || null;
  }

  startPolling(matchId, intervalMs = 30000) {
    this.currentMatchId = matchId;
    this.isLive = true;
    this.emit('liveStatus', { isLive: true, matchId });

    this.pollingInterval = setInterval(async () => {
      const scorecard = await this.fetchMatchScorecard(matchId);
      if (scorecard) {
        this.emit('liveUpdate', scorecard);
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isLive = false;
    this.emit('liveStatus', { isLive: false });
  }

  // Parse API score data into our engine format
  parseScoreData(apiData) {
    if (!apiData || !apiData.score) return null;

    const score = apiData.score;
    const innings = score.length;

    return {
      innings,
      scores: score.map(s => ({
        runs: s.r,
        wickets: s.w,
        overs: s.o,
      })),
      status: apiData.status,
      matchStarted: apiData.matchStarted,
      matchEnded: apiData.matchEnded,
    };
  }
}
