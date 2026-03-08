// ============================================
// app.js — Main Application Controller
// ============================================

class App {
  constructor() {
    this.ui = new GameUI();
    this.api = new CricketAPI();
    this.scraper = new CricbuzzScraper();
    this.engine = null;
    this.market = null;
    this.captain = null;

    this.userTeam = null;
    this.opponentTeam = null;
    this.firstBattingTeam = null;
    this.gamePhase = 'start'; // start, toss, playing, inningsBreak, matchEnd

    // Live mode state
    this.isLiveMode = false;
    this.liveData = null;       // Latest parsed API data
    this.liveMatchInfo = null;  // Match metadata from API
    this.liveSource = null;     // 'scraper' or 'api'
    this._liveListenersAttached = false;

    this.init();
  }

  async init() {
    document.getElementById('app').innerHTML = this.ui.renderStartScreen();

    // Try scraper first (no API key needed!), then fall back to CricketData API
    this._attachLiveListeners();

    const scraperAvailable = await this.scraper.isAvailable();
    if (scraperAvailable) {
      console.log('🕷️ Scraper proxy detected — using Cricbuzz (no API key needed)');
      this.liveSource = 'scraper';
      await this.tryLiveConnect();
    } else if (this.api.hasApiKey()) {
      console.log('🔑 Using CricketData.org API');
      this.liveSource = 'api';
      await this.tryLiveConnect();
    } else {
      console.log('📡 No live data source. Use simulation mode or run: node server.js');
    }
  }

  _attachLiveListeners() {
    if (this._liveListenersAttached) return;

    // Scraper listeners
    this.scraper.on('liveUpdate', (data) => this.onLiveUpdate(data));
    this.scraper.on('liveStatus', (status) => this.onLiveStatus(status));

    // API listeners
    this.api.on('liveUpdate', (data) => this.onLiveUpdate(data));
    this.api.on('liveStatus', (status) => this.onLiveStatus(status));

    this._liveListenersAttached = true;
  }

  // ── Toss Flow ──
  startToss() {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();

    // If live mode with a detected match, skip the toss
    if (this.isLiveMode && this.liveData) {
      this._autoStartFromLive();
      return;
    }

    document.getElementById('app').innerHTML = this.ui.renderTossScreen();
    this.gamePhase = 'toss';
  }

  _autoStartFromLive() {
    // Detect who's batting from the API score data
    const parsed = this.liveData;
    const scores = parsed.scores || [];

    // Try to figure out which team batted first from inning names
    let detectedBatFirst = null;
    let detectedBowlFirst = null;

    if (scores.length > 0) {
      const firstInning = (scores[0].inning || '').toLowerCase();
      if (firstInning.includes('india') || firstInning.includes('ind')) {
        detectedBatFirst = 'india';
        detectedBowlFirst = 'newZealand';
      } else if (firstInning.includes('new zealand') || firstInning.includes('nz') || firstInning.includes('zealand')) {
        detectedBatFirst = 'newZealand';
        detectedBowlFirst = 'india';
      }
    }

    // Fallback: check team names array
    if (!detectedBatFirst && parsed.teams && parsed.teams.length >= 2) {
      const t0 = parsed.teams[0].toLowerCase();
      if (t0.includes('india') || t0.includes('ind')) {
        detectedBatFirst = 'india';
        detectedBowlFirst = 'newZealand';
      } else {
        detectedBatFirst = 'newZealand';
        detectedBowlFirst = 'india';
      }
    }

    // Final fallback
    if (!detectedBatFirst) {
      detectedBatFirst = 'india';
      detectedBowlFirst = 'newZealand';
    }

    this.firstBattingTeam = detectedBatFirst;
    this.userTeam = detectedBowlFirst; // User captains the bowling side
    this.opponentTeam = detectedBatFirst;

    const batName = TEAMS[detectedBatFirst].name;
    const bowlName = TEAMS[detectedBowlFirst].name;
    this.ui.showToast(`📡 LIVE: ${batName} batted first. You captain ${bowlName}!`, 'success', 5000);

    this.startMatch();
  }

  selectTossTeam(teamKey) {
    this.userTeam = teamKey;
    this.opponentTeam = teamKey === 'india' ? 'newZealand' : 'india';

    document.querySelectorAll('.toss-team').forEach(el => el.classList.remove('selected'));
    document.getElementById(teamKey === 'india' ? 'toss-india' : 'toss-nz').classList.add('selected');

    document.getElementById('toss-choice').style.display = 'block';
  }

