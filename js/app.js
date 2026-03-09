// ============================================
// app.js — Main Application Controller
// Phase-aware: PRE_MATCH → TOSS → FIRST_INNINGS → INNINGS_BREAK → SECOND_INNINGS → COMPLETE
// ============================================

class App {
  constructor() {
    this.ui = new GameUI();
    this.api = new CricketAPI();
    this.scraper = new CricbuzzScraper();
    this.db = new MatchDB();
    this.engine = null;
    this.market = null;
    this.captain = null;

    this.userTeam = null;
    this.opponentTeam = null;
    this.firstBattingTeam = null;
    this.gamePhase = 'start'; // UI phase: start, toss, playing, inningsBreak, matchEnd

    // Live mode state
    this.isLiveMode = false;
    this.liveData = null;
    this.liveMatchInfo = null;
    this.liveSource = null;     // 'scraper' or 'api'
    this._liveListenersAttached = false;

    // Supabase state
    this.dbMatch = null;
    this.dbInnings = null;

    this.init();
  }

  async init() {
    document.getElementById('app').innerHTML = this.ui.renderStartScreen();

    // Initialize Supabase
    await this.db.init();

    // Try scraper first (no API key needed!), then CricketData API
    this._attachLiveListeners();

    const scraperAvailable = await this.scraper.isAvailable();
    if (scraperAvailable) {
      console.log('🕷️ Scraper proxy detected — using Cricbuzz');
      this.liveSource = 'scraper';
      await this.tryLiveConnect();
    } else if (this.api.hasApiKey()) {
      console.log('🔑 Using CricketData.org API');
      this.liveSource = 'api';
      await this.tryLiveConnect();
    } else {
      console.log('🎮 Simulation mode — no live data source');
    }
  }

  _attachLiveListeners() {
    if (this._liveListenersAttached) return;
    this.scraper.on('liveUpdate', (data) => this.onLiveUpdate(data));
    this.scraper.on('liveStatus', (status) => this.onLiveStatus(status));
    this.api.on('liveUpdate', (data) => this.onLiveUpdate(data));
    this.api.on('liveStatus', (status) => this.onLiveStatus(status));
    this._liveListenersAttached = true;
  }

  // ── Toss Flow ──
  startToss() {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();

    // If live mode with detected match, skip toss
    if (this.isLiveMode && this.liveData) {
      this._autoStartFromLive();
      return;
    }

    document.getElementById('app').innerHTML = this.ui.renderTossScreen();
    this.gamePhase = 'toss';
  }

