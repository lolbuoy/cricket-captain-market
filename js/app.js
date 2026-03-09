// ============================================
// app.js — Main Application Controller
// Data-driven from scraping — match state determines UI
// No popups, no toasts, no banners
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

    this.matchData = null;    // Raw scraped data — single source of truth
    this.userTeam = null;
    this.opponentTeam = null;
    this.firstBattingTeam = null;
    this.gamePhase = 'loading'; // loading, results, playing, simulation

    this.dbMatch = null;
    this.dbInnings = null;

    this.init();
  }

  async init() {
    document.getElementById('app').innerHTML = this.ui.renderLoadingScreen();

    // Initialize Supabase (doesn't block UI)
    this.db.init();

    // Try to get match data
    const available = await this.scraper.isAvailable();
    if (available) {
      const data = await this.scraper.findMatch();
      if (data) {
        this.matchData = data;
        this._routeByMatchState(data);
        return;
      }
    }

    // No scraper / no match found → simulation mode
    this._showStartScreen();
  }

  // ── ROUTE BY MATCH STATE ──
  // This is the core logic: match data drives what the user sees
  _routeByMatchState(data) {
    const status = data.matchStatus;

    if (status === 'complete') {
      this._showCompletedMatch(data);
    } else if (status === 'live' || status === 'innings_break') {
      this._showLiveMatch(data);
    } else if (status === 'upcoming') {
      this._showUpcomingMatch(data);
    } else {
      // Unknown state — show what we have
      if (data.innings && data.innings.length > 0) {
        this._showCompletedMatch(data);
      } else {
        this._showStartScreen();
      }
    }
  }

  // ── COMPLETED MATCH ──
  // Match is done. Show results with full scorecard. No gameplay.
  _showCompletedMatch(data) {
    this.gamePhase = 'results';
    document.getElementById('app').innerHTML = this.ui.renderCompletedMatch(data);
  }

  // ── UPCOMING MATCH ──
  _showUpcomingMatch(data) {
    this.gamePhase = 'upcoming';
    document.getElementById('app').innerHTML = this.ui.renderUpcomingMatch(data);
  }

  // ── LIVE MATCH ──
  _showLiveMatch(data) {
    this.gamePhase = 'playing';

    // Determine teams from scraped data
    const innings = data.innings || [];
    if (innings.length > 0) {
      const firstBat = innings[0].battingTeam;
      const firstBowl = innings[0].bowlingTeam || data.team2 || 'Team 2';

      // Map to team keys
      this.firstBattingTeam = this._resolveTeamKey(firstBat);
      const bowlKey = this._resolveTeamKey(firstBowl);

      this.userTeam = bowlKey;     // User captains the bowling side
      this.opponentTeam = this.firstBattingTeam;

      this._initEngine(this.firstBattingTeam, bowlKey, data.totalOvers || 20);
      this.engine.loadFromLiveData(data);
    } else {
      // Can't determine batting order from live data — default
      this._initEngine('india', 'newZealand', data.totalOvers || 20);
    }

    // Render game layout
    document.getElementById('app').innerHTML = this.ui.renderGameLayout();
    this.market.initializeMatchMarkets(this.firstBattingTeam, this.userTeam);
    this.market.createOverMarkets(0, this.engine.getMatchState());
    this.updateAllUI();

    // Start polling for updates
    if (data.matchId) {
      this.scraper.on('matchUpdate', (newData) => this._onLiveUpdate(newData));
      this.scraper.startPolling(data.matchId, 15000);
    }
  }

  _onLiveUpdate(data) {
    if (!this.engine) return;
    this.matchData = data;
    this.engine.loadFromLiveData(data);
    this.market.updateOdds(this.engine.getMatchState());
    this.updateAllUI();

    // If match just completed, show results
    if (data.matchStatus === 'complete') {
      this._showCompletedMatch(data);
    }
  }

  _resolveTeamKey(teamName) {
    if (!teamName) return 'india';
    const lower = teamName.toLowerCase();
    if (lower.includes('india') || lower === 'ind') return 'india';
    if (lower.includes('zealand') || lower === 'nz') return 'newZealand';
    return 'india'; // Default
  }

  // ── SIMULATION MODE (no live data) ──
  _showStartScreen() {
    this.gamePhase = 'start';
    document.getElementById('app').innerHTML = this.ui.renderStartScreen();
  }

  startToss() {
    document.getElementById('app').innerHTML = this.ui.renderTossScreen();
    this.gamePhase = 'toss';
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
    this.gamePhase = 'simulation';
    setTimeout(() => this.startMatch(), 300);
  }

  startMatch() {
    const bowlingFirst = this.firstBattingTeam === this.userTeam ? this.opponentTeam : this.userTeam;
    this._initEngine(this.firstBattingTeam, bowlingFirst, 20);

    document.getElementById('app').innerHTML = this.ui.renderGameLayout();
    this.market.initializeMatchMarkets(this.firstBattingTeam, bowlingFirst);
    this.market.createOverMarkets(0, this.engine.getMatchState());
    this.updateAllUI();
  }

  _initEngine(batTeam, bowlTeam, totalOvers) {
    this.engine = new MatchEngine(batTeam, bowlTeam);
    this.engine.totalOvers = totalOvers;
    this.market = new PredictionMarket();
    this.captain = new CaptainMode(this.engine, this.market);

    this.engine.on('ball', (e) => this.onBall(e));
    this.engine.on('overEnd', (s) => this.onOverEnd(s));
    this.engine.on('inningsEnd', (d) => this.onInningsEnd(d));
    this.engine.on('matchEnd', (r) => this.onMatchEnd(r));
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
    if (this.engine.reviewsLeft <= 0) return;
    const decision = this.captain.scoreDecision('drsReview', {});
    document.getElementById('captain-score-header').textContent = this.captain.captainScore;
    this.updateAllUI();
  }

  // ── Ball Actions ──
  async bowlNextBall() {
    if (!this.engine.currentBowler || this.engine.isComplete) return;

    const ballEvent = this.engine.simulateBall();
    if (!ballEvent) return;

    // Save to Supabase
    if (this.db.isReady && this.dbInnings) {
      this.db.saveBallEvent(this.dbInnings.id, {
        over: ballEvent.over, ball: ballEvent.ball,
        batsman: ballEvent.striker.name, bowler: ballEvent.bowler.name,
        runs: ballEvent.outcome.runs || 0,
        extrasType: ballEvent.outcome.type === 'wide' ? 'wide' : ballEvent.outcome.type === 'noBall' ? 'noball' : null,
        extrasRuns: (ballEvent.outcome.type === 'wide' || ballEvent.outcome.type === 'noBall') ? ballEvent.outcome.runs : 0,
        isWicket: ballEvent.outcome.type === 'wicket',
        wicketType: ballEvent.outcome.dismissal || null,
        dismissedPlayer: ballEvent.outcome.type === 'wicket' ? ballEvent.striker.name : null,
        commentary: ballEvent.commentary,
      });
      this.db.updateInnings(this.dbInnings.id, {
        runs: this.engine.runs, wickets: this.engine.wickets,
        overs: this.engine.getOversDisplay(), extras: this.engine.extras,
      });
    }

    this.market.updateOdds(this.engine.getMatchState());
    this.updateAllUI();
  }

  // ── Market Actions ──
  buyMarket(marketId, side) {
    const amountInput = document.getElementById(`market-amount-${marketId}`);
    const amount = amountInput ? parseInt(amountInput.value) || 100 : 100;
    const result = this.market.buyShares(marketId, side, amount);
    if (result) {
      this.ui.renderMarkets(this.market);
      this.ui.renderPortfolio(this.market);
    }
  }

  // ── Event Handlers ──
  onBall(event) {
    const badge = document.getElementById('innings-badge');
    if (badge) badge.querySelector('span').textContent = this.engine.innings === 1 ? '1st Innings' : '2nd Innings';
  }

  onOverEnd(summary) {
    const state = this.engine.getMatchState();
    this.market.resolveOverMarkets(summary.overNum, {
      ...state, overRuns: summary.runs, overWickets: summary.wickets, overBalls: summary.balls,
    });
    if (summary.overNum + 1 === 6) {
      this.market.resolveOverMarkets(summary.overNum, { ...state, runs: this.engine.runs });
    }
    if (!this.engine.isComplete && this.engine.currentOver < this.engine.totalOvers) {
      this.market.createOverMarkets(this.engine.currentOver, this.engine.getMatchState());
    }
    this.captain.needsBowlerSelection = true;
    this.updateAllUI();
  }

  async onInningsEnd(data) {
    this.market.resolveInningsMarkets(data);
    this.gamePhase = 'inningsBreak';

    if (this.db.isReady && this.dbInnings && data.batting) {
      for (const bat of data.batting) await this.db.upsertBattingCard(this.dbInnings.id, bat);
      for (const bowl of data.bowling) await this.db.upsertBowlingCard(this.dbInnings.id, bowl);
      if (this.dbMatch) await this.db.updateMatchStatus(this.dbMatch.id, 'innings_break');
    }

    this.ui.showInningsBreak(data, this.engine);
  }

  async startSecondInnings() {
    this.ui.hideInningsBreak();
    this.engine.startSecondInnings();

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
    this.updateAllUI();
  }

  async onMatchEnd(result) {
    this.market.resolveMatchMarkets(result, this.firstBattingTeam);
    this.market.getOpenMarkets().forEach(m => this.market.resolveMarket(m.id, 'no'));

    const summary = this.market.getPortfolioSummary();
    this.gamePhase = 'matchEnd';

    if (this.db.isReady && this.dbMatch) {
      const sc = this.engine.getFullScorecard();
      await this.db.updateMatchStatus(this.dbMatch.id, 'complete', {
        winner: result.winnerName || result.detail, result_text: result.detail,
        mom: sc.mom?.name || null, mom_stats: sc.mom?.stats || null,
      });
    }

    setTimeout(() => this.ui.showMatchResult(result, summary, this.engine), 1000);
  }

  // ── UI Update ──
  updateAllUI() {
    if (!this.engine) return;
    this.ui.renderScoreboard(this.engine);
    this.ui.renderCaptainPanel(this.engine, this.captain);
    this.ui.renderMarkets(this.market);
    this.ui.renderPortfolio(this.market);
  }

  // ── View Scorecard ──
  showScorecard() {
    if (this.engine) this.ui.showFullScorecard(this.engine);
  }

  hideScorecard() {
    const el = document.getElementById('scorecard-overlay');
    if (el) el.remove();
  }

  // ── API Key (optional, for CricketData.org fallback) ──
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
  }
}

// ── Initialize App ──
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