  tossDecision(choice) {
    if (choice === 'bat') {
      this.firstBattingTeam = this.userTeam;
    } else {
      this.firstBattingTeam = this.opponentTeam;
    }

    const userTeamName = TEAMS[this.userTeam].name;
    this.ui.showToast(`${userTeamName} won the toss and chose to ${choice} first!`, 'success');

    // Remove toss screen and start match
    setTimeout(() => this.startMatch(), 800);
  }

  // ── Match Start ──
  async startMatch() {
    const bowlingFirst = this.firstBattingTeam === this.userTeam ? this.opponentTeam : this.userTeam;

    // Initialize engine
    this.engine = new MatchEngine(this.firstBattingTeam, bowlingFirst);
    this.market = new PredictionMarket();
    this.captain = new CaptainMode(this.engine, this.market);

    // Set up engine event listeners
    this.engine.on('ball', (event) => this.onBall(event));
    this.engine.on('overEnd', (summary) => this.onOverEnd(summary));
    this.engine.on('inningsEnd', (data) => this.onInningsEnd(data));
    this.engine.on('matchEnd', (result) => this.onMatchEnd(result));

    // Set up LIVE API event listeners
    this._attachLiveListeners();

    // Initialize markets
    this.market.initializeMatchMarkets(this.firstBattingTeam, bowlingFirst);

    // Render game
    const tossScreen = document.getElementById('toss-screen');
    if (tossScreen) tossScreen.remove();
    document.getElementById('app').innerHTML = this.ui.renderGameLayout();

    this.gamePhase = 'playing';

    // Create first over markets
    this.market.createOverMarkets(0, this.engine.getMatchState());

    // If live mode, sync scoreboard with API data immediately
    if (this.isLiveMode && this.liveData) {
      this._syncScoreboardFromLive(this.liveData);
    }

    // Initial render
    this.updateAllUI();

    // Auto-connect to live API if key exists and not already connected
    if (this.isLiveMode && this.liveSource === 'scraper' && !this.scraper.isConnected) {
      const match = await this.scraper.findMatch();
      if (match) {
        this.scraper.startPolling(match.id || match.matchId, 15000);
      }
    } else if (this.api.hasApiKey() && !this.api.isLive) {
      this.tryLiveConnect();
    }

    // Check if user is bowling team — they make captain decisions
    this.ui.showToast(`${TEAMS[this.firstBattingTeam].name} batting first. Select your bowler!`, 'info');
  }