  _autoStartFromLive() {
    const parsed = this.liveData;
    const scores = parsed.scores || [];

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

    if (!detectedBatFirst && parsed.teams && parsed.teams.length >= 2) {
      const t0 = parsed.teams[0].toLowerCase();
      detectedBatFirst = (t0.includes('india') || t0.includes('ind')) ? 'india' : 'newZealand';
      detectedBowlFirst = detectedBatFirst === 'india' ? 'newZealand' : 'india';
    }

    if (!detectedBatFirst) {
      detectedBatFirst = 'india';
      detectedBowlFirst = 'newZealand';
    }

    this.firstBattingTeam = detectedBatFirst;
    this.userTeam = detectedBowlFirst;
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
    this.firstBattingTeam = choice === 'bat' ? this.userTeam : this.opponentTeam;
    const userTeamName = TEAMS[this.userTeam].name;
    this.ui.showToast(`${userTeamName} won the toss and chose to ${choice} first!`, 'success');
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
    this.engine.on('ball', (e) => this.onBall(e));
    this.engine.on('overEnd', (s) => this.onOverEnd(s));
    this.engine.on('inningsEnd', (d) => this.onInningsEnd(d));
    this.engine.on('matchEnd', (r) => this.onMatchEnd(r));

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

    // If live mode, sync from API data
    if (this.isLiveMode && this.liveData) {
      this.engine.loadFromLiveData(this.liveData);
    }

    // Create match in Supabase
    if (this.db.isReady) {
      const cricbuzzId = this.liveMatchInfo?.id || `sim_${Date.now()}`;
      this.dbMatch = await this.db.createOrGetMatch(cricbuzzId, {
        name: this.liveMatchInfo?.name || `${TEAMS[this.firstBattingTeam].name} vs ${TEAMS[bowlingFirst].name}`,
        team1: TEAMS[this.firstBattingTeam].name,
        team2: TEAMS[bowlingFirst].name,
        status: 'first_innings',
      });

      if (this.dbMatch) {
        this.dbInnings = await this.db.createOrGetInnings(
          this.dbMatch.id, 1,
          TEAMS[this.firstBattingTeam].name,
          TEAMS[bowlingFirst].name
        );
      }
    }

    this.updateAllUI();

    // Auto-connect to live if available
    if (this.isLiveMode && this.liveSource === 'scraper' && !this.scraper.isConnected) {
      const match = await this.scraper.findMatch();
      if (match) this.scraper.startPolling(match.id || match.matchId, 15000);
    } else if (this.api.hasApiKey() && !this.api.isLive) {
      this.tryLiveConnect();
    }

    this.ui.showToast(`${TEAMS[this.firstBattingTeam].name} batting first. Select your bowler!`, 'info');
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
  async bowlNextBall() {
    if (!this.engine.currentBowler) {
      this.ui.showToast('Select a bowler first!', 'warning');
      return;
    }
    if (this.engine.isComplete) return;

    const ballEvent = this.engine.simulateBall();
    if (!ballEvent) return;

    // Save ball to Supabase
    if (this.db.isReady && this.dbInnings) {
      this.db.saveBallEvent(this.dbInnings.id, {
        over: ballEvent.over,
        ball: ballEvent.ball,
        batsman: ballEvent.striker.name,
        bowler: ballEvent.bowler.name,
        runs: ballEvent.outcome.runs || 0,
        extrasType: ballEvent.outcome.type === 'wide' ? 'wide' : ballEvent.outcome.type === 'noBall' ? 'noball' : null,
        extrasRuns: (ballEvent.outcome.type === 'wide' || ballEvent.outcome.type === 'noBall') ? ballEvent.outcome.runs : 0,
        isWicket: ballEvent.outcome.type === 'wicket',
        wicketType: ballEvent.outcome.dismissal || null,
        dismissedPlayer: ballEvent.outcome.type === 'wicket' ? ballEvent.striker.name : null,
        commentary: ballEvent.commentary,
      });

      // Update innings stats
      this.db.updateInnings(this.dbInnings.id, {
        runs: this.engine.runs,
        wickets: this.engine.wickets,
        overs: this.engine.getOversDisplay(),
        extras: this.engine.extras,
      });
    }

    // Update markets
    this.market.updateOdds(this.engine.getMatchState());

    this.updateAllUI();

    // Toasts for big events
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
        'success', 3000
      );
      this.ui.renderMarkets(this.market);
      this.ui.renderPortfolio(this.market);
    } else {
      this.ui.showToast('Trade failed. Check your balance!', 'error');
    }
  }

  // ── Event Handlers ──
  onBall(event) {
    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = this.engine.innings === 1 ? '1st Innings' : '2nd Innings';
    }
  }

  onOverEnd(summary) {
    const state = this.engine.getMatchState();
    const overState = {
      ...state,
      overRuns: summary.runs,
      overWickets: summary.wickets,
      overBalls: summary.balls,
    };
    this.market.resolveOverMarkets(summary.overNum, overState);

    if (summary.overNum + 1 === 6) {
      this.market.resolveOverMarkets(summary.overNum, { ...overState, runs: this.engine.runs });
    }

    if (!this.engine.isComplete && this.engine.currentOver < 20) {
      this.market.createOverMarkets(this.engine.currentOver, this.engine.getMatchState());
    }

    this.ui.showToast(
      `End of Over ${summary.overNum + 1}: ${summary.runs} runs, ${summary.wickets} wickets | ${summary.balls.join(' ')}`,
      'info', 4000
    );

    this.captain.needsBowlerSelection = true;
    this.updateAllUI();
  }

  async onInningsEnd(data) {
    this.market.resolveInningsMarkets(data);
    this.gamePhase = 'inningsBreak';

    // Save batting/bowling cards to Supabase
    if (this.db.isReady && this.dbInnings && data.batting) {
      for (const bat of data.batting) {
        await this.db.upsertBattingCard(this.dbInnings.id, bat);
      }
      for (const bowl of data.bowling) {
        await this.db.upsertBowlingCard(this.dbInnings.id, bowl);
      }
      // Update match status
      if (this.dbMatch) {
        await this.db.updateMatchStatus(this.dbMatch.id, 'innings_break');
      }
    }

    this.ui.showInningsBreak(data, this.engine);
  }

  async startSecondInnings() {
    this.ui.hideInningsBreak();
    this.engine.startSecondInnings();

    // Create 2nd innings in Supabase
    if (this.db.isReady && this.dbMatch) {
      this.dbInnings = await this.db.createOrGetInnings(
        this.dbMatch.id, 2,
        TEAMS[this.engine.battingTeamKey].name,
        TEAMS[this.engine.bowlingTeamKey].name
      );
      await this.db.updateMatchStatus(this.dbMatch.id, 'second_innings');
    }

    this.market.createOverMarkets(0, this.engine.getMatchState());

    const badge = document.getElementById('innings-badge');
    if (badge) badge.querySelector('span').textContent = '2nd Innings';

    this.gamePhase = 'playing';
    this.ui.showToast(
      `${TEAMS[this.engine.battingTeamKey].name} need ${this.engine.target} to win!`,
      'info', 4000
    );
    this.updateAllUI();
  }

  async onMatchEnd(result) {
    this.market.resolveMatchMarkets(result, this.firstBattingTeam);
    this.market.getOpenMarkets().forEach(m => {
      this.market.resolveMarket(m.id, 'no');
    });

    const summary = this.market.getPortfolioSummary();
    this.gamePhase = 'matchEnd';

    // Save to Supabase
    if (this.db.isReady && this.dbMatch) {
      const sc = this.engine.getFullScorecard();
      await this.db.updateMatchStatus(this.dbMatch.id, 'complete', {
        winner: result.winnerName || result.detail,
        result_text: result.detail,
        mom: sc.mom?.name || null,
        mom_stats: sc.mom?.stats || null,
      });

      // Save 2nd innings cards
      if (this.dbInnings && sc.innings2) {
        for (const bat of (sc.innings2.batting || [])) {
          await this.db.upsertBattingCard(this.dbInnings.id, bat);
        }
        for (const bowl of (sc.innings2.bowling || [])) {
          await this.db.upsertBowlingCard(this.dbInnings.id, bowl);
        }
      }
    }

    setTimeout(() => {
      this.ui.showMatchResult(result, summary, this.engine);
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
    this.api.stopPolling();
    this.scraper.stopPolling();

    if (key) {
      this.liveSource = 'api';
      this._attachLiveListeners();
      this.tryLiveConnect();
    } else {
      this.scraper.isAvailable().then(ok => {
        if (ok) { this.liveSource = 'scraper'; this.tryLiveConnect(); }
        else { this.isLiveMode = false; this.liveData = null; this.hideLiveOverlay(); }
      });
    }
  }

  async tryLiveConnect() {
    if (!this.liveSource) return;
    this._attachLiveListeners();
    this.ui.showToast('🔍 Searching for live match...', 'info');

    let match = null;

    if (this.liveSource === 'scraper') {
      match = await this.scraper.findMatch();
      if (match) {
        this.liveMatchInfo = match;
        this.isLiveMode = true;
        this.liveData = this.scraper.normalize(match);

        this.ui.showToast(`🕷️ Scraping live: ${match.name || 'Match found'}`, 'success', 4000);
        const liveBadge = document.getElementById('live-badge');
        if (liveBadge) { liveBadge.style.display = 'flex'; liveBadge.classList.add('live'); }

        if (this.gamePhase === 'start') this._updateStartScreenForLive(match);
        this.scraper.startPolling(match.id || match.matchId, 15000);
        return;
      }
    }

    if (this.liveSource === 'api' || !match) {
      if (!this.api.hasApiKey()) {
        this.ui.showToast('No live data source. Using simulation.', 'warning');
        return;
      }
      match = await this.api.findLiveMatch();
      if (match) {
        this.liveMatchInfo = match;
        this.isLiveMode = true;
        this.liveSource = 'api';

        this.ui.showToast(`📡 Connected: ${match.name || 'Match found'}`, 'success', 4000);
        const liveBadge = document.getElementById('live-badge');
        if (liveBadge) { liveBadge.style.display = 'flex'; liveBadge.classList.add('live'); }

        if (this.gamePhase === 'start') this._updateStartScreenForLive(match);
        await this.api.startPolling(match.id, 20000);
      } else {
        this.isLiveMode = false;
        this.ui.showToast('No live match found. Simulation mode.', 'warning');
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
    const { parsed } = data;

    console.log('📡 Live update received:', parsed);
    this.liveData = parsed;
    this.isLiveMode = true;

    // Render live overlay
    this.renderLiveOverlay(parsed);

    // Sync to engine if game is active
    if (this.engine && this.gamePhase === 'playing') {
      this.engine.loadFromLiveData(parsed);
      this.updateAllUI();

      if (this.market) {
        this.market.updateOdds(this.engine.getMatchState());
      }
    }

    // Update badge
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
      if (status.isLive) { liveBadge.style.display = 'flex'; liveBadge.classList.add('live'); }
      else { liveBadge.classList.remove('live'); }
    }
  }

  renderLiveOverlay(parsed) {
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
        font-family: 'Inter', sans-serif; transition: all 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }

    const scores = parsed.scores || [];
    const status = parsed.status || '';
    const matchName = parsed.name || '';

    let scoresHtml = scores.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:0.78rem; color:#8892b0;">${s.inning || 'Innings'}</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:1rem; font-weight:700; color:#e8eaf6;">${s.runs}/${s.wickets} <span style="font-size:0.75rem; color:#00d4ff;">(${s.overs})</span></span>
      </div>
    `).join('');

    let battingHtml = '';
    if (parsed.batting && parsed.batting.length > 0) {
      const recent = parsed.batting.slice(-2);
      battingHtml = recent.map(b => `
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
      <div style="font-size:0.78rem; color:#e8eaf6; font-weight:600; margin-bottom:8px;">${matchName}</div>
      ${scoresHtml}
      ${battingHtml ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">${battingHtml}</div>` : ''}
      <div style="font-size:0.68rem; color:#4a5568; margin-top:8px; font-style:italic;">${status}</div>
      <div style="font-size:0.6rem; color:#4a5568; margin-top:4px;">Auto-refreshes every 15s</div>
    `;

    overlay.style.borderColor = 'rgba(0, 255, 136, 0.5)';
    setTimeout(() => { overlay.style.borderColor = 'rgba(0, 212, 255, 0.3)'; }, 800);
  }

  hideLiveOverlay() {
    const overlay = document.getElementById('live-score-overlay');
    if (overlay) overlay.remove();
  }

  // ── View Full Scorecard ──
  showScorecard() {
    if (!this.engine) return;
    this.ui.showFullScorecard(this.engine);
  }

  hideScorecard() {
    const el = document.getElementById('scorecard-overlay');
    if (el) el.remove();
  }
}

// ── Initialize App ──
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
