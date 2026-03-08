// ============================================
// app.js — Main Application Controller
// ============================================

class App {
  constructor() {
    this.ui = new GameUI();
    this.api = new CricketAPI();
    this.engine = null;
    this.market = null;
    this.captain = null;

    this.userTeam = null;
    this.opponentTeam = null;
    this.firstBattingTeam = null;
    this.gamePhase = 'start'; // start, toss, playing, inningsBreak, matchEnd

    this.init();
  }

  init() {
    document.getElementById('app').innerHTML = this.ui.renderStartScreen();
  }

  // ── Toss Flow ──
  startToss() {
    document.getElementById('start-screen').remove();
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
    if (choice === 'bat') {
      this.firstBattingTeam = this.userTeam;
    } else {
      this.firstBattingTeam = this.opponentTeam;
    }

    const userTeamName = TEAMS[this.userTeam].name;
    const batFirstName = TEAMS[this.firstBattingTeam].name;
    this.ui.showToast(`${userTeamName} won the toss and chose to ${choice} first!`, 'success');

    // Remove toss screen and start match
    setTimeout(() => this.startMatch(), 800);
  }

  // ── Match Start ──
  startMatch() {
    const bowlingFirst = this.firstBattingTeam === this.userTeam ? this.opponentTeam : this.userTeam;

    // Initialize engine
    this.engine = new MatchEngine(this.firstBattingTeam, bowlingFirst);
    this.market = new PredictionMarket();
    this.captain = new CaptainMode(this.engine, this.market);

    // Set up event listeners
    this.engine.on('ball', (event) => this.onBall(event));
    this.engine.on('overEnd', (summary) => this.onOverEnd(summary));
    this.engine.on('inningsEnd', (data) => this.onInningsEnd(data));
    this.engine.on('matchEnd', (result) => this.onMatchEnd(result));

    // Set up LIVE API event listeners
    this.api.on('liveUpdate', (data) => this.onLiveUpdate(data));
    this.api.on('liveStatus', (status) => this.onLiveStatus(status));

    // Initialize markets
    this.market.initializeMatchMarkets(this.firstBattingTeam, bowlingFirst);

    // Render game
    const tossScreen = document.getElementById('toss-screen');
    if (tossScreen) tossScreen.remove();
    document.getElementById('app').innerHTML = this.ui.renderGameLayout();

    this.gamePhase = 'playing';

    // Create first over markets
    this.market.createOverMarkets(0, this.engine.getMatchState());

    // Initial render
    this.updateAllUI();

    // Auto-connect to live API if key exists
    if (this.api.hasApiKey()) {
      this.tryLiveConnect();
    }

    // Check if user is bowling team — they make captain decisions
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
    // We need the overRuns/overWickets from the summary, before they were reset
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
    // Resolve innings markets
    this.market.resolveInningsMarkets(data);

    this.gamePhase = 'inningsBreak';
    this.ui.showInningsBreak(data);
  }

  startSecondInnings() {
    this.ui.hideInningsBreak();
    this.engine.startSecondInnings();

    // Create new over markets for second innings
    this.market.createOverMarkets(0, this.engine.getMatchState());

    // Update innings badge
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
    // Resolve all remaining markets
    this.market.resolveMatchMarkets(result, this.firstBattingTeam);

    // Resolve any remaining open markets as cancelled (resolve with current outcome)
    this.market.getOpenMarkets().forEach(m => {
      this.market.resolveMarket(m.id, 'no');
    });

    const summary = this.market.getPortfolioSummary();
    this.gamePhase = 'matchEnd';

    // Small delay for dramatic effect
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
    this.ui.showToast(key ? 'API key saved! Connecting...' : 'API key cleared. Using simulation mode.', key ? 'success' : 'info');

    // Stop any existing polling
    this.api.stopPolling();

    // Try connecting regardless of game phase
    if (key) {
      this.tryLiveConnect();
    } else {
      // Remove live overlay if exists
      this.hideLiveOverlay();
    }
  }

  async tryLiveConnect() {
    if (!this.api.hasApiKey()) return;

    // Set up listeners if not already (for when called before startMatch)
    if (!this._liveListenersAttached) {
      this.api.on('liveUpdate', (data) => this.onLiveUpdate(data));
      this.api.on('liveStatus', (status) => this.onLiveStatus(status));
      this._liveListenersAttached = true;
    }

    const liveBadge = document.getElementById('live-badge');
    this.ui.showToast('🔍 Searching for live match...', 'info');

    const match = await this.api.findLiveMatch();
    if (match) {
      this.ui.showToast(`📡 Connected: ${match.name || 'Live match found'}`, 'success', 4000);
      if (liveBadge) {
        liveBadge.style.display = 'flex';
        liveBadge.classList.add('live');
      }
      // Start polling (does an immediate first fetch)
      await this.api.startPolling(match.id, 20000);
    } else {
      this.ui.showToast('No live match found. Playing in simulation mode.', 'warning');
    }
  }

  // ── Live API Handlers ──
  onLiveUpdate(data) {
    if (!data || !data.parsed) return;
    const { parsed, raw } = data;

    console.log('📡 Live update received:', parsed);

    // Show/update the live score overlay
    this.renderLiveOverlay(parsed, raw);

    // Update live badge
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) {
      liveBadge.style.display = 'flex';
      liveBadge.classList.add('live');
      liveBadge.querySelector('span').textContent = 'LIVE';
    }

    // If the game engine is active, update market odds based on live data
    if (this.market && parsed.scores && parsed.scores.length > 0) {
      const latestScore = parsed.scores[parsed.scores.length - 1];
      // Update match winner odds based on live score
      this.market.updateOdds(this.engine.getMatchState());
      this.ui.renderMarkets(this.market);
      this.ui.renderPortfolio(this.market);
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

    // Batting details if available
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