  // Sync engine state from live API data
  _syncScoreboardFromLive(parsed) {
    if (!parsed || !parsed.scores || parsed.scores.length === 0) return;
    if (!this.engine) return;

    const latestScore = parsed.scores[parsed.scores.length - 1];

    // Sync engine state from live data
    this.engine.runs = latestScore.runs;
    this.engine.wickets = latestScore.wickets;

    // Parse overs (e.g. "14.3" → over 14, ball 3)
    const oversFloat = parseFloat(latestScore.overs);
    if (!isNaN(oversFloat)) {
      this.engine.currentOver = Math.floor(oversFloat);
      this.engine.currentBall = Math.round((oversFloat % 1) * 10);
      this.engine.totalBalls = this.engine.currentOver * 6 + this.engine.currentBall;
    }

    // If 2nd innings exists, set up target
    if (parsed.scores.length >= 2 && this.engine.innings === 1) {
      const firstScore = parsed.scores[0];
      this.engine.firstInningsScore = {
        runs: firstScore.runs,
        wickets: firstScore.wickets,
        overs: String(firstScore.overs),
        battingTeam: this.firstBattingTeam,
      };
      this.engine.innings = 2;
      this.engine.target = firstScore.runs + 1;

      // Swap batting/bowling if needed for 2nd innings
      const secondInning = (parsed.scores[1].inning || '').toLowerCase();
      if ((secondInning.includes('india') && this.engine.battingTeamKey !== 'india') ||
          (secondInning.includes('new zealand') && this.engine.battingTeamKey !== 'newZealand')) {
        // Need to swap
        const temp = this.engine.battingTeamKey;
        this.engine.battingTeamKey = this.engine.bowlingTeamKey;
        this.engine.bowlingTeamKey = temp;
        this.engine.battingTeam = TEAMS[this.engine.battingTeamKey];
        this.engine.bowlingTeam = TEAMS[this.engine.bowlingTeamKey];
      }

      // Update 2nd innings score
      this.engine.runs = parsed.scores[1].runs;
      this.engine.wickets = parsed.scores[1].wickets;
      const ov2 = parseFloat(parsed.scores[1].overs);
      if (!isNaN(ov2)) {
        this.engine.currentOver = Math.floor(ov2);
        this.engine.currentBall = Math.round((ov2 % 1) * 10);
        this.engine.totalBalls = this.engine.currentOver * 6 + this.engine.currentBall;
      }
    }

    // Update innings badge
    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = this.engine.innings === 1 ? '1st Innings' : '2nd Innings';
    }
  }

  // ── Captain Actions ──
  selectBowler(bowlerId) {
    const success = this.engine.selectBowler(bowlerId);
    if (success) {
      const bowler = this.engine.currentBowler;
      const decision = this.captain.scoreDecision('bowlerSelection', { bowler });
      document.getElementById('captain-feedback').textContent = decision.feedback;
      document.getElementById('captain-score-header').textContent = this.captain.captainScore;
      this.updateAllUI();
    }
  }

  setField(setting) {
    this.engine.setFieldSetting(setting);
    const decision = this.captain.scoreDecision('fieldSetting', { setting });
    document.getElementById('captain-feedback').textContent = decision.feedback;
    document.getElementById('captain-score-header').textContent = this.captain.captainScore;
    this.updateAllUI();
  }

  useDRS() {
    if (this.engine.reviewsLeft <= 0) {
      this.ui.showToast('No reviews remaining!', 'error');
      return;
    }
    const decision = this.captain.scoreDecision('drsReview', {});
    this.ui.showToast(decision.feedback, decision.points > 0 ? 'success' : 'error');
    document.getElementById('captain-score-header').textContent = this.captain.captainScore;
    this.updateAllUI();
  }

  // ── Ball Actions ──
  bowlNextBall() {
    if (!this.engine.currentBowler) {
      this.ui.showToast('Select a bowler first!', 'warning');
      return;
    }

    if (this.engine.isComplete) return;

    const ballEvent = this.engine.simulateBall();
    if (!ballEvent) return;

    // Update markets after each ball
    this.market.updateOdds(this.engine.getMatchState());

    // UI update with animation delay
    this.updateAllUI();

    // Special toasts for big events
    if (ballEvent.outcome.type === 'wicket') {
      this.ui.showToast(`☠️ WICKET! ${ballEvent.striker.name} is out!`, 'error', 4000);
    } else if (ballEvent.outcome.runs === 6) {
      this.ui.showToast(`💥 MASSIVE SIX by ${ballEvent.striker.name}!`, 'success', 3000);
    } else if (ballEvent.outcome.runs === 4) {
      this.ui.showToast(`🏏 FOUR! Beautiful shot!`, 'info', 2000);
    }
  }

  // ── Market Actions ──
  buyMarket(marketId, side) {
    const amountInput = document.getElementById(`market-amount-${marketId}`);
    const amount = amountInput ? parseInt(amountInput.value) || 100 : 100;

    const result = this.market.buyShares(marketId, side, amount);
    if (result) {
      this.ui.showToast(
        `Bought ${result.shares.toFixed(1)} ${side.toUpperCase()} shares at ${result.price.toFixed(3)} (${result.total} tokens)`,
        'success',
        3000
      );
      this.ui.renderMarkets(this.market);
      this.ui.renderPortfolio(this.market);
    } else {
      this.ui.showToast('Trade failed. Check your balance!', 'error');
    }
  }

  // ── Event Handlers ──
  onBall(event) {
    // Update innings badge
    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = this.engine.innings === 1 ? '1st Innings' : '2nd Innings';
    }
  }

  onOverEnd(summary) {
    // Resolve over markets
    const state = this.engine.getMatchState();
    const overState = {
      ...state,
      overRuns: summary.runs,
      overWickets: summary.wickets,
      overBalls: summary.balls,
    };
    this.market.resolveOverMarkets(summary.overNum, overState);

    // Check if powerplay is ending
    if (summary.overNum + 1 === 6) {
      this.market.resolveOverMarkets(summary.overNum, { ...overState, runs: this.engine.runs });
    }

    // Create markets for next over if match continues
    if (!this.engine.isComplete && this.engine.currentOver < 20) {
      this.market.createOverMarkets(this.engine.currentOver, this.engine.getMatchState());
    }

    this.ui.showToast(
      `End of Over ${summary.overNum + 1}: ${summary.runs} runs, ${summary.wickets} wickets | ${summary.balls.join(' ')}`,
      'info',
      4000
    );

    // Need new bowler selection
    this.captain.needsBowlerSelection = true;
    this.updateAllUI();
  }

  onInningsEnd(data) {
    this.market.resolveInningsMarkets(data);
    this.gamePhase = 'inningsBreak';
    this.ui.showInningsBreak(data);
  }

  startSecondInnings() {
    this.ui.hideInningsBreak();
    this.engine.startSecondInnings();
    this.market.createOverMarkets(0, this.engine.getMatchState());

    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = '2nd Innings';
    }

    this.gamePhase = 'playing';
    this.ui.showToast(
      `${TEAMS[this.engine.battingTeamKey].name} need ${this.engine.target} to win!`,
      'info',
      4000
    );
    this.updateAllUI();
  }

  onMatchEnd(result) {
    this.market.resolveMatchMarkets(result, this.firstBattingTeam);
    this.market.getOpenMarkets().forEach(m => {
      this.market.resolveMarket(m.id, 'no');
    });

    const summary = this.market.getPortfolioSummary();
    this.gamePhase = 'matchEnd';

    setTimeout(() => {
      this.ui.showMatchResult(result, summary);
    }, 1500);
  }

  // ── UI Update ──
  updateAllUI() {
    if (!this.engine) return;
    this.ui.renderScoreboard(this.engine);
    this.ui.renderCaptainPanel(this.engine, this.captain);
    this.ui.renderMarkets(this.market);
    this.ui.renderPortfolio(this.market);
  }

  // ── API Modal ──
  showApiModal() {
    const existing = document.getElementById('api-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', this.ui.renderApiModal(this.api.getApiKey()));
  }

  hideApiModal() {
    const modal = document.getElementById('api-modal');
    if (modal) modal.remove();
  }

  saveApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input ? input.value.trim() : '';
    this.api.setApiKey(key);
    this.hideApiModal();
    this.ui.showToast(key ? 'API key saved! Connecting...' : 'API key cleared.', key ? 'success' : 'info');

    // Stop any existing polling
    this.api.stopPolling();
    this.scraper.stopPolling();

    if (key) {
      this.liveSource = 'api';
      this._attachLiveListeners();
      this.tryLiveConnect();
    } else {
      // If scraper is available, switch back to it
      this.scraper.isAvailable().then(ok => {
        if (ok) {
          this.liveSource = 'scraper';
          this.tryLiveConnect();
        } else {
          this.isLiveMode = false;
          this.liveData = null;
          this.hideLiveOverlay();
        }
      });
    }
  }

  async tryLiveConnect() {
    if (!this.liveSource) return;

    this._attachLiveListeners();
    this.ui.showToast('🔍 Searching for live match...', 'info');

    let match = null;

    if (this.liveSource === 'scraper') {
      // Use Cricbuzz scraper (no API key!)
      match = await this.scraper.findMatch();
      if (match) {
        this.liveMatchInfo = match;
        this.isLiveMode = true;
        this.liveData = this.scraper.normalize(match);

        this.ui.showToast(`🕷️ Scraping live: ${match.name || 'Live match found'}`, 'success', 4000);

        const liveBadge = document.getElementById('live-badge');
        if (liveBadge) {
          liveBadge.style.display = 'flex';
          liveBadge.classList.add('live');
        }

        if (this.gamePhase === 'start') {
          this._updateStartScreenForLive(match);
        }

        this.scraper.startPolling(match.id || match.matchId, 15000);
        return;
      }
    }

    if (this.liveSource === 'api' || !match) {
      // Fallback: CricketData.org API
      if (!this.api.hasApiKey()) {
        this.ui.showToast('No live data source available. Using simulation mode.', 'warning');
        return;
      }

      match = await this.api.findLiveMatch();
      if (match) {
        this.liveMatchInfo = match;
        this.isLiveMode = true;
        this.liveSource = 'api';

        this.ui.showToast(`📡 Connected: ${match.name || 'Live match found'}`, 'success', 4000);

        const liveBadge = document.getElementById('live-badge');
        if (liveBadge) {
          liveBadge.style.display = 'flex';
          liveBadge.classList.add('live');
        }

        if (this.gamePhase === 'start') {
          this._updateStartScreenForLive(match);
        }

        await this.api.startPolling(match.id, 20000);
      } else {
        this.isLiveMode = false;
        this.ui.showToast('No live match found. Playing in simulation mode.', 'warning');
      }
    }
  }

  _updateStartScreenForLive(match) {
    const startBtn = document.getElementById('btn-start-match');
    if (startBtn) {
      startBtn.textContent = '📡 JOIN LIVE MATCH';
      startBtn.style.background = 'linear-gradient(135deg, #ff3b5c 0%, #ff8c00 100%)';
    }
    const metaEl = document.querySelector('.start-match-meta');
    if (metaEl) {
      metaEl.innerHTML = `<span style="color:#ff3b5c; font-weight:700;">● LIVE NOW</span> — ${match.name || 'ICC T20 WC 2026 Final'}`;
    }
  }

  // ── Live API Handlers ──
  onLiveUpdate(data) {
    if (!data || !data.parsed) return;
    const { parsed, raw } = data;

    console.log('📡 Live update received:', parsed);

    // Store latest live data
    this.liveData = parsed;
    this.isLiveMode = true;

    // Render/update the live overlay always
    this.renderLiveOverlay(parsed, raw);

    // If game engine is active, sync the main scoreboard
    if (this.engine && this.gamePhase === 'playing') {
      this._syncScoreboardFromLive(parsed);
      this.updateAllUI();

      // Also update market odds based on fresh live data
      if (this.market) {
        this.market.updateOdds(this.engine.getMatchState());
      }
    }

    // Update live badge wherever it may be
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) {
      liveBadge.style.display = 'flex';
      liveBadge.classList.add('live');
      liveBadge.querySelector('span').textContent = 'LIVE';
    }
  }

  onLiveStatus(status) {
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) {
      if (status.isLive) {
        liveBadge.style.display = 'flex';
        liveBadge.classList.add('live');
      } else {
        liveBadge.classList.remove('live');
      }
    }
  }

  renderLiveOverlay(parsed, raw) {
    let overlay = document.getElementById('live-score-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'live-score-overlay';
      overlay.style.cssText = `
        position: fixed; bottom: 16px; right: 16px; z-index: 500;
        background: rgba(15, 20, 50, 0.92); backdrop-filter: blur(20px);
        border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 16px;
        padding: 16px 20px; min-width: 320px; max-width: 420px;
        box-shadow: 0 0 30px rgba(0, 212, 255, 0.15), 0 8px 40px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }

    const scores = parsed.scores || [];
    const status = parsed.status || raw.status || '';
    const matchName = parsed.name || '';

    let scoresHtml = scores.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:0.78rem; color:#8892b0; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.inning || 'Innings'}</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:1rem; font-weight:700; color:#e8eaf6;">${s.runs}/${s.wickets} <span style="font-size:0.75rem; color:#00d4ff;">(${s.overs})</span></span>
      </div>
    `).join('');

    let battingHtml = '';
    if (parsed.batting && parsed.batting.length > 0) {
      const activeBatters = parsed.batting.filter(b => !b.dismissal || b.dismissal === 'not out' || b.dismissal === 'batting');
      const recentBatters = activeBatters.length > 0 ? activeBatters.slice(-2) : parsed.batting.slice(-2);
      battingHtml = recentBatters.map(b => `
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; padding:3px 0;">
          <span style="color:#8892b0;">${b.name}</span>
          <span style="color:#00ff88; font-family:'JetBrains Mono',monospace; font-weight:600;">${b.runs}(${b.balls})</span>
        </div>
      `).join('');
    }

    overlay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:8px; height:8px; background:#ff3b5c; border-radius:50%; animation:pulse-dot 1.5s ease infinite;"></span>
          <span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#ff3b5c;">LIVE SCORE</span>
        </div>
        <button onclick="app.hideLiveOverlay()" style="background:none; border:none; color:#4a5568; cursor:pointer; font-size:1rem; padding:0 4px;">✕</button>
      </div>
      <div style="font-size:0.78rem; color:#e8eaf6; font-weight:600; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${matchName}</div>
      ${scoresHtml}
      ${battingHtml ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">${battingHtml}</div>` : ''}
      <div style="font-size:0.68rem; color:#4a5568; margin-top:8px; font-style:italic;">${status}</div>
      <div style="font-size:0.6rem; color:#4a5568; margin-top:4px;">Auto-refreshes every 20s</div>
    `;

    // Flash animation on update
    overlay.style.borderColor = 'rgba(0, 255, 136, 0.5)';
    setTimeout(() => { overlay.style.borderColor = 'rgba(0, 212, 255, 0.3)'; }, 800);
  }

  hideLiveOverlay() {
    const overlay = document.getElementById('live-score-overlay');
    if (overlay) overlay.remove();
  }
}

// ── Initialize App ──
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
