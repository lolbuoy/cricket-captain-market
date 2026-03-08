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
    this.lastBallCount = 0; // track new balls
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
      console.warn('API response error:', data.status, data.info);
      return null;
    } catch (err) {
      console.warn('API fetch failed:', err);
      return null;
    }
  }

  async fetchMatchInfo(matchId) {
    if (!this.hasApiKey() || !matchId) return null;
    try {
      const res = await fetch(`${this.baseUrl}/match_info?apikey=${this.apiKey}&id=${matchId}`);
      const data = await res.json();
      if (data.status === 'success') {
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn('Match info fetch failed:', err);
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
    if (!matches || !Array.isArray(matches)) return null;

    // Try to find India vs NZ T20 match
    const t20Final = matches.find(m => {
      const teams = (m.teams || []).join(' ').toLowerCase();
      const name = (m.name || '').toLowerCase();
      return ((teams.includes('india') && teams.includes('new zealand')) ||
              (teams.includes('ind') && teams.includes('nz')) ||
              (name.includes('india') && name.includes('new zealand')));
    });

    if (t20Final) return t20Final;

    // Return any live T20 or active match
    const liveMatch = matches.find(m =>
      m.matchStarted === true && m.matchEnded === false
    );
    if (liveMatch) return liveMatch;

    // Return any match that has started
    return matches.find(m => m.matchStarted === true) || null;
  }

  async startPolling(matchId, intervalMs = 20000) {
    this.currentMatchId = matchId;
    this.isLive = true;
    this.emit('liveStatus', { isLive: true, matchId });

    // Immediate first fetch
    await this._pollOnce(matchId);

    // Then poll at interval
    this.pollingInterval = setInterval(async () => {
      await this._pollOnce(matchId);
    }, intervalMs);
  }

  async _pollOnce(matchId) {
    try {
      // Try scorecard first — it has the most data
      const scorecard = await this.fetchMatchScorecard(matchId);
      if (scorecard) {
        const parsed = this.parseScoreData(scorecard);
        if (parsed) {
          this.emit('liveUpdate', { raw: scorecard, parsed });
          return;
        }
      }

      // Fallback to match info
      const matchInfo = await this.fetchMatchInfo(matchId);
      if (matchInfo) {
        const parsed = this.parseScoreData(matchInfo);
        if (parsed) {
          this.emit('liveUpdate', { raw: matchInfo, parsed });
        }
      }
    } catch (err) {
      console.warn('Poll failed:', err);
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isLive = false;
    this.currentMatchId = null;
    this.emit('liveStatus', { isLive: false });
  }

  // Parse API score data into our format
  parseScoreData(apiData) {
    if (!apiData) return null;

    const score = apiData.score || [];
    const scorecard = apiData.scorecard || [];

    // Parse score entries
    const parsedScores = score.map(s => ({
      runs: s.r,
      wickets: s.w,
      overs: s.o,
      inning: s.inning || '',
    }));

    // Parse batting/bowling scorecards if available
    const battingCards = [];
    const bowlingCards = [];
    if (scorecard.length > 0) {
      scorecard.forEach(sc => {
        if (sc.batting) {
          sc.batting.forEach(b => {
            battingCards.push({
              name: b.batsman?.name || b.batsman || '',
              runs: b.r || 0,
              balls: b.b || 0,
              fours: b['4s'] || 0,
              sixes: b['6s'] || 0,
              sr: b.sr || 0,
              dismissal: b['dismissal-text'] || b.dismissal || '',
            });
          });
        }
        if (sc.bowling) {
          sc.bowling.forEach(b => {
            bowlingCards.push({
              name: b.bowler?.name || b.bowler || '',
              overs: b.o || 0,
              maidens: b.m || 0,
              runs: b.r || 0,
              wickets: b.w || 0,
              economy: b.eco || 0,
            });
          });
        }
      });
    }

    return {
      innings: parsedScores.length,
      scores: parsedScores,
      batting: battingCards,
      bowling: bowlingCards,
      status: apiData.status || '',
      matchStarted: apiData.matchStarted,
      matchEnded: apiData.matchEnded,
      teams: apiData.teams || [],
      name: apiData.name || '',
      venue: apiData.venue || '',
    };
  }
}
